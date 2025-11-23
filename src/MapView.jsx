import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import { URL_OGC } from "./config";
import { layersConfig } from "./layers";
import { defaults as defaultControls } from "ol/control";


export default function MapView() {
  const mapRef = useRef();
  const [layers, setLayers] = useState({});

  useEffect(() => {
    // ============================
    // 1) Vista en EPSG:3857 (OSM)
    // ============================
    const view = new View({
      projection: "EPSG:3857",
      center: fromLonLat([-60, -32]), // convierte lon/lat a 3857
      zoom: 5,
    });

    // ============================
    // 2) Mapa base OSM
    // ============================
    const baseLayer = new TileLayer({
      source: new OSM(),
    });

    // ============================
    // 3) Crear mapa
    // ============================
    const mapObj = new Map({
  target: mapRef.current,
  layers: [baseLayer],
  view,
  controls: defaultControls({
    attribution: false   // 👈 APAGA EL “OpenStreetMap contributors”
  }),
});


    // ============================
    // 4) Capas WMS de GeoServer
    // ============================
    const createdLayers = {};

    layersConfig.forEach((c) => {
      const layer = new ImageLayer({
        visible: false,
        source: new ImageWMS({
          url: URL_OGC,
          params: {
            LAYERS: c.id,
            VERSION: "1.1.0",
            SRS: "EPSG:4326",
            FORMAT: "image/png",
          },
          serverType: "geoserver",
        }),
      });

      mapObj.addLayer(layer);
      createdLayers[c.id] = layer;
    });

    setLayers(createdLayers);

    return () => mapObj.setTarget(null);
  }, []);

  const toggleLayer = (id) => {
    const layer = layers[id];
    if (!layer) return;
    layer.setVisible(!layer.getVisible());

    setLayers({
      ...layers,
      [id]: layer,
    });
  };

  return (
    <div style={{ display: "flex" }}>
      <div
        ref={mapRef}
        style={{ width: "75%", height: "100vh", border: "1px solid #ccc" }}
      />

      <div style={{ width: "25%", padding: 15 }}>
        <h3>Capas</h3>
        {layersConfig.map((c) => (
          <div key={c.id}>
            <input
              type="checkbox"
              checked={layers[c.id]?.getVisible() || false}
              onChange={() => toggleLayer(c.id)}
            />
            {c.title}
          </div>
        ))}
      </div>
    </div>
  );
}

