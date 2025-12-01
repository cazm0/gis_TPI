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
      
      // Generar variantes posibles del nombre (original, +0, +1, +2)
      const variants = [ //Esto de las variantes es porque, si importás los datos de postgis a geoserver con importar data, se te carga con un 0 por algún motivo
        layerName,        // Nombre original
        layerName + '0',  // Con 0 al final
        layerName + '1',  // Con 1 al final
        layerName + '2',  // Con 2 al final
      ];
      
      // Guardar las variantes para este ID
      this.layerVariants[cfg.id] = variants.map(v => `${workspace}:${v}`);
      
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

      // Escuchar errores en el source para intentar variantes automáticamente
      layer.getSource().on('imageloaderror', () => {
        this.tryNextVariant(cfg.id, layer);
      });

      this.map.addLayer(layer);
      this.layers[cfg.id] = layer;
    });
  }

  /**
   * Intenta la siguiente variante del nombre de capa si la actual falla
   */
  tryNextVariant(configId, layer) {
    const variants = this.layerVariants[configId];
    const currentName = this.activeLayerNames[configId];
    const currentIndex = variants.indexOf(currentName);

    // Si hay más variantes para probar
    if (currentIndex < variants.length - 1) {
      const nextVariant = variants[currentIndex + 1];
      console.log(`Intentando variante alternativa para ${configId}: ${nextVariant}`);
      
      // Actualizar el parámetro LAYERS del source
      const source = layer.getSource();
      const params = source.getParams();
      params['LAYERS'] = nextVariant;
      source.updateParams(params);
      
      // Guardar el nombre activo
      this.activeLayerNames[configId] = nextVariant;
    } else {
      console.warn(`No se pudo cargar la capa ${configId} con ninguna variante`);
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
