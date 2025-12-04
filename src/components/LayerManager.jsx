/**
 * LayerManager - Gestor de capas GIS para la aplicación
 * 
 * Esta clase maneja todas las operaciones relacionadas con capas:
 * - Capas WMS desde GeoServer (imágenes rasterizadas)
 * - Capas vectoriales de usuario (cargadas desde archivos o dibujadas)
 * - Gestión de visibilidad, opacidad, estilos y ordenamiento (z-index)
 * - Persistencia de capas de usuario en localStorage
 * - Manejo automático de variantes de nombres de capas (para compatibilidad con GeoServer)
 */

import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { GeoJSON } from "ol/format";
import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style";
import { URL_OGC } from "../config";
import { layersConfig } from "../layers";

export default class LayerManager {
  /**
   * Constructor - Inicializa el gestor de capas
   * @param {ol.Map} map - Instancia del mapa de OpenLayers
   */
  constructor(map) {
    this.map = map; // Referencia al mapa de OpenLayers
    this.layers = {}; // Diccionario de capas WMS desde GeoServer (id -> layer)
    this.userLayers = {}; // Diccionario de capas vectoriales de usuario (id -> layer)
    this.onChange = null; // Callback para notificar cambios a React (para actualizar UI)
    this.layerVariants = {}; // Almacena las variantes de nombres posibles para cada capa
    this.activeLayerNames = {}; // Almacena el nombre real que funciona para cada capa en GeoServer
    
    // Cargar capas de usuario guardadas previamente en localStorage
    this.loadUserLayers();

    // Crear una capa WMS para cada configuración definida en layersConfig
    layersConfig.forEach((cfg) => {
      // Extraer workspace y nombre de capa del formato "workspace:layerName"
      const [workspace, layerName] = cfg.id.split(':');
      
      /**
       * Generar variantes posibles del nombre de capa
       * GeoServer a veces modifica los nombres de capas:
       * - Agrega "0", "1", "2" al final
       * - Codifica caracteres especiales (acentos, ñ) como "_"
       * Esto permite intentar múltiples variantes automáticamente si una falla
       */
      const variants = [
        layerName + '0',  // Con 0 al final (GeoServer a veces agrega esto)
        layerName,        // Nombre original
      ];
      
      /**
       * Función para codificar caracteres especiales que GeoServer puede modificar
       * GeoServer a veces reemplaza acentos y caracteres especiales con guiones bajos
       */
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
      
      /**
       * Crear fuente WMS (Web Map Service) para obtener imágenes rasterizadas de GeoServer
       * WMS devuelve imágenes PNG de las capas en lugar de datos vectoriales
       */
      const source = new ImageWMS({
          url: URL_OGC, // URL del servicio WMS configurada en config.js
          params: {
          LAYERS: initialLayerId, // Nombre de la capa en GeoServer
            VERSION: "1.1.0", // Versión del protocolo WMS
            SRS: "EPSG:4326", // Sistema de coordenadas (WGS84)
            FORMAT: "image/png", // Formato de imagen solicitado
          },
          serverType: "geoserver", // Tipo de servidor (optimiza parámetros para GeoServer)
      });

      /**
       * Crear capa de imagen que mostrará las imágenes WMS en el mapa
       * Inicialmente invisible (visible: false) hasta que el usuario la active
       */
      const layer = new ImageLayer({
        visible: false,
        source: source,
      });

      // Guardar metadata en la capa (incluyendo tipo de geometría si está disponible)
      if (cfg.geometryType) {
        layer.set('geometryType', cfg.geometryType);
      }

      // Almacenar el nombre activo inicial
      this.activeLayerNames[cfg.id] = initialLayerId;
      this.variantIndex = {}; // Rastrea qué variante se está usando para cada capa
      this.variantIndex[cfg.id] = 0;

      /**
       * Evento: cuando la imagen WMS se carga exitosamente
       * Actualiza la UI (leyendas, lista de capas) si hay un callback configurado
       */
      source.on('imageloadend', () => {
        // Solo actualizar si la capa está visible y hay callback de cambio
        if (layer.getVisible() && this.onChange) {
          this.onChange();
        }
      });

      /**
       * Evento: cuando hay un error al cargar la imagen WMS
       * Intenta automáticamente la siguiente variante del nombre de capa
       * Esto maneja casos donde GeoServer tiene nombres ligeramente diferentes
       */
      source.on('imageloaderror', (error) => {
        // Intentar siguiente variante solo si aún hay variantes disponibles
        this.tryNextVariant(cfg.id, layer);
      });

      /**
       * Interceptar el método setVisible para manejar la primera activación
       * Cuando una capa se hace visible por primera vez, intenta todas las variantes
       * para encontrar el nombre correcto en GeoServer
       */
      const originalSetVisible = layer.setVisible.bind(layer);
      layer.setVisible = (visible) => {
        // Si es la primera vez que se hace visible, intentar todas las variantes
        if (visible && this.variantIndex[cfg.id] === 0) {
          this.tryVariantsOnVisible(cfg.id, layer);
        }
        originalSetVisible(visible);
        
        /**
         * Si la capa se hace visible y tiene tipo de geometría definido,
         * posicionarla correctamente en el orden de renderizado (z-index)
         * Orden: Puntos (arriba) -> Líneas (medio) -> Polígonos (abajo)
         */
        if (visible && cfg.geometryType) {
          // Usar setTimeout para asegurar que la capa esté completamente visible antes de posicionarla
          setTimeout(() => {
            this.positionLayerByGeometryType(cfg.id, cfg.geometryType);
          }, 100);
        }
      };

      this.map.addLayer(layer);
      this.layers[cfg.id] = layer;
    });

    // Escuchar cambios en la vista (incluyendo rotación) para actualizar capas WMS
    const view = this.map.getView();
    let lastRotation = view.getRotation();
    let lastCenter = view.getCenter();
    let lastZoom = view.getZoom();
    
    // Usar un timeout para debounce de actualizaciones
    this.viewChangeTimeout = null;
    
    const handleViewChange = () => {
      const currentRotation = view.getRotation();
      const currentCenter = view.getCenter();
      const currentZoom = view.getZoom();
      
      // Solo actualizar si realmente cambió algo importante
      const rotationChanged = Math.abs(currentRotation - lastRotation) > 0.001;
      const centerChanged = currentCenter && lastCenter && 
        (Math.abs(currentCenter[0] - lastCenter[0]) > 0.1 || 
         Math.abs(currentCenter[1] - lastCenter[1]) > 0.1);
      const zoomChanged = currentZoom !== lastZoom;
      
      if (rotationChanged || centerChanged || zoomChanged) {
        lastRotation = currentRotation;
        lastCenter = currentCenter;
        lastZoom = currentZoom;
        
        // Debounce para evitar demasiadas actualizaciones durante animaciones
        clearTimeout(this.viewChangeTimeout);
        this.viewChangeTimeout = setTimeout(() => {
          this.refreshVisibleWMSLayers();
        }, 150);
      }
    };
    
    view.on('change:rotation', handleViewChange);
    view.on('change:center', handleViewChange);
    view.on('change:resolution', handleViewChange);
  }

