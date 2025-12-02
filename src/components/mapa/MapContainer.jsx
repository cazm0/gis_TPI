/**
 * MapContainer - Contenedor principal del mapa
 * 
 * Componente raíz que:
 * - Inicializa el mapa de OpenLayers
 * - Crea el LayerManager
 * - Integra todos los componentes (panel de capas, herramientas, controles)
 * - Maneja el estado de las herramientas activas
 * 
 * Es el componente principal que orquesta toda la aplicación GIS
 */

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
import QueryTool from "../herramientas/QueryTool";
import DrawTool from "../herramientas/DrawTool";
import MeasureTool from "../herramientas/MeasureTool";
import PrintTool from "../herramientas/PrintTool";
import ActiveLayersLegend from "../layout/ActiveLayersLegend";

/**
 * Componente MapContainer
 * Componente principal que contiene todo el mapa y sus controles
 */
export default function MapContainer() {
  const mapRef = useRef();
  const [map, setMap] = useState(null);
  const [layerManager, setLayerManager] = useState(null);
  const [update, setUpdate] = useState(0);
  const [baseLayer, setBaseLayer] = useState(null);
  const [baseStyle, setBaseStyle] = useState("standard");
  const [activeTool, setActiveTool] = useState(null);
  const [drawGeometryType, setDrawGeometryType] = useState("Point");
  const [measureType, setMeasureType] = useState("length");
  const measureToolRef = useRef(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseStyle, map]); // baseLayer se excluye intencionalmente para evitar loop infinito

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
            <SearchBar 
              map={map} 
              activeTool={activeTool}
              measureType={measureType}
              measureToolRef={measureToolRef}
            />
            <ZoomControls map={map} />
            <ScaleBar map={map} />
            <QueryTool map={map} activeTool={activeTool} layerManager={layerManager} />
            <DrawTool 
              map={map} 
              activeTool={activeTool} 
              layerManager={layerManager} 
              onToolChange={setActiveTool}
              geometryType={drawGeometryType}
              onGeometryTypeChange={setDrawGeometryType}
            />
            <MeasureTool 
              ref={measureToolRef}
              map={map} 
              activeTool={activeTool}
              measureType={measureType}
              onMeasureTypeChange={setMeasureType}
            />
            <ToolButtons 
              activeTool={activeTool} 
              onChange={setActiveTool}
              toolContent={{
                query: activeTool === "query" ? (
                  <div className="query-hint-inline">
                    <div>📍 Click izquierdo: Consulta por punto</div>
                    <div>▭ Click derecho (arrastrar): Consulta por rectángulo</div>
                  </div>
                ) : null,
                draw: activeTool === "draw" ? (
                  <div className="draw-tool-controls-inline">
                    <div className="geometry-type-selector">
                      <label>Tipo de geometría:</label>
                      <select
                        value={drawGeometryType}
                        onChange={(e) => setDrawGeometryType(e.target.value)}
                      >
                        <option value="Point">Punto</option>
                        <option value="LineString">Línea</option>
                        <option value="Polygon">Polígono</option>
                      </select>
                    </div>
                  </div>
                ) : null,
                measure: activeTool === "measure" ? (
                  <div className="measure-tool-controls-inline">
                    <div className="measure-type-selector">
                      <label>Tipo de medición:</label>
                      <select
                        value={measureType}
                        onChange={(e) => setMeasureType(e.target.value)}
                      >
                        <option value="length">Longitud</option>
                        <option value="area">Área</option>
                      </select>
                    </div>
                  </div>
                ) : null,
              }}
            />
            <PrintTool map={map} layerManager={layerManager} activeTool={activeTool} />
            <ActiveLayersLegend layerManager={layerManager} update={update} />
            <MapTypeControl activeStyle={baseStyle} onChange={setBaseStyle} />
          </>
        )}
      </div>
    </div>
  );
}
