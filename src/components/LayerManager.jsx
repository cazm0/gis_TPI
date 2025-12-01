import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import { URL_OGC } from "../config";
import { layersConfig } from "../layers";

export default class LayerManager {
  constructor(map) {
    this.map = map;
    this.layers = {};
    this.onChange = null; // 👈 importante
    this.layerVariants = {}; // Almacena las variantes de nombres para cada capa
    this.activeLayerNames = {}; // Almacena el nombre real que funciona para cada capa

    layersConfig.forEach((cfg) => {
      // Extraer workspace y nombre de capa
      const [workspace, layerName] = cfg.id.split(':');
      
      // Generar variantes posibles del nombre
      // Esto incluye: original, con "0", y también variantes con caracteres especiales codificados
      const variants = [
        layerName,        // Nombre original
        layerName + '0',  // Con 0 al final (GeoServer a veces agrega esto)
        layerName + '1',  // Con 1 al final
        layerName + '2',  // Con 2 al final
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
      
      const layer = new ImageLayer({
        visible: false,
        source: new ImageWMS({
          url: URL_OGC,
          params: {
            LAYERS: initialLayerId,
            VERSION: "1.1.0",
            SRS: "EPSG:4326",
            FORMAT: "image/png",
          },
          serverType: "geoserver",
        }),
      });

      // Almacenar el nombre activo inicial
      this.activeLayerNames[cfg.id] = initialLayerId;
      this.variantIndex = {}; // Rastrea qué variante se está usando para cada capa
      this.variantIndex[cfg.id] = 0;

      // Escuchar errores en el source para intentar variantes automáticamente
      const source = layer.getSource();
      source.on('imageloaderror', () => {
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
      
      // Si no hay error en 1 segundo, asumimos que esta variante funciona
      setTimeout(() => {
        source.un('imageloaderror', errorHandler);
        console.log(`✓ Capa ${configId} cargada exitosamente con variante: ${variant}`);
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
    }
  }

  getVisible(id) {
    return this.layers[id]?.getVisible() || false;
  }
}
