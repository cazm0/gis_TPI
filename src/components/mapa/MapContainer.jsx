import React, { useRef, useEffect, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls } from "ol/control";
import { defaults as defaultInteractions, DragRotate, DragPan } from "ol/interaction";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import { Circle as CircleGeom } from "ol/geom";
import Style from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import { Circle as CircleStyle } from "ol/style";

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
  const [isLocating, setIsLocating] = useState(false);
  const [locationLayer, setLocationLayer] = useState(null);

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

    // Capa para la ubicación del usuario (punto + círculo de precisión)
    const locSource = new VectorSource();
    const locLayer = new VectorLayer({
      source: locSource,
      zIndex: 1000,
    });
    mapObj.addLayer(locLayer);

    const manager = new LayerManager(mapObj);

    manager.onChange = () => {
      setUpdate((u) => u + 1);
    };

    setLocationLayer(locLayer);
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
      mapObj.removeLayer(locLayer);
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

  const handleGoToMyLocation = () => {
    if (!map || !navigator.geolocation) {
      alert("La geolocalización no está soportada en este navegador.");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const view = map.getView();
        const center = fromLonLat([longitude, latitude]);

        // Actualizar capa de ubicación si existe
        if (locationLayer) {
          const source = locationLayer.getSource();
          source.clear();

          const pointFeature = new Feature({
            geometry: new Point(center),
          });

          let accuracyFeature = null;
          if (accuracy && !isNaN(accuracy)) {
            accuracyFeature = new Feature({
              geometry: new CircleGeom(center, accuracy),
            });
          }

          const pointStyle = new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({
                color: "#1a73e8",
              }),
              stroke: new Stroke({
                color: "#ffffff",
                width: 2,
              }),
            }),
          });

          const accuracyStyle = new Style({
            fill: new Fill({
              color: "rgba(66, 133, 244, 0.15)",
            }),
            stroke: new Stroke({
              color: "rgba(66, 133, 244, 0.6)",
              width: 1,
            }),
          });

          pointFeature.setStyle(pointStyle);
          if (accuracyFeature) {
            accuracyFeature.setStyle(accuracyStyle);
            source.addFeature(accuracyFeature);
          }
          source.addFeature(pointFeature);
        }

        view.animate({
          center,
          zoom: Math.max(view.getZoom() || 5, 15),
          duration: 1000,
        });

        setIsLocating(false);
      },
      (error) => {
        console.error("Error al obtener la ubicación:", error);
        let message = "No se pudo obtener la ubicación.";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Permiso de geolocalización denegado.";
        } else if (error.code === error.TIMEOUT) {
          message = "La solicitud de geolocalización expiró.";
        }
        alert(message);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

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
            <button
              type="button"
              onClick={handleGoToMyLocation}
              disabled={isLocating}
              style={{
                position: "absolute",
                bottom: "70px",
                left: "20px",
                zIndex: 1000,
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "none",
                backgroundColor: "#ffffff",
                cursor: isLocating ? "default" : "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isLocating ? "#a0a0a0" : "#5f6368",
              }}
              title="Ir a mi ubicación"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 8a4 4 0 100 8 4 4 0 000-8zm7 3h-1.07A5.994 5.994 0 0013 6.07V5a1 1 0 10-2 0v1.07A5.994 5.994 0 006.07 11H5a1 1 0 100 2h1.07A5.994 5.994 0 0011 17.93V19a1 1 0 102 0v-1.07A5.994 5.994 0 0017.93 13H19a1 1 0 100-2z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
