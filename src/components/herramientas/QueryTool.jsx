import { useEffect, useRef, useState } from "react";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style";
import { GeoJSON } from "ol/format";
import { transform, fromLonLat, toLonLat } from "ol/proj";
import { Point, Polygon } from "ol/geom";
// Removido getDistance - usamos distancia euclidiana en coordenadas del mapa
import { URL_WFS } from "../../config";
import "./QueryTool.css";

export default function QueryTool({ map, activeTool, layerManager }) {
  const drawRef = useRef(null);
  const highlightLayerRef = useRef(null);
  const drawLayerRef = useRef(null);
  const [queryResults, setQueryResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const isDrawingRef = useRef(false);
  const startCoordRef = useRef(null);

  // Crear capa para resaltar features seleccionadas
  useEffect(() => {
    if (!map) return;

    const highlightSource = new VectorSource();
    const highlightLayer = new VectorLayer({
      source: highlightSource,
      style: new Style({
        stroke: new Stroke({
          color: "#ff0000",
          width: 3,
        }),
        fill: new Fill({
          color: "rgba(255, 0, 0, 0.2)",
        }),
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({
            color: "#ff0000",
          }),
          stroke: new Stroke({
            color: "#fff",
            width: 2,
          }),
        }),
      }),
    });

    highlightLayer.setZIndex(100);
    map.addLayer(highlightLayer);
    highlightLayerRef.current = highlightLayer;

    // Capa para dibujar el rectángulo de consulta
    const drawSource = new VectorSource();
    const drawLayer = new VectorLayer({
      source: drawSource,
      style: new Style({
        stroke: new Stroke({
          color: "#1a73e8",
          width: 2,
          lineDash: [5, 5],
        }),
        fill: new Fill({
          color: "rgba(26, 115, 232, 0.1)",
        }),
      }),
    });

    drawLayer.setZIndex(99);
    map.addLayer(drawLayer);
    drawLayerRef.current = drawLayer;

    return () => {
      map.removeLayer(highlightLayer);
      map.removeLayer(drawLayer);
      highlightLayerRef.current = null;
      drawLayerRef.current = null;
    };
  }, [map]);

  // Consultar features de capa de usuario (en memoria)
  const queryUserLayer = (layerId, coordinate, extent, isPointQuery) => {
    const userLayers = layerManager.getUserLayers();
    const userLayer = userLayers[layerId];
    
    if (!userLayer || !userLayer.getVisible()) {
      return [];
    }

    const source = userLayer.getSource();
    const features = source.getFeatures();
    const foundFeatures = [];

    features.forEach((feature) => {
      const geometry = feature.getGeometry();
      if (!geometry) return;

      let isInRange = false;

      if (isPointQuery) {
        // Para consulta por punto: verificar si está dentro del radio
        const closestPoint = geometry.getClosestPoint(coordinate);
        const dx = coordinate[0] - closestPoint[0];
        const dy = coordinate[1] - closestPoint[1];
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Radio de búsqueda en coordenadas del mapa (aproximadamente 50 píxeles)
        const view = map.getView();
        const resolution = view.getResolution();
        const searchRadiusPixels = 50;
        const searchRadius = resolution * searchRadiusPixels;
        
        isInRange = distance <= searchRadius;
      } else {
        // Para consulta por rectángulo: verificar si intersecta
        isInRange = geometry.intersectsExtent(extent);
      }

      if (isInRange) {
        foundFeatures.push(feature);
      }
    });

    return foundFeatures;
  };

  // Consulta WFS por punto (objeto más cercano)
  const queryByPoint = async (coordinate) => {
    const visibleLayers = layerManager.getVisibleLayers();
    
    if (visibleLayers.length === 0) {
      setQueryResults({
        message: "No hay capas visibles para consultar",
        features: [],
      });
      return;
    }

    setIsLoading(true);
    setQueryResults(null);
    setSelectedFeature(null);

    // Convertir coordenada a EPSG:4326
    const lonLat = toLonLat(coordinate, "EPSG:3857");
    
    // Calcular el radio de búsqueda basado en la resolución actual del mapa
    // Esto asegura que busquemos en un área razonable alrededor del punto
    const view = map.getView();
    const resolution = view.getResolution();
    const searchRadiusPixels = 50; // 50 píxeles de radio de búsqueda
    const searchRadiusMeters = resolution * searchRadiusPixels;
    
    // Convertir metros a grados (aproximación: 1 grado ≈ 111km)
    const searchRadiusDegrees = searchRadiusMeters / 111000;
    
    // Separar capas de usuario de capas de GeoServer
    const userLayerIds = [];
    const geoserverLayers = [];
    
    visibleLayers.forEach(layerName => {
      if (layerName.startsWith('user:')) {
        userLayerIds.push(layerName);
      } else {
        geoserverLayers.push(layerName);
      }
    });
    
    // Buscar el objeto más cercano en todas las capas
    const allFeatures = [];
    const layerResults = {};

    try {
      // Consultar capas de usuario (en memoria)
      userLayerIds.forEach(layerId => {
        const foundFeatures = queryUserLayer(layerId, coordinate, null, true);
        if (foundFeatures.length > 0) {
          // Encontrar la feature más cercana
          let closestFeature = null;
          let minDistance = Infinity;

          foundFeatures.forEach((feature) => {
            const geometry = feature.getGeometry();
            const closestPoint = geometry.getClosestPoint(coordinate);
            const dx = coordinate[0] - closestPoint[0];
            const dy = coordinate[1] - closestPoint[1];
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
              minDistance = distance;
              closestFeature = feature;
            }
          });

          if (closestFeature) {
            const displayName = layerId.replace('user:', '');
            const resolution = map.getView().getResolution();
            const latRad = (lonLat[1] * Math.PI) / 180;
            const metersPerUnit = Math.cos(latRad) * 111320;
            const distanceInMeters = minDistance * metersPerUnit;
            
            allFeatures.push({
              feature: closestFeature,
              layerName: layerId,
              distance: distanceInMeters / 1000,
              distancePixels: minDistance,
              properties: closestFeature.getProperties(),
            });
            layerResults[displayName] = 1;
          } else {
            layerResults[layerId.replace('user:', '')] = 0;
          }
        } else {
          layerResults[layerId.replace('user:', '')] = 0;
        }
      });

      // Consultar capas de GeoServer con WFS
      if (geoserverLayers.length > 0) {
        const bbox = [
          lonLat[0] - searchRadiusDegrees,
          lonLat[1] - searchRadiusDegrees,
          lonLat[0] + searchRadiusDegrees,
          lonLat[1] + searchRadiusDegrees,
        ].join(",");

        const queries = geoserverLayers.map(async (layerName) => {
        try {
          // Construir URL de WFS GetFeature con parámetros codificados
          const params = new URLSearchParams({
            service: 'WFS',
            version: '1.1.0',
            request: 'GetFeature',
            typeName: layerName,
            outputFormat: 'application/json',
            bbox: `${bbox},EPSG:4326`,
            // Sin límite de maxFeatures para obtener todos los elementos
          });
          
          const wfsUrl = `${URL_WFS}?${params.toString()}`;
          console.log('Consultando WFS:', wfsUrl);

          const response = await fetch(wfsUrl);
          
          if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
          }

          let data;
          try {
            const text = await response.text();
            console.log('Respuesta WFS (texto) para', layerName, ':', text.substring(0, 500));
            data = JSON.parse(text);
          } catch (parseError) {
            console.error('Error parseando JSON:', parseError);
            throw new Error(`Error parseando respuesta JSON: ${parseError.message}`);
          }
          
          console.log('Respuesta WFS (JSON) para', layerName, ':', data);
          console.log('Número de features en respuesta:', data.features?.length || 0);
          
          if (data.features && data.features.length > 0) {
            const format = new GeoJSON();
            let features;
            try {
              features = format.readFeatures(data, {
                featureProjection: "EPSG:3857",
                dataProjection: "EPSG:4326",
              });
              console.log('Features parseadas exitosamente:', features.length);
            } catch (parseError) {
              console.error('Error parseando features GeoJSON:', parseError);
              throw parseError;
            }

            // Calcular distancia euclidiana a cada feature y encontrar la más cercana
            let closestFeature = null;
            let minDistance = Infinity;

            features.forEach((feature) => {
              const geometry = feature.getGeometry();
              let distance = Infinity;

              if (geometry instanceof Point) {
                // Para puntos: distancia euclidiana en coordenadas del mapa
                const geomCoord = geometry.getCoordinates();
                const dx = coordinate[0] - geomCoord[0];
                const dy = coordinate[1] - geomCoord[1];
                distance = Math.sqrt(dx * dx + dy * dy);
              } else {
                // Para polígonos y líneas: distancia al punto más cercano en coordenadas del mapa
                const closestPoint = geometry.getClosestPoint(coordinate);
                const dx = coordinate[0] - closestPoint[0];
                const dy = coordinate[1] - closestPoint[1];
                distance = Math.sqrt(dx * dx + dy * dy);
              }

              if (distance < minDistance) {
                minDistance = distance;
                // Convertir distancia a metros para mostrar
                // En EPSG:3857, las coordenadas están en metros en el ecuador
                // Aproximamos multiplicando por el coseno de la latitud para mejor precisión
                const resolution = map.getView().getResolution();
                const center = map.getView().getCenter();
                const centerLonLat = toLonLat(center, "EPSG:3857");
                const latRad = (centerLonLat[1] * Math.PI) / 180;
                const metersPerUnit = Math.cos(latRad) * 111320; // metros por unidad en esta latitud
                const distanceInMeters = distance * metersPerUnit;
                
                closestFeature = { 
                  feature, 
                  layerName, 
                  distance: distanceInMeters / 1000, // En km para mostrar
                  distancePixels: distance, // Distancia en unidades del mapa (para comparación)
                  properties: feature.getProperties() 
                };
              }
            });

            if (closestFeature) {
              allFeatures.push(closestFeature);
              layerResults[layerName] = 1;
            } else {
              layerResults[layerName] = 0;
            }
          } else {
            layerResults[layerName] = 0;
          }
          } catch (error) {
            console.error(`Error consultando capa ${layerName}:`, error);
            layerResults[layerName] = `Error: ${error.message}`;
          }
        });

        await Promise.all(queries);
      }

      // Ordenar por distancia y tomar el más cercano de cada capa
      allFeatures.sort((a, b) => a.distance - b.distance);

      // Mostrar features en el mapa
      if (highlightLayerRef.current && allFeatures.length > 0) {
        const source = highlightLayerRef.current.getSource();
        source.clear();
        allFeatures.forEach(({ feature }) => {
          source.addFeature(feature);
        });
      }

      setQueryResults({
        message: allFeatures.length > 0
          ? `Se encontraron ${allFeatures.length} elemento(s) más cercano(s) en ${Object.keys(layerResults).filter(k => layerResults[k] === 1).length} capa(s)`
          : "No se encontraron elementos cerca del punto seleccionado",
        features: allFeatures,
        layerResults,
      });
    } catch (error) {
      console.error("Error en consulta WFS:", error);
      setQueryResults({
        message: `Error al consultar: ${error.message}`,
        features: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Consulta WFS por rectángulo (todos los objetos que intersecten)
  const queryByRectangle = async (extent) => {
    const visibleLayers = layerManager.getVisibleLayers();
    
    if (visibleLayers.length === 0) {
      setQueryResults({
        message: "No hay capas visibles para consultar",
        features: [],
      });
      return;
    }

    setIsLoading(true);
    setQueryResults(null);
    setSelectedFeature(null);

    // Convertir extent a EPSG:4326
    const minCoord = toLonLat([extent[0], extent[1]], "EPSG:3857");
    const maxCoord = toLonLat([extent[2], extent[3]], "EPSG:3857");
    const bbox = `${minCoord[0]},${minCoord[1]},${maxCoord[0]},${maxCoord[1]}`;

    // Separar capas de usuario de capas de GeoServer
    const userLayerIds = [];
    const geoserverLayers = [];
    
    visibleLayers.forEach(layerName => {
      if (layerName.startsWith('user:')) {
        userLayerIds.push(layerName);
      } else {
        geoserverLayers.push(layerName);
      }
    });

    const allFeatures = [];
    const layerResults = {};

    try {
      // Consultar capas de usuario (en memoria)
      // Convertir extent a coordenadas del mapa (EPSG:3857) para la intersección
      userLayerIds.forEach(layerId => {
        const foundFeatures = queryUserLayer(layerId, null, extent, false);
        if (foundFeatures.length > 0) {
          const displayName = layerId.replace('user:', '');
          foundFeatures.forEach(feature => {
            allFeatures.push({
              feature,
              layerName: layerId,
              properties: feature.getProperties(),
            });
          });
          layerResults[displayName] = foundFeatures.length;
        } else {
          layerResults[layerId.replace('user:', '')] = 0;
        }
      });

      // Consultar capas de GeoServer con WFS
      if (geoserverLayers.length > 0) {
        const queries = geoserverLayers.map(async (layerName) => {
          try {
            // Construir URL de WFS GetFeature con parámetros codificados
            const params = new URLSearchParams({
              service: 'WFS',
              version: '1.1.0',
              request: 'GetFeature',
              typeName: layerName,
              outputFormat: 'application/json',
              bbox: `${bbox},EPSG:4326`,
              // Sin límite de maxFeatures para obtener todos los elementos
            });
            
            const wfsUrl = `${URL_WFS}?${params.toString()}`;
            console.log('Consultando WFS (rectángulo):', wfsUrl);

          const response = await fetch(wfsUrl);
          
          if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
          }

          let data;
          try {
            const text = await response.text();
            console.log('Respuesta WFS (texto) para', layerName, ':', text.substring(0, 500));
            data = JSON.parse(text);
          } catch (parseError) {
            console.error('Error parseando JSON:', parseError);
            throw new Error(`Error parseando respuesta JSON: ${parseError.message}`);
          }
          
          console.log('Respuesta WFS (JSON) para', layerName, ':', data);
          console.log('Número de features en respuesta:', data.features?.length || 0);
          
          if (data.features && data.features.length > 0) {
            const format = new GeoJSON();
            let features;
            try {
              features = format.readFeatures(data, {
                featureProjection: "EPSG:3857",
                dataProjection: "EPSG:4326",
              });
              console.log('Features parseadas exitosamente:', features.length);
            } catch (parseError) {
              console.error('Error parseando features GeoJSON:', parseError);
              throw parseError;
            }

            // Filtrar features que realmente intersectan con el rectángulo
            const rectangle = new Polygon([[
              [extent[0], extent[1]],
              [extent[2], extent[1]],
              [extent[2], extent[3]],
              [extent[0], extent[3]],
              [extent[0], extent[1]],
            ]]);

            let intersectCount = 0;
            features.forEach((feature) => {
              const geometry = feature.getGeometry();
              // Verificar si la geometría intersecta con el rectángulo
              // (si al menos una parte del objeto está dentro del rectángulo)
              if (geometry.intersectsExtent(extent)) {
                allFeatures.push({
                  feature,
                  layerName,
                  properties: feature.getProperties(),
                });
                intersectCount++;
              }
            });

            layerResults[layerName] = intersectCount;
          } else {
            layerResults[layerName] = 0;
          }
          } catch (error) {
            console.error(`Error consultando capa ${layerName}:`, error);
            layerResults[layerName] = `Error: ${error.message}`;
          }
        });

        await Promise.all(queries);
      }

      // Mostrar features en el mapa
      if (highlightLayerRef.current && allFeatures.length > 0) {
        const source = highlightLayerRef.current.getSource();
        source.clear();
        allFeatures.forEach(({ feature }) => {
          source.addFeature(feature);
        });
      }

      setQueryResults({
        message: allFeatures.length > 0
          ? `Se encontraron ${allFeatures.length} elemento(s) en el área seleccionada`
          : "No se encontraron elementos en el área seleccionada",
        features: allFeatures,
        layerResults,
      });
    } catch (error) {
      console.error("Error en consulta WFS:", error);
      setQueryResults({
        message: `Error al consultar: ${error.message}`,
        features: [],
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar la herramienta de consulta
  useEffect(() => {
    if (!map || !layerManager || activeTool !== "query") {
      if (drawRef.current) {
        map.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
      if (highlightLayerRef.current) {
        highlightLayerRef.current.getSource().clear();
      }
      if (drawLayerRef.current) {
        drawLayerRef.current.getSource().clear();
      }
      setQueryResults(null);
      setSelectedFeature(null);
      isDrawingRef.current = false;
      startCoordRef.current = null;
      return;
    }

    // Limpiar dibujos anteriores
    if (drawLayerRef.current) {
      drawLayerRef.current.getSource().clear();
    }

    let rectangleFeature = null;

    // Manejar click izquierdo para consulta por punto
    const handleLeftClick = (event) => {
      if (isDrawingRef.current) return; // No hacer consulta si se está dibujando rectángulo
      const coordinate = event.coordinate;
      queryByPoint(coordinate);
    };

    // Manejar click derecho (manteniendo) para rectángulo
    const handleRightMouseDown = (event) => {
      // OpenLayers usa mapBrowserEvent
      const browserEvent = event.mapBrowserEvent || event;
      const originalEvent = browserEvent.originalEvent;
      if (!originalEvent || originalEvent.button !== 2) return; // Solo botón derecho
      originalEvent.preventDefault();
      
      isDrawingRef.current = true;
      startCoordRef.current = event.coordinate;
      
      // Crear feature temporal para el rectángulo
      const source = drawLayerRef.current.getSource();
      source.clear();
      
      rectangleFeature = new Polygon([[
        [startCoordRef.current[0], startCoordRef.current[1]],
        [startCoordRef.current[0], startCoordRef.current[1]],
        [startCoordRef.current[0], startCoordRef.current[1]],
        [startCoordRef.current[0], startCoordRef.current[1]],
        [startCoordRef.current[0], startCoordRef.current[1]],
      ]]);
      
      const feature = new Feature({
        geometry: rectangleFeature
      });
      source.addFeature(feature);
      
      // Actualizar rectángulo mientras se arrastra
      const updateRectangle = (currentCoord) => {
        if (!startCoordRef.current || !rectangleFeature) return;
        
        const extent = [
          Math.min(startCoordRef.current[0], currentCoord[0]),
          Math.min(startCoordRef.current[1], currentCoord[1]),
          Math.max(startCoordRef.current[0], currentCoord[0]),
          Math.max(startCoordRef.current[1], currentCoord[1]),
        ];
        
        rectangleFeature.setCoordinates([[
          [extent[0], extent[1]],
          [extent[2], extent[1]],
          [extent[2], extent[3]],
          [extent[0], extent[3]],
          [extent[0], extent[1]],
        ]]);
      };

      const handleMouseMove = (moveEvent) => {
        if (isDrawingRef.current && startCoordRef.current) {
          updateRectangle(moveEvent.coordinate);
        }
      };

      const handleRightMouseUp = (upEvent) => {
        const browserEvent = upEvent.mapBrowserEvent || upEvent;
        const originalEvent = browserEvent.originalEvent;
        if (!originalEvent || originalEvent.button !== 2) return;
        originalEvent.preventDefault();
        
        if (isDrawingRef.current && startCoordRef.current) {
          const endCoord = upEvent.coordinate;
          const extent = [
            Math.min(startCoordRef.current[0], endCoord[0]),
            Math.min(startCoordRef.current[1], endCoord[1]),
            Math.max(startCoordRef.current[0], endCoord[0]),
            Math.max(startCoordRef.current[1], endCoord[1]),
          ];
          
          queryByRectangle(extent);
          
          // Limpiar después de un momento
          setTimeout(() => {
            source.clear();
          }, 500);
        }
        
        isDrawingRef.current = false;
        startCoordRef.current = null;
        rectangleFeature = null;
        map.un("pointermove", handleMouseMove);
        map.un("pointerup", handleRightMouseUp);
      };

      map.on("pointermove", handleMouseMove);
      map.on("pointerup", handleRightMouseUp);
    };

    // Prevenir menú contextual del click derecho
    const handleContextMenu = (event) => {
      if (activeTool === "query") {
        event.preventDefault();
      }
    };

    // Escuchar eventos
    map.on("singleclick", handleLeftClick);
    
    // Escuchar pointerdown para detectar click derecho
    const handlePointerDown = (event) => {
      const browserEvent = event.mapBrowserEvent || event;
      const originalEvent = browserEvent.originalEvent;
      if (originalEvent && originalEvent.button === 2) {
        handleRightMouseDown(browserEvent);
      }
    };
    
    map.on("pointerdown", handlePointerDown);
    map.getViewport().addEventListener("contextmenu", handleContextMenu);

    return () => {
      map.un("singleclick", handleLeftClick);
      map.un("pointerdown", handlePointerDown);
      map.getViewport().removeEventListener("contextmenu", handleContextMenu);
      if (highlightLayerRef.current) {
        highlightLayerRef.current.getSource().clear();
      }
      if (drawLayerRef.current) {
        drawLayerRef.current.getSource().clear();
      }
      isDrawingRef.current = false;
      startCoordRef.current = null;
    };
  }, [activeTool, map, layerManager]);

  // Manejar selección de feature para mostrar detalles
  useEffect(() => {
    if (!map || activeTool !== "query" || isDrawingRef.current) return;

    const handleMapClick = (event) => {
      // Si hay resultados, verificar si se clickeó una feature
      if (queryResults && queryResults.features.length > 0 && highlightLayerRef.current) {
        const source = highlightLayerRef.current.getSource();
        const features = source.getFeatures();
        
        // Encontrar la feature más cercana al click
        let closestFeature = null;
        let minDistance = Infinity;
        const clickCoord = event.coordinate;

        features.forEach((feature) => {
          const geometry = feature.getGeometry();
          let distance = Infinity;

          if (geometry instanceof Point) {
            const geomCoord = geometry.getCoordinates();
            distance = Math.sqrt(
              Math.pow(clickCoord[0] - geomCoord[0], 2) +
              Math.pow(clickCoord[1] - geomCoord[1], 2)
            );
          } else {
            const closestPoint = geometry.getClosestPoint(clickCoord);
            distance = Math.sqrt(
              Math.pow(clickCoord[0] - closestPoint[0], 2) +
              Math.pow(clickCoord[1] - closestPoint[1], 2)
            );
          }

          if (distance < minDistance && distance < 20) { // 20 píxeles de tolerancia
            minDistance = distance;
            closestFeature = feature;
          }
        });

        if (closestFeature) {
          const found = queryResults.features.find(
            (f) => f.feature === closestFeature
          );
          if (found) {
            setSelectedFeature({
              ...found,
              geometry: closestFeature.getGeometry().getType(),
            });
          }
        }
      }
    };

    map.on("singleclick", handleMapClick);

    return () => {
      map.un("singleclick", handleMapClick);
    };
  }, [map, queryResults, activeTool]);

  if (activeTool !== "query") return null;

  return (
    <>
      <div className="query-hint">
        <span>📍 Click izquierdo: Consulta por punto</span>
        <span>▭ Click derecho (arrastrar): Consulta por rectángulo</span>
      </div>
      
      {isLoading && (
        <div className="query-loading">
          <div className="query-spinner"></div>
          <span>Consultando...</span>
        </div>
      )}

      {queryResults && (
        <div className="query-results">
          <div className="query-results-header">
            <h3>Resultados de Consulta WFS</h3>
            <button
              className="query-close"
              onClick={() => {
                setQueryResults(null);
                setSelectedFeature(null);
                if (highlightLayerRef.current) {
                  highlightLayerRef.current.getSource().clear();
                }
              }}
            >
              ✕
            </button>
          </div>
          
          <div className="query-results-body">
            <p className="query-message">{queryResults.message}</p>
            
            {queryResults.features.length > 0 && (
              <div className="query-features-list">
                <h4>Elementos encontrados ({queryResults.features.length}):</h4>
                <div className="query-features">
                  {queryResults.features.map((item, index) => (
                    <div
                      key={index}
                      className={`query-feature-item ${
                        selectedFeature?.feature === item.feature
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => {
                        // No limpiar el source, mantener todas las features resaltadas
                        // Solo actualizar la feature seleccionada para mostrar detalles
                        setSelectedFeature({
                          ...item,
                          geometry: item.feature.getGeometry().getType(),
                        });
                      }}
                    >
                      <div className="query-feature-header">
                        <strong>{item.layerName.split(":")[1]}</strong>
                        <span className="query-feature-type">
                          {item.feature.getGeometry().getType()}
                        </span>
                      </div>
                      {item.distance && (
                        <div className="query-feature-distance">
                          Distancia: {item.distance.toFixed(2)} km
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedFeature && (
              <div className="query-feature-details">
                <h4>Detalles del Elemento</h4>
                <div className="query-details-content">
                  <div className="query-detail-row">
                    <strong>Capa:</strong>
                    <span>{selectedFeature.layerName}</span>
                  </div>
                  <div className="query-detail-row">
                    <strong>Geometría:</strong>
                    <span>{selectedFeature.geometry}</span>
                  </div>
                  {selectedFeature.distance && (
                    <div className="query-detail-row">
                      <strong>Distancia:</strong>
                      <span>{selectedFeature.distance.toFixed(2)} km</span>
                    </div>
                  )}
                  <div className="query-details-table">
                    <h5>Atributos:</h5>
                    <table>
                      <tbody>
                        {Object.entries(selectedFeature.properties)
                          .filter(([key]) => key !== "geometry")
                          .map(([key, value]) => (
                            <tr key={key}>
                              <td className="query-attr-name">{key}:</td>
                              <td className="query-attr-value">
                                {value !== null && value !== undefined
                                  ? String(value)
                                  : "(vacío)"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(queryResults.layerResults).length > 0 && (
              <div className="query-layer-summary">
                <h4>Resumen por Capa:</h4>
                <ul>
                  {Object.entries(queryResults.layerResults).map(
                    ([layer, count]) => (
                      <li key={layer}>
                        <strong>{layer.split(":")[1]}:</strong>{" "}
                        {typeof count === "number" ? `${count} elemento(s)` : count}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
