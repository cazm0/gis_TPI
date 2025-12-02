import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { GeoJSON } from "ol/format";
import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style";
import { URL_OGC } from "../config";
import { layersConfig } from "../layers";

export default class LayerManager {
  constructor(map) {
    this.map = map;
    this.layers = {};
    this.userLayers = {}; // Capas de usuario (en memoria)
    this.onChange = null; // 👈 importante
    this.layerVariants = {}; // Almacena las variantes de nombres para cada capa
    this.activeLayerNames = {}; // Almacena el nombre real que funciona para cada capa
    
    // Cargar capas de usuario desde localStorage
    this.loadUserLayers();

    layersConfig.forEach((cfg) => {
      // Extraer workspace y nombre de capa
      const [workspace, layerName] = cfg.id.split(':');
      
      // Generar variantes posibles del nombre
      // Esto incluye: original, con "0", y también variantes con caracteres especiales codificados
      const variants = [
        layerName + '0',  // Con 0 al final (GeoServer a veces agrega esto)
        layerName,        // Nombre original
      ];
      
      // Agregar variantes con caracteres especiales codificados (GeoServer a veces codifica caracteres)
      // Mapeo de caracteres especiales que GeoServer puede codificar
      const encodeSpecialChars = (name) => {
        return name
          .replace(/ó/g, '_')  // ó -> _
          .replace(/ñ/g, '_')  // ñ -> _
          .replace(/í/g, '_')  // í -> _
          .replace(/á/g, '_')  // á -> _
          .replace(/é/g, '_')  // é -> _
          .replace(/ú/g, '_')  // ú -> _
          .replace(/Ó/g, '_')  // Ó -> _
          .replace(/Ñ/g, '_')  // Ñ -> _
          .replace(/Í/g, '_')  // Í -> _
          .replace(/Á/g, '_')  // Á -> _
          .replace(/É/g, '_')  // É -> _
          .replace(/Ú/g, '_'); // Ú -> _
      };
      
      const encodedName = encodeSpecialChars(layerName);
      const specialCharVariants = [
        encodedName,           // Sin acentos
        encodedName + '0',    // Sin acentos + 0
        encodedName + '1',    // Sin acentos + 1
        encodedName + '2',    // Sin acentos + 2
      ];
      
      // Combinar todas las variantes y eliminar duplicados
      const allVariants = [...new Set([...variants, ...specialCharVariants])];
      
      // Guardar las variantes para este ID
      this.layerVariants[cfg.id] = allVariants.map(v => `${workspace}:${v}`);
      
      // Crear la capa con el nombre original primero
      const initialLayerId = this.layerVariants[cfg.id][0];
      
      const source = new ImageWMS({
          url: URL_OGC,
          params: {
          LAYERS: initialLayerId,
            VERSION: "1.1.0",
            SRS: "EPSG:4326",
            FORMAT: "image/png",
          },
          serverType: "geoserver",
      });


      const layer = new ImageLayer({
        visible: false,
        source: source,
      });

      // Almacenar el nombre activo inicial
      this.activeLayerNames[cfg.id] = initialLayerId;
      this.variantIndex = {}; // Rastrea qué variante se está usando para cada capa
      this.variantIndex[cfg.id] = 0;

      // Escuchar cuando la imagen se carga exitosamente para actualizar leyendas
      source.on('imageloadend', () => {
        // Solo actualizar si la capa está visible
        if (layer.getVisible() && this.onChange) {
          this.onChange();
        }
      });

      // Escuchar errores en el source para intentar variantes automáticamente
      source.on('imageloaderror', (error) => {
        // Intentar siguiente variante solo si aún hay variantes disponibles
        this.tryNextVariant(cfg.id, layer);
      });

      // También intentar variantes cuando la capa se hace visible por primera vez
      // Esto ayuda a encontrar la variante correcta incluso si no hay error inmediato
      const originalSetVisible = layer.setVisible.bind(layer);
      layer.setVisible = (visible) => {
        if (visible && this.variantIndex[cfg.id] === 0) {
          // Si es la primera vez que se hace visible, intentar cargar con todas las variantes
          this.tryVariantsOnVisible(cfg.id, layer);
        }
        originalSetVisible(visible);
      };

      this.map.addLayer(layer);
      this.layers[cfg.id] = layer;
    });
  }