  /**
   * Refresca todas las capas WMS visibles cuando cambia la vista (rotación, zoom, etc.)
   */
  refreshVisibleWMSLayers() {
    Object.keys(this.layers).forEach((id) => {
      const layer = this.layers[id];
      if (layer && layer.getVisible()) {
        const source = layer.getSource();
        // Si es una capa ImageWMS, forzar actualización
        if (source && source instanceof ImageWMS) {
          try {
            // Forzar actualización del source
            source.refresh();
            // También notificar a la capa que ha cambiado
            layer.changed();
          } catch (error) {
            console.warn(`Error al refrescar capa ${id}:`, error);
          }
        }
      }
    });
  }

  /**
   * Intenta todas las variantes de nombre cuando la capa se hace visible por primera vez
   * Prueba cada variante secuencialmente hasta encontrar una que funcione
   * @param {string} configId - ID de la configuración de la capa
   * @param {ol.layer.Image} layer - Capa de OpenLayers a probar
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
   * Se llama automáticamente cuando hay un error al cargar una capa WMS
   * @param {string} configId - ID de la configuración de la capa
   * @param {ol.layer.Image} layer - Capa de OpenLayers que falló
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

  /**
   * Cambiar la visibilidad de una capa (mostrar/ocultar)
   * @param {string} id - ID de la capa
   * @param {boolean} visible - true para mostrar, false para ocultar
   */
  setVisible(id, visible) {
    if (this.layers[id]) {
      // Capa WMS desde GeoServer
      this.layers[id].setVisible(visible);
      
      // Si la capa se hace visible y tiene tipo de geometría, posicionarla correctamente
      if (visible) {
        const layer = this.layers[id];
        const geometryType = layer.get('geometryType');
        if (geometryType) {
          // Usar setTimeout para asegurar que la capa esté completamente visible antes de posicionarla
          setTimeout(() => {
            this.positionLayerByGeometryType(id, geometryType);
          }, 100);
        }
      }
      
      // Notificar a React para actualizar la UI
      if (this.onChange) this.onChange();
    } else if (this.userLayers[id]) {
      // Capa vectorial de usuario
      this.userLayers[id].setVisible(visible);
      // Notificar a React para actualizar la UI
      if (this.onChange) this.onChange();
    }
  }

