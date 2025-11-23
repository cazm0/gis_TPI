import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import { URL_OGC } from "../config";
import { layersConfig } from "../layers";

export default class LayerManager {
  constructor(map) {
    this.map = map;
    this.layers = {};
    this.onChange = null; // 👈 importante

    layersConfig.forEach((cfg) => {
      const layer = new ImageLayer({
        visible: false,
        source: new ImageWMS({
          url: URL_OGC,
          params: {
            LAYERS: cfg.id,
            VERSION: "1.1.0",
            SRS: "EPSG:4326",
            FORMAT: "image/png",
          },
          serverType: "geoserver",
        }),
      });

      this.map.addLayer(layer);
      this.layers[cfg.id] = layer;
    });
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
