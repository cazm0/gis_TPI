import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";

export default function BaseMap(map) {
  const osm = new TileLayer({
    source: new OSM({
      attributions: [], // sin texto de OSM
    }),
  });

  map.addLayer(osm);
}