  /**
   * Obtener el estado de visibilidad de una capa
   * @param {string} id - ID de la capa
   * @returns {boolean} true si la capa está visible, false en caso contrario
   */
  getVisible(id) {
    return this.layers[id]?.getVisible() || this.userLayers[id]?.getVisible() || false;
  }

  /**
   * Obtiene todas las capas visibles (incluyendo de usuario)
   * Retorna los nombres reales de las capas que están funcionando en GeoServer
   * @returns {string[]} Array de nombres de capas visibles
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
   * Obtiene el nombre real de la capa que está funcionando en GeoServer
   * (puede ser diferente del nombre original si se aplicó una variante)
   * @param {string} id - ID de la configuración de la capa
   * @returns {string} Nombre real de la capa en GeoServer
   */
  getActiveLayerName(id) {
    return this.activeLayerNames[id] || id;
  }

  /**
   * Cambiar opacidad de una capa WMS
   * @param {string} layerId - ID de la capa
   * @param {number} opacity - Opacidad entre 0 (transparente) y 1 (opaco)
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
   * Aplica diferentes estilos según el tipo de geometría (Point, LineString, Polygon)
   * @param {string} layerId - ID de la capa de usuario
   * @param {string} color - Color en formato hex (#RRGGBB) o rgba
   * @param {number} opacity - Opacidad entre 0 (transparente) y 1 (opaco)
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
   * Cargar capas de usuario guardadas previamente en localStorage
   * Restaura las capas vectoriales que el usuario había creado en sesiones anteriores
   * Incluye features, estilos, atributos y configuración
   */
  loadUserLayers() {
    try {
      const stored = localStorage.getItem('userLayers');
      if (stored) {
        const userLayersData = JSON.parse(stored);
        const loadedLayerIds = [];
        
        // Primero crear todas las capas
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
            loadedLayerIds.push(layerId);
          }
        });
        
