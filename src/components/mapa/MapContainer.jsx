import React, { useRef, useEffect, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls } from "ol/control";

import BaseMap from "./BaseMap";
import LayerManager from "../LayerManager";
import LayerPanel from "../layout/LayerPanel";
import ZoomControls from "./ZoomControls";
import ScaleBar from "./ScaleBar";
import SearchBar from "../layout/SearchBar";
import ToolButtons from "../herramientas/ToolButtons";
import MapTypeControl from "../herramientas/MapTypeControl";
import MapTools from "../herramientas/MapTools";
import QueryTool from "../herramientas/QueryTool";
import DrawTool from "../herramientas/DrawTool";

export default function MapContainer() {
  const mapRef = useRef();
  const [map, setMap] = useState(null);
  const [layerManager, setLayerManager] = useState(null);
  const [update, setUpdate] = useState(0);
  const [baseLayer, setBaseLayer] = useState(null);
  const [baseStyle, setBaseStyle] = useState("standard");
  const [activeTool, setActiveTool] = useState(null);

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
      controls: defaultControls({
        attribution: false,
        zoom: false,
        rotate: false,
      }),
    });

    const manager = new LayerManager(mapObj);

    manager.onChange = () => {
      setUpdate((u) => u + 1);
    };

    setLayerManager(manager);
    setMap(mapObj);

    return () => mapObj.setTarget(null);
  }, []);

  useEffect(() => {
    if (!map) return;

    if (baseLayer) {
      map.removeLayer(baseLayer);
    }

    const newBase = BaseMap(map, baseStyle);
    setBaseLayer(newBase);
  }, [baseStyle, map]);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <LayerPanel layerManager={layerManager} update={update} />
      
      <div
        ref={mapRef}
        style={{ 
          flex: 1, 
          height: "100vh", 
          position: "relative",
          backgroundColor: "#e5e3df"
        }}
      >
        {map && (
          <>
            <SearchBar />
            <ZoomControls map={map} />
            <ScaleBar map={map} />
            <ToolButtons activeTool={activeTool} onChange={setActiveTool} />
            <MapTools map={map} activeTool={activeTool} />
            <QueryTool map={map} activeTool={activeTool} layerManager={layerManager} />
            <DrawTool map={map} activeTool={activeTool} layerManager={layerManager} onToolChange={setActiveTool} />
            <MapTypeControl activeStyle={baseStyle} onChange={setBaseStyle} />
          </>
        )}
      </div>
    </div>
  );
}
