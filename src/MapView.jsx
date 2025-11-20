import React, { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import ImageWMS from "ol/source/ImageWMS";
import TileWMS from "ol/source/TileWMS";
import { URL_OGC } from "./config";
import { layersConfig } from "./layers";

export default function MapView() {
  const mapRef = useRef();
  const [, setMap] = useState(null); // no necesitamos leer map
  const [layers, setLayers] = useState({});

  useEffect(() => {

    // -----------------------------
    // 🌎 Capa base IGN en EPSG:4326
    // -----------------------------
    const baseLayer = new TileLayer({
      source: new TileWMS({
        url: "https://wms.ign.gob.ar/geoserver/ows",
        params: {
          LAYERS: "ign:provincia",
          VERSION: "1.3.0",
        },
      }),
    });

    // -----------------------------
    // 🗂 Capas WMS de GeoServer
    // -----------------------------
    const wmsLayers = {};
    layersConfig.forEach((c) => {
      wmsLayers[c.id] = new ImageLayer({
        visible: false,
        source: new ImageWMS({
          url: URL_OGC,
          params: { LAYERS: c.id, TILED: true },
          serverType: "geoserver",
        }),
      });
    });

    // -----------------------------
    // 🗺 Crear el mapa
    // -----------------------------
    const mapObject = new Map({
      target: mapRef.current,
      layers: [baseLayer, ...Object.values(wmsLayers)],
      view: new View({
        projection: "EPSG:4326",
        center: [-60, -32],
        zoom: 5,
      }),
    });

    setLayers(wmsLayers);
    setMap(mapObject);

  }, []);

  // -----------------------------
  // 🔘 Activar/desactivar capas
  // -----------------------------
  const toggleLayer = (id) => {
    const layer = layers[id];
    if (layer) {
      layer.setVisible(!layer.getVisible());
      setLayers({ ...layers });
    }
    console.log("Activando capa:", id);
  };

  return (
    <div style={{ display: "flex" }}>
      <div
        ref={mapRef}
        style={{ width: "75%", height: "100vh", border: "1px solid #ccc" }}
      />

      <div
        style={{
          width: "25%",
          padding: "15px",
          background: "#f3f3f3",
          borderLeft: "1px solid #ccc",
        }}
      >
        <h2>Capas</h2>

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
