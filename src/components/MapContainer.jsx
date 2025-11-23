import React, { useRef, useEffect, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls } from "ol/control";

import BaseMap from "./BaseMap";
import LayerManager from "./LayerManager";
import LayerPanel from "./LayerPanel";

export default function MapContainer() {
  const mapRef = useRef();
  const [map, setMap] = useState(null);
  const [layerManager, setLayerManager] = useState(null);
  const [update, setUpdate] = useState(0); // <-- NUEVO

  useEffect(() => {
    const view = new View({
      projection: "EPSG:3857",
      center: fromLonLat([-60, -32]),
      zoom: 5,
    });

    const mapObj = new Map({
      target: mapRef.current,
      view,
      layers: [],
      controls: defaultControls({ attribution: false }),
    });

    BaseMap(mapObj);

    const manager = new LayerManager(mapObj);

    manager.onChange = () => {
      setUpdate((u) => u + 1); // <-- Fuerza rerender
    };

    setLayerManager(manager);
    setMap(mapObj);

    return () => mapObj.setTarget(null);
  }, []);

  return (
    <div style={{ display: "flex" }}>
      <div
        ref={mapRef}
        style={{ width: "75%", height: "100vh", border: "1px solid #ccc" }}
      />

      {/* use update to rerender */}
      <LayerPanel layerManager={layerManager} key={update} />
    </div>
  );
}