        // Después de cargar todas, reordenar según tipo de geometría
        // Esto asegura que el orden sea correcto incluso si se cargan en orden diferente
        loadedLayerIds.forEach(layerId => {
          const layer = this.userLayers[layerId];
          if (layer) {
            const geometryType = layer.get('geometryType');
            if (geometryType) {
              this.positionLayerByGeometryType(layerId, geometryType);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error cargando capas de usuario:', error);
    }
  }

  /**
   * Guardar capas de usuario en localStorage para persistencia
   * Guarda todas las features, estilos, atributos y configuración de las capas de usuario
   * Permite que las capas persistan entre sesiones del navegador
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
   * Crear una nueva capa vectorial de usuario
   * Las capas de usuario son capas vectoriales que el usuario puede crear, editar y eliminar
   * Se guardan en memoria y se persisten en localStorage
   * @param {string} layerId - ID único de la capa (formato "user:nombre")
   * @param {string} title - Título descriptivo de la capa
   * @param {string} geometryType - Tipo de geometría: "Point", "LineString", o "Polygon"
   * @param {Array} featuresData - Array de features GeoJSON para cargar en la capa
   * @param {Array} attributes - Esquema de atributos de la capa
   * @returns {ol.layer.Vector} Capa vectorial creada
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

    // Posicionar la capa según su tipo de geometría
    // Orden: Puntos (arriba) -> Líneas (medio) -> Polígonos (abajo)
    this.positionLayerByGeometryType(layerId, geometryType);

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
   * Agregar una feature (geometría) a una capa de usuario existente
   * @param {string} layerId - ID de la capa de usuario
   * @param {ol.Feature} feature - Feature de OpenLayers a agregar
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
   * Obtener todas las capas (WMS y de usuario) combinadas
   * @returns {Object} Diccionario con todas las capas (id -> layer)
   */
  getAllLayers() {
    return { ...this.layers, ...this.userLayers };
  }

  /**
   * Obtener solo las capas vectoriales de usuario
   * @returns {Object} Diccionario con capas de usuario (id -> layer)
   */
  getUserLayers() {
    return this.userLayers;
  }

  /**
   * Eliminar una capa de usuario del mapa y del almacenamiento
   * @param {string} layerId - ID de la capa a eliminar
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
   * Exportar una capa de usuario a formato GeoJSON
   * Útil para descargar o compartir las capas creadas por el usuario
   * @param {string} layerId - ID de la capa a exportar
   * @returns {string|null} GeoJSON como string, o null si la capa no existe
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
   * @param {string} layerId - ID de la capa de usuario
   * @param {ol.Feature} feature - Feature a eliminar
   * @returns {boolean} true si se eliminó exitosamente, false en caso contrario
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
   * Mueve una capa hacia arriba en el orden de renderizado (aumenta z-index)
   * Las capas con mayor z-index se renderizan por encima de las demás
   * @param {string} layerId - ID de la capa a mover
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
   * Mueve una capa hacia abajo en el orden de renderizado (disminuye z-index)
   * Las capas con menor z-index se renderizan por debajo de las demás
   * @param {string} layerId - ID de la capa a mover
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
   * @param {string} layerId - ID de la capa
   * @returns {number} z-index de la capa (0 por defecto)
   */
  getLayerZIndex(layerId) {
    const layer = this.layers[layerId] || this.userLayers[layerId];
    if (!layer) return 0;
    return layer.getZIndex() || 0;
  }

  /**
   * Obtiene todas las capas visibles ordenadas por tipo de geometría y z-index
   * Orden de renderizado: Puntos (arriba) -> Líneas (medio) -> Polígonos (abajo)
   * Dentro de cada grupo, se ordena por z-index (mayor a menor)
   * @returns {Array} Array de objetos con información de capas visibles
   */
  getVisibleLayersOrdered() {
    const visible = [];
    Object.keys(this.layers).forEach((id) => {
      if (this.getVisible(id)) {
        // Buscar el título en la configuración de capas
        const layerConfig = layersConfig.find(cfg => cfg.id === id);
        const displayName = layerConfig ? layerConfig.title : (id.split(':')[1] || this.activeLayerNames[id] || id);
        
        const layer = this.layers[id];
        visible.push({
          id,
          name: this.activeLayerNames[id] || id,
          displayName: displayName,
          isUserLayer: false,
          geometryType: layer?.get('geometryType') || null, // Obtener tipo de geometría si está definido
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
    
    // Ordenar por tipo de geometría primero, luego por z-index dentro de cada grupo
    // Orden: Puntos (arriba) -> Líneas (medio) -> Polígonos (abajo)
    const geometryOrder = { 'Point': 0, 'LineString': 1, 'Polygon': 2, null: 1.5 }; // null (GeoServer) va entre líneas y polígonos
    
    return visible.sort((a, b) => {
      const aOrder = geometryOrder[a.geometryType] ?? 1.5;
      const bOrder = geometryOrder[b.geometryType] ?? 1.5;
      
      // Primero ordenar por tipo de geometría
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      // Si son del mismo tipo, ordenar por z-index (mayor a menor)
      return b.zIndex - a.zIndex;
    });
  }

  /**
   * Mueve una capa a una posición específica en el orden de renderizado
   * Calcula el z-index apropiado para que la capa quede en la posición deseada
   * Respeta el orden por tipo de geometría (no permite mezclar tipos)
   * @param {string} layerId - ID de la capa a mover
   * @param {number} targetIndex - Índice objetivo en la lista de capas visibles
   */
  moveLayerToPosition(layerId, targetIndex) {
    const orderedLayers = this.getVisibleLayersOrdered();
    const currentIndex = orderedLayers.findIndex(l => l.id === layerId);
    
    if (currentIndex === -1) return;
    
    const layer = this.layers[layerId] || this.userLayers[layerId];
    if (!layer) return;
    
    // Obtener el tipo de geometría de la capa que se está moviendo
    const movingLayerGeometryType = layer.get('geometryType') || null;
    
    // Si la capa tiene un tipo de geometría, ajustar el targetIndex para que respete el orden por tipo
    if (movingLayerGeometryType) {
      const geometryOrder = { 'Point': 0, 'LineString': 1, 'Polygon': 2 };
      const targetOrder = geometryOrder[movingLayerGeometryType];
      
      // Encontrar el rango de índices válidos para este tipo de geometría
      const layersWithoutCurrent = orderedLayers.filter(l => l.id !== layerId);
      const sameTypeLayers = layersWithoutCurrent.filter(l => {
        const layerGeomType = l.geometryType || null;
        return geometryOrder[layerGeomType] === targetOrder;
      });
      
      // Si hay capas del mismo tipo, ajustar el targetIndex para que esté dentro del grupo
      if (sameTypeLayers.length > 0) {
        // Encontrar la posición correcta dentro del grupo del mismo tipo
        const firstSameTypeIndex = layersWithoutCurrent.findIndex(l => {
          const layerGeomType = l.geometryType || null;
          return geometryOrder[layerGeomType] === targetOrder;
        });
        const lastSameTypeIndex = firstSameTypeIndex + sameTypeLayers.length - 1;
        
        // Ajustar targetIndex para que esté dentro del rango del grupo
        if (targetIndex < firstSameTypeIndex) {
          targetIndex = firstSameTypeIndex;
        } else if (targetIndex > lastSameTypeIndex + 1) {
          targetIndex = lastSameTypeIndex + 1;
        }
      } else {
        // Si no hay capas del mismo tipo, insertar al principio del grupo correspondiente
        const insertIndex = layersWithoutCurrent.findIndex(l => {
          const layerGeomType = l.geometryType || null;
          return geometryOrder[layerGeomType] > targetOrder;
        });
        targetIndex = insertIndex === -1 ? layersWithoutCurrent.length : insertIndex;
      }
    }
    
    // Asegurar que el targetIndex esté en el rango válido (0 a length, permitiendo insertar al final)
    targetIndex = Math.max(0, Math.min(targetIndex, orderedLayers.length));
    
    // Si ya está en la posición objetivo, no hacer nada
    if (currentIndex === targetIndex) return;
    
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
      
      if (!prevLayer || !nextLayer) {
        // Si no hay capas adyacentes válidas, usar un valor por defecto
        const baseZIndex = layersWithoutCurrent.length > 0 
          ? (layersWithoutCurrent[0]?.zIndex || 0) 
          : 0;
        newZIndex = baseZIndex - targetIndex;
        layer.setZIndex(newZIndex);
        if (this.onChange) {
          this.onChange();
        }
        return;
      }
      
      const prevZIndex = prevLayer.zIndex || 0;
      const nextZIndex = nextLayer.zIndex || 0;
      
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

  /**
   * Posiciona una capa según su tipo de geometría en el orden de renderizado
   * Orden estándar: Puntos (arriba) -> Líneas (medio) -> Polígonos (abajo)
   * Las nuevas capas se insertan al principio de su grupo (arriba de todas las del mismo tipo)
   * Esto asegura que los puntos siempre sean visibles sobre líneas y polígonos
   * @param {string} layerId - ID de la capa a posicionar
   * @param {string} geometryType - Tipo de geometría: "Point", "LineString", o "Polygon"
   */
  positionLayerByGeometryType(layerId, geometryType) {
    if (!geometryType) return;
    
    const layer = this.layers[layerId] || this.userLayers[layerId];
    if (!layer) return;
    
    const orderedLayers = this.getVisibleLayersOrdered();
    const geometryOrder = { 'Point': 0, 'LineString': 1, 'Polygon': 2 };
    const targetOrder = geometryOrder[geometryType];
    
    if (targetOrder === undefined) return;
    
    // Filtrar capas del mismo tipo (excluyendo la capa actual)
    const sameTypeLayers = orderedLayers.filter(l => {
      if (l.id === layerId) return false; // Excluir la capa actual
      const layerGeomType = l.geometryType || null;
      return geometryOrder[layerGeomType] === targetOrder;
    });
    
    let newZIndex;
    
    if (sameTypeLayers.length > 0) {
      // Hay capas del mismo tipo: poner esta capa arriba de todas (mayor z-index)
      const maxZIndex = Math.max(...sameTypeLayers.map(l => l.zIndex || 0));
      newZIndex = maxZIndex + 1;
    } else {
      // No hay capas del mismo tipo: encontrar la primera capa del siguiente tipo
      const nextTypeLayer = orderedLayers.find(l => {
        const layerGeomType = l.geometryType || null;
        const layerOrder = geometryOrder[layerGeomType] ?? 1.5;
        return layerOrder > targetOrder;
      });
      
      if (nextTypeLayer) {
        // Hay capas del siguiente tipo: poner esta capa justo arriba (mayor z-index que la primera del siguiente tipo)
        newZIndex = (nextTypeLayer.zIndex || 0) + 1;
      } else {
        // No hay capas del siguiente tipo: poner al final (z-index mínimo)
        const allOtherLayers = orderedLayers.filter(l => l.id !== layerId);
        if (allOtherLayers.length > 0) {
          const minZIndex = Math.min(...allOtherLayers.map(l => l.zIndex || 0));
          newZIndex = Math.min(0, minZIndex - 1);
        } else {
          newZIndex = 0;
        }
      }
    }
    
    // Aplicar el nuevo z-index
    layer.setZIndex(newZIndex);
    
    if (this.onChange) {
      this.onChange();
    }
  }
}
