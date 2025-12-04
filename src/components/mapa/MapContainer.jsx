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
import { defaults as defaultInteractions, DragRotate, DragPan } from "ol/interaction";

import BaseMap from "./BaseMap";
import LayerManager from "../LayerManager";
import LayerPanel from "../layout/LayerPanel";
import ZoomControls from "./ZoomControls";
import ScaleBar from "./ScaleBar";
import Compass from "./Compass";
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
      interactions: defaultInteractions({
        altShiftDragRotate: false,
        shiftDragZoom: false,
      }),
    });

    // Configurar rotación manual con Ctrl + arrastrar usando eventos del DOM con captura
    let isRotating = false;
    let startAngle = 0;
    let startRotation = 0;
    let centerPixel = null;
    const mapElement = mapRef.current;
    
    const handlePointerDown = (e) => {
      // Solo activar si Ctrl o Cmd está presionado y es botón izquierdo
      if ((e.ctrlKey || e.metaKey) && e.button === 0) {
        isRotating = true;
        const view = mapObj.getView();
        const size = mapObj.getSize();
        if (!size) {
          isRotating = false;
          return;
        }
        
        // Centro del mapa en píxeles
        centerPixel = [size[0] / 2, size[1] / 2];
        
        // Obtener posición del puntero relativa al mapa
        const rect = mapElement.getBoundingClientRect();
        const pixel = [e.clientX - rect.left, e.clientY - rect.top];
        
        // Calcular ángulo inicial
        startAngle = Math.atan2(
          pixel[1] - centerPixel[1],
          pixel[0] - centerPixel[0]
        );
        startRotation = view.getRotation();
        
        // Prevenir comportamiento por defecto y propagación
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Cambiar cursor
        mapElement.style.cursor = 'grabbing';
      }
    };
    
    const handlePointerMove = (e) => {
      if (isRotating) {
        const view = mapObj.getView();
        const size = mapObj.getSize();
        if (!size) return;
        
        centerPixel = [size[0] / 2, size[1] / 2];
        
        // Obtener posición actual del puntero
        const rect = mapElement.getBoundingClientRect();
        const pixel = [e.clientX - rect.left, e.clientY - rect.top];
        
        // Calcular ángulo actual
        const currentAngle = Math.atan2(
          pixel[1] - centerPixel[1],
          pixel[0] - centerPixel[0]
        );
        
        // Calcular diferencia de ángulo
        const deltaAngle = currentAngle - startAngle;
        
        // Aplicar rotación
        view.setRotation(startRotation + deltaAngle);
        
        // Prevenir comportamiento por defecto
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    
    const handlePointerUp = (e) => {
      if (isRotating) {
        isRotating = false;
        mapElement.style.cursor = '';
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };
    
    // Agregar listeners con captura (true) para interceptar antes de OpenLayers
    if (mapElement) {
      mapElement.addEventListener('pointerdown', handlePointerDown, true);
      mapElement.addEventListener('pointermove', handlePointerMove, true);
      mapElement.addEventListener('pointerup', handlePointerUp, true);
      mapElement.addEventListener('pointercancel', handlePointerUp, true);
      
      // También manejar eventos de mouse como fallback
      mapElement.addEventListener('mousedown', handlePointerDown, true);
      mapElement.addEventListener('mousemove', handlePointerMove, true);
      mapElement.addEventListener('mouseup', handlePointerUp, true);
      mapElement.addEventListener('mouseleave', handlePointerUp, true);
    }

    const manager = new LayerManager(mapObj);

    manager.onChange = () => {
      setUpdate((u) => u + 1);
    };

    setLayerManager(manager);
    setMap(mapObj);

    return () => {
      // Limpiar event listeners del DOM
      if (mapElement) {
        mapElement.removeEventListener('pointerdown', handlePointerDown, true);
        mapElement.removeEventListener('pointermove', handlePointerMove, true);
        mapElement.removeEventListener('pointerup', handlePointerUp, true);
        mapElement.removeEventListener('pointercancel', handlePointerUp, true);
        mapElement.removeEventListener('mousedown', handlePointerDown, true);
        mapElement.removeEventListener('mousemove', handlePointerMove, true);
        mapElement.removeEventListener('mouseup', handlePointerUp, true);
        mapElement.removeEventListener('mouseleave', handlePointerUp, true);
      }
      mapObj.setTarget(null);
    };
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
            <Compass map={map} />
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
