import React, { useRef, useEffect, useState } from "react";
import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls } from "ol/control";
import { defaults as defaultInteractions, DragRotate, DragPan } from "ol/interaction";
import { Modify, Select } from "ol/interaction";
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

const DEFAULT_WAYPOINT_TYPES = [
  { id: "home", label: "Casa", color: "#e53935" },
  { id: "work", label: "Trabajo", color: "#1e88e5" },
  { id: "school", label: "Escuela", color: "#43a047" },
  { id: "poi", label: "Punto de interés", color: "#fb8c00" },
];

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
  const [waypointLayer, setWaypointLayer] = useState(null);
  const [waypointTypes, setWaypointTypes] = useState(DEFAULT_WAYPOINT_TYPES);
  const [selectedWaypointType, setSelectedWaypointType] = useState(DEFAULT_WAYPOINT_TYPES[0].id);
  const [newWaypointLabel, setNewWaypointLabel] = useState("");
  const [newWaypointColor, setNewWaypointColor] = useState("#ff5252");
  const [waypointsList, setWaypointsList] = useState([]);
  const [isAddingWaypoint, setIsAddingWaypoint] = useState(false);
  const [newWaypointName, setNewWaypointName] = useState("");
  const modifyInteractionRef = useRef(null);
  const selectInteractionRef = useRef(null);

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

    // Capa para waypoints personalizados
    const waypointSource = new VectorSource();
    const waypointLayerObj = new VectorLayer({
      source: waypointSource,
      zIndex: 900,
    });
    mapObj.addLayer(waypointLayerObj);

    const manager = new LayerManager(mapObj);

    manager.onChange = () => {
      setUpdate((u) => u + 1);
    };

    setLocationLayer(locLayer);
    setWaypointLayer(waypointLayerObj);
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
      mapObj.removeLayer(waypointLayerObj);
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

  // Función helper para crear estilo de waypoint
  const createWaypointStyle = (type, isSelected = false) => {
    return new Style({
      image: new CircleStyle({
        radius: isSelected ? 9 : 7,
        fill: new Fill({
          color: type.color,
        }),
        stroke: new Stroke({
          color: isSelected ? "#ffeb3b" : "#ffffff",
          width: isSelected ? 3 : 2,
        }),
      }),
    });
  };

  // Interacciones para mover y seleccionar waypoints
  useEffect(() => {
    if (!map || !waypointLayer) return;

    // Remover interacciones existentes si las hay
    if (modifyInteractionRef.current) {
      map.removeInteraction(modifyInteractionRef.current);
      modifyInteractionRef.current = null;
    }
    if (selectInteractionRef.current) {
      map.removeInteraction(selectInteractionRef.current);
      selectInteractionRef.current = null;
    }

    // Solo activar interacciones cuando la herramienta waypoints está activa
    if (activeTool !== "waypoints") {
      return;
    }

    const source = waypointLayer.getSource();

    // Interacción de selección
    const selectInteraction = new Select({
      layers: [waypointLayer],
      style: (feature) => {
        const waypointTypeId = feature.get("waypointType");
        const type = waypointTypes.find((t) => t.id === waypointTypeId);
        if (!type) return null;
        return createWaypointStyle(type, true);
      },
    });

    // Interacción de modificación (arrastrar)
    const modifyInteraction = new Modify({
      features: selectInteraction.getFeatures(),
    });

    map.addInteraction(selectInteraction);
    map.addInteraction(modifyInteraction);

    selectInteractionRef.current = selectInteraction;
    modifyInteractionRef.current = modifyInteraction;

    // Manejar tecla Delete para borrar marcadores seleccionados
    const handleKeyDown = (event) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        const selectedFeatures = selectInteraction.getFeatures();
        if (selectedFeatures.getLength() > 0) {
          selectedFeatures.forEach((feature) => {
            source.removeFeature(feature);
          });
          selectedFeatures.clear();
        }
      }
    };

    const mapElement = map.getTargetElement();
    if (mapElement) {
      mapElement.addEventListener("keydown", handleKeyDown);
      mapElement.setAttribute("tabindex", "0"); // Hacer el mapa focusable para recibir eventos de teclado
    }

    return () => {
      if (modifyInteractionRef.current) {
        map.removeInteraction(modifyInteractionRef.current);
        modifyInteractionRef.current = null;
      }
      if (selectInteractionRef.current) {
        map.removeInteraction(selectInteractionRef.current);
        selectInteractionRef.current = null;
      }
      if (mapElement) {
        mapElement.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [map, waypointLayer, activeTool, waypointTypes]);

  // Mantener lista de waypoints actualizada
  useEffect(() => {
    if (!waypointLayer) return;

    const source = waypointLayer.getSource();
    
    const updateWaypointsList = () => {
      const features = source.getFeatures();
      const waypoints = features.map((feature, index) => {
        const waypointTypeId = feature.get("waypointType");
        const type = waypointTypes.find((t) => t.id === waypointTypeId);
        const geometry = feature.getGeometry();
        const coordinate = geometry.getCoordinates();
        const waypointName = feature.get("waypointName") || `Waypoint ${index + 1}`;
        
        return {
          id: feature.getId() || `waypoint-${index}`,
          feature: feature,
          name: waypointName,
          type: type?.label || "Sin tipo",
          typeId: waypointTypeId,
          color: type?.color || "#666",
          coordinate: coordinate,
        };
      });
      setWaypointsList(waypoints);
    };

    updateWaypointsList();

    // Escuchar cambios en la fuente
    source.on("add", updateWaypointsList);
    source.on("remove", updateWaypointsList);
    source.on("change", updateWaypointsList);

    return () => {
      source.un("add", updateWaypointsList);
      source.un("remove", updateWaypointsList);
      source.un("change", updateWaypointsList);
    };
  }, [waypointLayer, waypointTypes]);

  // Actualizar estilos de waypoints existentes cuando cambian los tipos
  useEffect(() => {
    if (!waypointLayer) return;

    const source = waypointLayer.getSource();
    source.getFeatures().forEach((feature) => {
      const waypointTypeId = feature.get("waypointType");
      const type = waypointTypes.find((t) => t.id === waypointTypeId);
      if (type) {
        // Solo actualizar si no está seleccionado (para no interferir con el estilo de selección)
        const isSelected = selectInteractionRef.current?.getFeatures().getArray().includes(feature);
        if (!isSelected) {
          feature.setStyle(createWaypointStyle(type));
        }
      }
    });
  }, [waypointLayer, waypointTypes]);

  // Desactivar modo agregar cuando se desactiva la herramienta waypoints
  useEffect(() => {
    if (activeTool !== "waypoints") {
      setIsAddingWaypoint(false);
      setNewWaypointName("");
    }
  }, [activeTool]);

  // Cambiar cursor cuando está en modo agregar waypoint
  useEffect(() => {
    if (!map) return;

    const mapElement = map.getTargetElement();
    if (!mapElement) return;

    if (isAddingWaypoint && activeTool === "waypoints") {
      mapElement.style.cursor = "crosshair";
    } else {
      mapElement.style.cursor = "";
    }

    return () => {
      if (mapElement) {
        mapElement.style.cursor = "";
      }
    };
  }, [map, isAddingWaypoint, activeTool]);

  // Agregar waypoint en clic cuando la herramienta está activa y el modo agregar está activo
  useEffect(() => {
    if (!map || !waypointLayer) return;

    const handleMapClick = (event) => {
      if (activeTool !== "waypoints" || !isAddingWaypoint) return;

      // No agregar waypoint si se está haciendo clic en un marcador existente
      const pixel = map.getEventPixel(event.originalEvent);
      const features = map.getFeaturesAtPixel(pixel, {
        layerFilter: (layer) => layer === waypointLayer,
      });
      if (features && features.length > 0) {
        return; // Si hay un marcador en ese punto, no agregar uno nuevo
      }

      const coordinate = event.coordinate;
      const type = waypointTypes.find((t) => t.id === selectedWaypointType);
      if (!type) return;

      const waypointName = newWaypointName.trim() || `Waypoint ${Date.now()}`;

      const feature = new Feature({
        geometry: new Point(coordinate),
        waypointType: type.id,
        label: type.label,
        waypointName: waypointName,
      });

      // Asignar ID único al waypoint
      feature.setId(`waypoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

      feature.setStyle(createWaypointStyle(type));
      const source = waypointLayer.getSource();
      source.addFeature(feature);

      // Desactivar modo agregar y limpiar nombre
      setIsAddingWaypoint(false);
      setNewWaypointName("");
    };

    map.on("singleclick", handleMapClick);

    return () => {
      map.un("singleclick", handleMapClick);
    };
  }, [map, waypointLayer, activeTool, waypointTypes, selectedWaypointType, isAddingWaypoint, newWaypointName]);

  const handleAddWaypointType = (e) => {
    e.preventDefault();
    const label = newWaypointLabel.trim();
    if (!label) return;

    const id = `custom-${Date.now()}`;
    const newType = {
      id,
      label,
      color: newWaypointColor || "#ff5252",
    };

    setWaypointTypes((prev) => [...prev, newType]);
    setSelectedWaypointType(id);
    setNewWaypointLabel("");
  };

  const handleSelectWaypoint = (waypoint) => {
    if (!map || !waypointLayer || !selectInteractionRef.current) return;

    const source = waypointLayer.getSource();
    const feature = waypoint.feature;

    // Limpiar selección anterior
    selectInteractionRef.current.getFeatures().clear();

    // Seleccionar el waypoint
    selectInteractionRef.current.getFeatures().push(feature);

    // Centrar el mapa en el waypoint
    const view = map.getView();
    view.animate({
      center: waypoint.coordinate,
      zoom: Math.max(view.getZoom() || 5, 15),
      duration: 500,
    });

    // Asegurar que el mapa tenga foco para poder usar Delete
    const mapElement = map.getTargetElement();
    if (mapElement) {
      mapElement.focus();
    }
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
                waypoints: activeTool === "waypoints" ? (
                  <div className="waypoints-tool-controls-inline">
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: "#333" }}>
                          Tipo de marcador:
                        </label>
                        <select
                          value={selectedWaypointType}
                          onChange={(e) => setSelectedWaypointType(e.target.value)}
                          style={{
                            padding: "6px 8px",
                            border: "1px solid #ddd",
                            borderRadius: 4,
                            fontSize: 13,
                            background: "white",
                            cursor: "pointer",
                          }}
                        >
                          {waypointTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: "#333" }}>
                          Nombre del waypoint:
                        </label>
                        <input
                          type="text"
                          value={newWaypointName}
                          onChange={(e) => setNewWaypointName(e.target.value)}
                          placeholder="Ingresa un nombre..."
                          disabled={isAddingWaypoint}
                          style={{
                            padding: "6px 8px",
                            border: "1px solid #ddd",
                            borderRadius: 4,
                            fontSize: 13,
                            backgroundColor: isAddingWaypoint ? "#f5f5f5" : "white",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (isAddingWaypoint) {
                              setIsAddingWaypoint(false);
                              setNewWaypointName("");
                            } else {
                              setIsAddingWaypoint(true);
                            }
                          }}
                          style={{
                            padding: "8px 12px",
                            borderRadius: 4,
                            border: "none",
                            backgroundColor: isAddingWaypoint ? "#f44336" : "#1a73e8",
                            color: "white",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                          }}
                        >
                          {isAddingWaypoint ? "Cancelar" : "Agregar waypoint"}
                        </button>
                        {isAddingWaypoint && (
                          <div style={{ fontSize: 11, color: "#666", fontStyle: "italic" }}>
                            Haz clic en el mapa para colocar el waypoint
                          </div>
                        )}
                      </div>

                      <form
                        onSubmit={handleAddWaypointType}
                        style={{ display: "flex", flexDirection: "column", gap: 6 }}
                      >
                        <label style={{ fontSize: 12, fontWeight: 500, color: "#333" }}>
                          Crear nuevo tipo:
                        </label>
                        <input
                          type="text"
                          value={newWaypointLabel}
                          onChange={(e) => setNewWaypointLabel(e.target.value)}
                          placeholder="Nombre del marcador"
                          style={{
                            padding: "6px 8px",
                            border: "1px solid #ddd",
                            borderRadius: 4,
                            fontSize: 13,
                          }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <label
                            style={{
                              fontSize: 12,
                              color: "#555",
                              minWidth: 60,
                            }}
                          >
                            Color:
                          </label>
                          <input
                            type="color"
                            value={newWaypointColor}
                            onChange={(e) => setNewWaypointColor(e.target.value)}
                            style={{ width: 32, height: 24, padding: 0, border: "none" }}
                          />
                        </div>
                        <button
                          type="submit"
                          style={{
                            marginTop: 4,
                            alignSelf: "flex-start",
                            padding: "6px 10px",
                            borderRadius: 4,
                            border: "none",
                            backgroundColor: "#1a73e8",
                            color: "white",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Agregar tipo
                        </button>
                      </form>

                      {waypointsList.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                          <label style={{ fontSize: 12, fontWeight: 500, color: "#333" }}>
                            Waypoints existentes ({waypointsList.length}):
                          </label>
                          <div
                            style={{
                              maxHeight: "72px", // Aproximadamente 2 elementos (36px cada uno)
                              overflowY: "auto",
                              border: "1px solid #ddd",
                              borderRadius: 4,
                              padding: 4,
                            }}
                          >
                            {waypointsList.map((waypoint) => (
                              <div
                                key={waypoint.id}
                                onClick={() => handleSelectWaypoint(waypoint)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "6px 8px",
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  backgroundColor: "transparent",
                                  transition: "background-color 0.2s",
                                  minHeight: "32px",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#f5f5f5";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "transparent";
                                }}
                              >
                                <div
                                  style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    backgroundColor: waypoint.color,
                                    border: "2px solid #fff",
                                    boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
                                    flexShrink: 0,
                                  }}
                                />
                                <div style={{ flex: 1, fontSize: 12, color: "#333", display: "flex", flexDirection: "column", gap: 2 }}>
                                  <div style={{ fontWeight: 500 }}>{waypoint.name}</div>
                                  <div style={{ fontSize: 10, color: "#666" }}>{waypoint.type}</div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const source = waypointLayer.getSource();
                                    source.removeFeature(waypoint.feature);
                                  }}
                                  style={{
                                    padding: "2px 6px",
                                    fontSize: 10,
                                    border: "none",
                                    borderRadius: 3,
                                    backgroundColor: "#f44336",
                                    color: "white",
                                    cursor: "pointer",
                                    flexShrink: 0,
                                  }}
                                  title="Eliminar waypoint"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
                        <div>• Haz clic en el mapa para agregar un marcador</div>
                        <div>• Selecciona un waypoint de la lista para centrarlo</div>
                        <div>• Arrastra un marcador para moverlo</div>
                        <div>• Selecciona un marcador y presiona Delete para borrarlo</div>
                      </div>
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