  /**
   * Intenta todas las variantes cuando la capa se hace visible por primera vez
   */
  tryVariantsOnVisible(configId, layer) {
    const variants = this.layerVariants[configId];
    const source = layer.getSource();
    let currentIndex = this.variantIndex[configId] || 0;

    // Función recursiva para probar variantes
    const tryNext = () => {
      if (currentIndex >= variants.length) {
        console.warn(`No se pudo cargar la capa ${configId} con ninguna variante`);
        return;
      }

      const variant = variants[currentIndex];
      console.log(`Probando variante ${currentIndex + 1}/${variants.length} para ${configId}: ${variant}`);
      
      const params = source.getParams();
      params['LAYERS'] = variant;
      source.updateParams(params);
      this.activeLayerNames[configId] = variant;
      this.variantIndex[configId] = currentIndex;

      // Escuchar si hay error para probar la siguiente variante
      const errorHandler = () => {
        source.un('imageloaderror', errorHandler);
        currentIndex++;
        setTimeout(tryNext, 100); // Pequeño delay antes de probar la siguiente
      };
      
      source.once('imageloaderror', errorHandler);
      
      // Escuchar cuando la imagen se carga exitosamente
      const loadHandler = () => {
        source.un('imageloadend', loadHandler);
        source.un('imageloaderror', errorHandler);
        console.log(`✓ Capa ${configId} cargada exitosamente con variante: ${variant}`);
        // Actualizar leyendas cuando la capa termine de cargar
        if (layer.getVisible() && this.onChange) {
          this.onChange();
        }
      };
      
      source.once('imageloadend', loadHandler);
      
      // Si no hay error en 1 segundo, asumimos que esta variante funciona
      setTimeout(() => {
        source.un('imageloaderror', errorHandler);
        source.un('imageloadend', loadHandler);
      }, 1000);
    };

    tryNext();
  }

  /**
   * Intenta la siguiente variante del nombre de capa si la actual falla
   */
  tryNextVariant(configId, layer) {
    const variants = this.layerVariants[configId];
    const currentIndex = this.variantIndex[configId] || 0;

    // Si hay más variantes para probar
    if (currentIndex < variants.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextVariant = variants[nextIndex];
      console.log(`Intentando variante alternativa ${nextIndex + 1}/${variants.length} para ${configId}: ${nextVariant}`);
      
      // Actualizar el parámetro LAYERS del source
      const source = layer.getSource();
      const params = source.getParams();
      params['LAYERS'] = nextVariant;
      source.updateParams(params);
      
      // Guardar el nombre activo y el índice
      this.activeLayerNames[configId] = nextVariant;
      this.variantIndex[configId] = nextIndex;
    } else {
      console.warn(`No se pudo cargar la capa ${configId} con ninguna variante (probadas ${variants.length} variantes)`);
    }
  }

  setVisible(id, visible) {
    if (this.layers[id]) {
      this.layers[id].setVisible(visible);
      // ⚡ Notificar a React
      if (this.onChange) this.onChange();
    } else if (this.userLayers[id]) {
      this.userLayers[id].setVisible(visible);
      // ⚡ Notificar a React
      if (this.onChange) this.onChange();
    }
  }

  getVisible(id) {
    return this.layers[id]?.getVisible() || this.userLayers[id]?.getVisible() || false;
  }

  /**
   * Obtiene todas las capas visibles (incluyendo de usuario)
   */
  getVisibleLayers() {
    const visible = [];
    Object.keys(this.layers).forEach((id) => {
      if (this.getVisible(id)) {
        // Retornar el nombre real de la capa que está funcionando
        visible.push(this.activeLayerNames[id] || id);
      }
    });
    // Agregar capas de usuario visibles
    Object.keys(this.userLayers).forEach((id) => {
      if (this.getVisible(id)) {
        visible.push(id);
      }
    });
    return visible;
  }

