import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";

const SOURCE_FACTORIES = {
  standard: () =>
    new OSM({
      attributions: [],
    }),
  urban: () =>
    new XYZ({
      url: "https://{a-c}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      attributions: "© Carto",
    }),
  dark: () =>
    new XYZ({
      url: "https://{a-c}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png",
      attributions: "© Carto",
    }),
  satellite: () =>
    new XYZ({
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attributions: "© Esri, Maxar, Earthstar Geographics",
    }),
  hybrid: () =>
    new XYZ({
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      attributions: "© Esri, HERE, Garmin",
    }),
  terrain: () =>
    new XYZ({
      url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attributions:
        "Map data © OpenStreetMap contributors, SRTM | Map style © OpenTopoMap (CC-BY-SA)",
    }),
};

export const MAP_STYLES = [
  { id: "standard", label: "Predeterminado" },
  { id: "urban", label: "Urbano" },
  { id: "satellite", label: "Satélite" },
  { id: "hybrid", label: "Híbrido" },
  { id: "terrain", label: "Terreno" },
  { id: "dark", label: "Oscuro" },
];

export function createBaseLayer(styleId = "standard") {
  const factory = SOURCE_FACTORIES[styleId] || SOURCE_FACTORIES.standard;
  return new TileLayer({
    source: factory(),
  });
}

export default function BaseMap(map, styleId = "standard") {
  const layer = createBaseLayer(styleId);
  layer.setZIndex(-1);
  const layers = map.getLayers();
  if (layers.getLength() > 0) {
    layers.insertAt(0, layer);
  } else {
    map.addLayer(layer);
  }
  return layer;
}