  /**
   * Obtiene el nombre real de la capa (con variantes aplicadas)
   */
  getActiveLayerName(id) {
    return this.activeLayerNames[id] || id;
  }

  /**
   * Cambiar opacidad de una capa WMS
   */
  setLayerOpacity(layerId, opacity) {
    const layer = this.layers[layerId];
    if (layer) {
      layer.setOpacity(opacity);
      if (this.onChange) {
        this.onChange();
      }
    }
  }

  /**
   * Cambiar estilo de una capa de usuario (color y opacidad)
   */
  setUserLayerStyle(layerId, color, opacity) {
    const userLayer = this.userLayers[layerId];
    if (!userLayer) return;

    // Convertir color a formato rgba si es necesario
    let fillColor = color;
    if (color.startsWith('#')) {
      // Convertir hex a rgba
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      fillColor = [r, g, b, Math.round(opacity * 255)];
    } else if (color.startsWith('rgba')) {
      // Extraer valores rgba y actualizar opacidad
      const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (rgbaMatch) {
        fillColor = [parseInt(rgbaMatch[1]), parseInt(rgbaMatch[2]), parseInt(rgbaMatch[3]), Math.round(opacity * 255)];
      }
    }

    // Obtener tipo de geometría
    const geometryType = userLayer.get('geometryType') || 'Point';

    // Crear nuevo estilo
    let style;
    if (geometryType === 'Point') {
      style = new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: fillColor }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      });
    } else if (geometryType === 'LineString') {
      style = new Style({
        stroke: new Stroke({
          color: fillColor,
          width: 3,
        }),
      });
    } else {
      // Polygon
      style = new Style({
        fill: new Fill({ color: fillColor }),
        stroke: new Stroke({
          color: '#fff',
          width: 2,
        }),
      });
    }

    // Aplicar estilo a la capa
    userLayer.setStyle(style);
    userLayer.setOpacity(opacity);

    // Guardar estilo en metadata de la capa
    userLayer.set('customColor', color);
    userLayer.set('customOpacity', opacity);

    // Guardar en localStorage
    this.saveUserLayers();

    if (this.onChange) {
      this.onChange();
    }
  }

  /**
   * Cargar capas de usuario desde localStorage
   */
  loadUserLayers() {
    try {
      const stored = localStorage.getItem('userLayers');
      if (stored) {
        const userLayersData = JSON.parse(stored);
        Object.keys(userLayersData).forEach(layerId => {
          const layerData = userLayersData[layerId];
          const layer = this.createUserLayer(
            layerId, 
            layerData.title, 
            layerData.geometryType, 
            layerData.features,
            layerData.attributes || [] // Cargar atributos si existen
          );
          // Las capas cargadas desde localStorage se crean visibles por defecto
          if (layer) {
            layer.setVisible(true);
          }
        });
      }
    } catch (error) {
      console.error('Error cargando capas de usuario:', error);
    }
  }

  /**
   * Guardar capas de usuario en localStorage
   */
  saveUserLayers() {
    try {
      const userLayersData = {};
      Object.keys(this.userLayers).forEach(layerId => {
        const layer = this.userLayers[layerId];
        const source = layer.getSource();
        const features = source.getFeatures();
        const format = new GeoJSON();
        const featuresJSON = format.writeFeatures(features, {
          featureProjection: "EPSG:3857",
          dataProjection: "EPSG:4326",
        });
        
        const parsedFeatures = JSON.parse(featuresJSON);
        // writeFeatures devuelve un FeatureCollection, extraer el array de features
        const featuresArray = parsedFeatures.features || (Array.isArray(parsedFeatures) ? parsedFeatures : []);
        
        userLayersData[layerId] = {
          title: layer.get('title') || layerId.replace('user:', ''),
          geometryType: layer.get('geometryType') || 'Point',
          attributes: layer.get('attributes') || [], // Guardar esquema de atributos
          customColor: layer.get('customColor'), // Guardar color personalizado
          customOpacity: layer.get('customOpacity'), // Guardar opacidad personalizada
          features: featuresArray,
        };
      });
      localStorage.setItem('userLayers', JSON.stringify(userLayersData));
      console.log('Capas de usuario guardadas:', userLayersData);
    } catch (error) {
      console.error('Error guardando capas de usuario:', error);
    }
  }

  /**
   * Crear una nueva capa de usuario
   */
  createUserLayer(layerId, title, geometryType, featuresData = [], attributes = []) {
    // Si la capa ya existe, no crear otra
    if (this.userLayers[layerId]) {
      return this.userLayers[layerId];
    }

    const source = new VectorSource();
    const format = new GeoJSON();

    // Cargar features desde datos JSON si existen
    if (featuresData && featuresData.length > 0) {
      try {
        // Asegurar que featuresData sea un array de features
        const featureCollection = Array.isArray(featuresData) 
          ? { type: 'FeatureCollection', features: featuresData }
          : featuresData;
        
        const features = format.readFeatures(
          featureCollection,
          { featureProjection: "EPSG:3857", dataProjection: "EPSG:4326" }
        );
        source.addFeatures(features);
        console.log(`Cargadas ${features.length} features en capa ${layerId}`);
      } catch (error) {
        console.error(`Error cargando features para ${layerId}:`, error);
      }
    }

    // Determinar estilo según tipo de geometría
    let style;
    if (geometryType === 'Point') {
      style = new Style({
        image: new CircleStyle({
          radius: 6,
          fill: new Fill({ color: '#ff6b6b' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      });
    } else if (geometryType === 'LineString') {
      style = new Style({
        stroke: new Stroke({
          color: '#ff6b6b',
          width: 3,
        }),
      });
    } else {
      style = new Style({
        stroke: new Stroke({
          color: '#ff6b6b',
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(255, 107, 107, 0.3)',
        }),
      });
    }

    const layer = new VectorLayer({
      source,
      style,
      visible: false,
    });

    // Guardar metadata en la capa
    layer.set('title', title);
    layer.set('geometryType', geometryType);
    layer.set('isUserLayer', true);
    layer.set('attributes', attributes); // Guardar esquema de atributos

    this.map.addLayer(layer);
    this.userLayers[layerId] = layer;

    // Hacer la capa visible por defecto
    layer.setVisible(true);

    // Cargar estilo personalizado si existe
    const storedData = localStorage.getItem('userLayers');
    if (storedData) {
      try {
        const userLayersData = JSON.parse(storedData);
        const layerData = userLayersData[layerId];
        if (layerData && (layerData.customColor || layerData.customOpacity !== undefined)) {
          // Aplicar estilo guardado
          const savedColor = layerData.customColor || '#ff6b6b';
          const savedOpacity = layerData.customOpacity !== undefined ? layerData.customOpacity : 1;
          this.setUserLayerStyle(layerId, savedColor, savedOpacity);
        }
      } catch (error) {
        console.error('Error cargando estilo personalizado:', error);
      }
    }

    // Guardar en localStorage
    this.saveUserLayers();

    // Notificar cambio
    if (this.onChange) this.onChange();

    return layer;
  }

  /**
   * Agregar feature a una capa de usuario
   */
  addFeatureToUserLayer(layerId, feature) {
    if (!this.userLayers[layerId]) {
      console.error(`Capa de usuario ${layerId} no existe`);
      return;
    }

    const source = this.userLayers[layerId].getSource();
    source.addFeature(feature);

    // Guardar en localStorage
    this.saveUserLayers();

    // Notificar cambio
    if (this.onChange) this.onChange();
  }

  /**
   * Obtener todas las capas (incluyendo de usuario)
   */
  getAllLayers() {
    return { ...this.layers, ...this.userLayers };
  }

  /**
   * Obtener solo capas de usuario
   */
  getUserLayers() {
    return this.userLayers;
  }

  /**
   * Eliminar capa de usuario
   */
  removeUserLayer(layerId) {
    if (this.userLayers[layerId]) {
      this.map.removeLayer(this.userLayers[layerId]);
      delete this.userLayers[layerId];
      this.saveUserLayers();
      if (this.onChange) this.onChange();
    }
  }

  /**
   * Exportar capa de usuario a GeoJSON
   */
  exportUserLayerToGeoJSON(layerId) {
    if (!this.userLayers[layerId]) {
      return null;
    }

    const layer = this.userLayers[layerId];
    const source = layer.getSource();
    const features = source.getFeatures();
    const format = new GeoJSON();
    
    const geoJSON = format.writeFeatures(features, {
      featureProjection: "EPSG:3857",
      dataProjection: "EPSG:4326",
    });

    return geoJSON;
  }

  /**
   * Eliminar una feature específica de una capa de usuario
   */
  removeFeatureFromUserLayer(layerId, feature) {
    if (!this.userLayers[layerId]) {
      return false;
    }

    const layer = this.userLayers[layerId];
    const source = layer.getSource();
    
    // Eliminar la feature del source
    source.removeFeature(feature);
    
    // Guardar cambios en localStorage
    this.saveUserLayers();
    
    // Notificar cambio
    if (this.onChange) {
      this.onChange();
    }
    
    return true;
  }

  /**
   * Mueve una capa hacia arriba (aumenta z-index)
   */
  moveLayerUp(layerId) {
    const layer = this.layers[layerId] || this.userLayers[layerId];
    if (!layer) return;

    const currentZIndex = layer.getZIndex() || 0;
    layer.setZIndex(currentZIndex + 1);
    
    if (this.onChange) {
      this.onChange();
    }
  }

  /**
   * Mueve una capa hacia abajo (disminuye z-index)
   */
  moveLayerDown(layerId) {
    const layer = this.layers[layerId] || this.userLayers[layerId];
    if (!layer) return;

    const currentZIndex = layer.getZIndex() || 0;
    layer.setZIndex(Math.max(0, currentZIndex - 1));
    
    if (this.onChange) {
      this.onChange();
    }
  }

  /**
   * Obtiene el z-index actual de una capa
   */
  getLayerZIndex(layerId) {
    const layer = this.layers[layerId] || this.userLayers[layerId];
    if (!layer) return 0;
    return layer.getZIndex() || 0;
  }

  /**
   * Obtiene todas las capas visibles ordenadas por z-index (de menor a mayor)
   */
  getVisibleLayersOrdered() {
    const visible = [];
    Object.keys(this.layers).forEach((id) => {
      if (this.getVisible(id)) {
        // Buscar el título en la configuración de capas
        const layerConfig = layersConfig.find(cfg => cfg.id === id);
        const displayName = layerConfig ? layerConfig.title : (id.split(':')[1] || this.activeLayerNames[id] || id);
        
        visible.push({
          id,
          name: this.activeLayerNames[id] || id,
          displayName: displayName,
          isUserLayer: false,
          zIndex: this.getLayerZIndex(id)
        });
      }
    });
    Object.keys(this.userLayers).forEach((id) => {
      if (this.getVisible(id)) {
        const layer = this.userLayers[id];
        visible.push({
          id,
          name: id,
          displayName: layer.get('title') || id.replace('user:', ''),
          isUserLayer: true,
          geometryType: layer.get('geometryType') || 'Point',
          zIndex: this.getLayerZIndex(id)
        });
      }
    });
    // Ordenar por z-index (mayor a menor) para mostrar en la leyenda
    // Las que están más arriba en la lista (índice 0) deben tener mayor z-index para renderizarse por encima
    return visible.sort((a, b) => b.zIndex - a.zIndex);
  }

  /**
   * Mueve una capa a una posición específica en el orden (basado en índice)
   */
  moveLayerToPosition(layerId, targetIndex) {
    const orderedLayers = this.getVisibleLayersOrdered();
    const currentIndex = orderedLayers.findIndex(l => l.id === layerId);
    
    if (currentIndex === -1) return;
    
    // Asegurar que el targetIndex esté en el rango válido (0 a length, permitiendo insertar al final)
    targetIndex = Math.max(0, Math.min(targetIndex, orderedLayers.length));
    
    // Si ya está en la posición objetivo, no hacer nada
    if (currentIndex === targetIndex) return;
    
    const layer = this.layers[layerId] || this.userLayers[layerId];
    if (!layer) return;
    
    // Remover la capa de la lista para calcular el z-index correctamente
    const layersWithoutCurrent = orderedLayers.filter(l => l.id !== layerId);
    
    // Calcular el nuevo z-index basado en la posición objetivo
    // Las capas que están más arriba en la lista (índice 0) deben tener mayor z-index
    // para renderizarse por encima de las que están más abajo
    let newZIndex;
    
    if (targetIndex === 0) {
      // Mover al principio (arriba en la lista): z-index máximo para renderizarse por encima
      const maxZIndex = layersWithoutCurrent.length > 0 
        ? Math.max(...layersWithoutCurrent.map(l => l.zIndex || 0)) 
        : 0;
      newZIndex = maxZIndex + 1;
    } else if (targetIndex >= layersWithoutCurrent.length) {
      // Mover al final (abajo en la lista): z-index mínimo para renderizarse por debajo
      const minZIndex = layersWithoutCurrent.length > 0 
        ? Math.min(...layersWithoutCurrent.map(l => l.zIndex || 0)) 
        : 0;
      newZIndex = Math.min(0, minZIndex - 1);
    } else {
      // Mover a una posición intermedia: z-index entre las dos capas adyacentes
      // Como la lista está ordenada de mayor a menor z-index:
      // - prevLayer (targetIndex-1) está arriba y tiene mayor z-index
      // - nextLayer (targetIndex) está abajo y tiene menor z-index
      const prevLayer = layersWithoutCurrent[targetIndex - 1];
      const nextLayer = layersWithoutCurrent[targetIndex];
      const prevZIndex = prevLayer?.zIndex || 0;
      const nextZIndex = nextLayer?.zIndex || 0;
      
      // Calcular z-index intermedio
      // Queremos que la capa se inserte entre prevLayer (arriba) y nextLayer (abajo)
      // Por lo tanto, el z-index debe ser menor que prevZIndex pero mayor que nextZIndex
      if (Math.abs(prevZIndex - nextZIndex) < 2) {
        // Si están muy juntos, usar un incremento fijo
        // Asegurar que sea menor que prevZIndex y mayor que nextZIndex
        newZIndex = nextZIndex + 0.5;
        // Si esto no funciona, usar un valor más bajo
        if (newZIndex >= prevZIndex) {
          newZIndex = prevZIndex - 0.5;
        }
      } else {
        // Calcular el punto medio
        newZIndex = (prevZIndex + nextZIndex) / 2;
      }
      
      // Asegurar que el z-index sea diferente de los adyacentes y esté en el rango correcto
      if (newZIndex >= prevZIndex || newZIndex <= nextZIndex) {
        // Si no está en el rango correcto, usar un valor intermedio seguro
        newZIndex = nextZIndex + (prevZIndex - nextZIndex) / 2;
      }
      
      // Asegurar que no sea exactamente igual a ninguno de los adyacentes
      if (newZIndex === prevZIndex) {
        newZIndex = prevZIndex - 0.1;
      }
      if (newZIndex === nextZIndex) {
        newZIndex = nextZIndex + 0.1;
      }
    }
    
    layer.setZIndex(newZIndex);
    
    if (this.onChange) {
      this.onChange();
    }
  }
}
