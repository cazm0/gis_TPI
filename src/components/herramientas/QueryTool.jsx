/**
 * QueryTool - Herramienta para consultar información de features en el mapa
 * 
 * Permite al usuario:
 * - Consultar por punto: Click izquierdo para encontrar el objeto más cercano
 * - Consultar por rectángulo: Click derecho y arrastrar para seleccionar un área
 * 
 * Consulta tanto capas de GeoServer (usando WFS) como capas de usuario (en memoria)
 * Muestra resultados con atributos y permite seleccionar features para ver detalles
 */

import { useEffect, useRef, useState, useCallback } from "react";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style";
import { GeoJSON } from "ol/format";
import { toLonLat } from "ol/proj";
import { Point, Polygon } from "ol/geom";
// Nota: Usamos distancia euclidiana en coordenadas del mapa en lugar de getDistance
import { getLength, getDistance } from "ol/sphere";
import { URL_WFS } from "../../config";
import { layersConfig } from "../../layers";
import "./QueryTool.css";

/**
 * Componente QueryTool
 * @param {ol.Map} map - Instancia del mapa de OpenLayers
 * @param {string} activeTool - Herramienta actualmente activa (debe ser "query" para activarse)
 * @param {LayerManager} layerManager - Gestor de capas
 */
export default function QueryTool({ map, activeTool, layerManager }) {
  const drawRef = useRef(null);
  const highlightLayerRef = useRef(null);
  const selectedFeatureLayerRef = useRef(null);
  const drawLayerRef = useRef(null);
  const [queryResults, setQueryResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [selectedAttribute, setSelectedAttribute] = useState("");
  const [statisticType, setStatisticType] = useState("count");
  const [statisticResult, setStatisticResult] = useState(null);
  const isDrawingRef = useRef(false);
  const startCoordRef = useRef(null);

  /**
   * Obtiene el nombre de visualización legible de una capa
   * Para capas de usuario, obtiene el título guardado
   * Para capas de GeoServer, busca en la configuración
   * @param {string} layerName - Nombre de la capa (formato "workspace:layerName" o "user:layerName")
   * @returns {string} Nombre legible para mostrar
   */
  const getLayerDisplayName = useCallback((layerName) => {
    if (layerName.startsWith('user:')) {
      // Para capas de usuario, obtener el título de la capa
      const userLayer = layerManager?.userLayers?.[layerName];
      if (userLayer) {
        return userLayer.get('title') || layerName.replace('user:', '');
      }
      return layerName.replace('user:', '');
    } else {
      // Para capas de GeoServer, buscar en la configuración
      // Primero intentar coincidencia exacta
      let layerConfig = layersConfig.find(cfg => cfg.id === layerName);
      
      // Si no encuentra, intentar sin el sufijo numérico (GeoServer a veces agrega "0", "1", etc.)
      if (!layerConfig) {
        const layerNameParts = layerName.split(':');
        if (layerNameParts.length === 2) {
          const workspace = layerNameParts[0];
          const baseName = layerNameParts[1].replace(/[0-9]+$/, ''); // Remover sufijos numéricos al final
          const baseId = `${workspace}:${baseName}`;
          layerConfig = layersConfig.find(cfg => cfg.id === baseId);
        }
      }
      
      if (layerConfig) {
        return layerConfig.title;
      }
      // Fallback: usar el nombre después de los dos puntos, removiendo sufijos numéricos
      const layerNameParts = layerName.split(':');
      if (layerNameParts.length === 2) {
        return layerNameParts[1].replace(/[0-9]+$/, '').replace(/_/g, ' ');
      }
      return layerName.split(':')[1] || layerName;
    }
  }, [layerManager]);

  /**
   * Crear capas para visualización:
   * - highlightLayer: Resalta todas las features encontradas (rojo)
   * - selectedFeatureLayer: Resalta la feature seleccionada (azul, más destacado)
   * - drawLayer: Muestra el rectángulo de consulta mientras se dibuja
   */
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

    // Capa para resaltar la feature seleccionada (con estilo más destacado)
    const selectedSource = new VectorSource();
    const selectedLayer = new VectorLayer({
      source: selectedSource,
      style: new Style({
        stroke: new Stroke({
          color: "#1a73e8",
          width: 5,
        }),
        fill: new Fill({
          color: "rgba(26, 115, 232, 0.3)",
        }),
        image: new CircleStyle({
          radius: 12,
          fill: new Fill({
            color: "#1a73e8",
          }),
          stroke: new Stroke({
            color: "#fff",
            width: 3,
          }),
        }),
      }),
    });

    selectedLayer.setZIndex(101); // Por encima de la capa de highlight normal
    map.addLayer(selectedLayer);
    selectedFeatureLayerRef.current = selectedLayer;

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
      map.removeLayer(selectedLayer);
      map.removeLayer(drawLayer);
      highlightLayerRef.current = null;
      selectedFeatureLayerRef.current = null;
      drawLayerRef.current = null;
    };
  }, [map]);

  // Función helper para calcular distancia geodésica entre dos puntos
  const calculateGeodesicDistance = (coord1, coord2) => {
    // Convertir coordenadas a EPSG:4326 (lat/lon) para cálculo geodésico
    const lonLat1 = toLonLat(coord1, "EPSG:3857");
    const lonLat2 = toLonLat(coord2, "EPSG:3857");
    // getDistance calcula la distancia geodésica en metros
    return getDistance(lonLat1, lonLat2);
  };

  /**
   * Consulta features en una capa de usuario (en memoria)
   * @param {string} layerId - ID de la capa de usuario
   * @param {Array<number>} coordinate - Coordenada del punto (para consulta por punto)
   * @param {Array<number>} extent - Extent del rectángulo [minX, minY, maxX, maxY] (para consulta por rectángulo)
   * @param {boolean} isPointQuery - true para consulta por punto, false para rectángulo
   * @param {number|null} searchRadiusMapUnits - Radio de búsqueda en unidades del mapa (opcional, solo para consulta por punto)
   * @returns {Array<ol.Feature>} Array de features encontradas
   */
  const queryUserLayer = useCallback((layerId, coordinate, extent, isPointQuery, searchRadiusMapUnits = null) => {
    if (!layerManager || !map) {
      return [];
    }

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
        // Para consulta por punto: verificar si está dentro del radio usando distancia geodésica
        let distanceInMeters;
        
        if (geometry instanceof Point) {
          const geomCoord = geometry.getCoordinates();
          distanceInMeters = calculateGeodesicDistance(coordinate, geomCoord);
        } else {
          const closestPoint = geometry.getClosestPoint(coordinate);
          distanceInMeters = calculateGeodesicDistance(coordinate, closestPoint);
        }
        
        // Usar el radio pasado como parámetro, o calcularlo si no se proporciona
        let searchRadiusMeters;
        if (searchRadiusMapUnits !== null) {
          // Convertir radio de unidades del mapa a metros
          const lonLat = toLonLat(coordinate, "EPSG:3857");
          const latRad = (lonLat[1] * Math.PI) / 180;
          const metersPerUnit = Math.cos(latRad) * 111320;
          searchRadiusMeters = searchRadiusMapUnits * metersPerUnit;
        } else {
          // Radio de búsqueda en coordenadas del mapa (aproximadamente 10 píxeles)
          const view = map.getView();
          const resolution = view.getResolution();
          const searchRadiusPixels = 10;
          const searchRadiusMapUnits = resolution * searchRadiusPixels;
          const lonLat = toLonLat(coordinate, "EPSG:3857");
          const latRad = (lonLat[1] * Math.PI) / 180;
          const metersPerUnit = Math.cos(latRad) * 111320;
          searchRadiusMeters = searchRadiusMapUnits * metersPerUnit;
        }
        
        isInRange = distanceInMeters <= searchRadiusMeters;
      } else {
        // Para consulta por rectángulo: verificar si intersecta
        isInRange = geometry.intersectsExtent(extent);
      }

      if (isInRange) {
        foundFeatures.push(feature);
      }
    });

    return foundFeatures;
  }, [map, layerManager]);

  /**
   * Consulta por punto: encuentra objetos dentro de un rango fijo basado en resolución
   * Consulta todas las capas visibles y retorna todos los objetos dentro del radio de búsqueda
   * @param {Array<number>} coordinate - Coordenada del punto en EPSG:3857
   */
  const queryByPoint = useCallback(async (coordinate) => {
    if (!layerManager) {
      setIsLoading(false);
      setQueryResults({
        message: "No hay capas activas para consultar",
        features: [],
      });
      setSelectedFeature(null);
      return;
    }

    const visibleLayers = layerManager.getVisibleLayers();
    
    if (!visibleLayers || visibleLayers.length === 0) {
      setIsLoading(false);
      setQueryResults({
        message: "No hay capas activas para consultar",
        features: [],
        layerResults: {},
      });
      setSelectedFeature(null);
      return;
    }

    setIsLoading(true);
    setQueryResults(null);
    setSelectedFeature(null);

    // Convertir coordenada a EPSG:4326
    const lonLat = toLonLat(coordinate, "EPSG:3857");
    
    // Calcular el radio de búsqueda basado en la resolución actual del mapa
    // Radio fijo en píxeles que se convierte a unidades del mapa según la resolución
    const view = map.getView();
    const resolution = view.getResolution();
    const searchRadiusPixels = 10; // 10 píxeles de radio de búsqueda (fijo)
    const searchRadiusMapUnits = resolution * searchRadiusPixels; // Radio en unidades del mapa (EPSG:3857)
    
    // Convertir metros a grados para el bbox de WFS (aproximación: 1 grado ≈ 111km)
    const searchRadiusMeters = searchRadiusMapUnits;
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
    
    // Buscar objetos dentro del rango fijo en todas las capas
    const allFeatures = [];
    const layerResults = {};

    try {
      // Consultar capas de usuario (en memoria)
      userLayerIds.forEach(layerId => {
        // Pasar el radio calculado para que use el mismo valor
        const foundFeatures = queryUserLayer(layerId, coordinate, null, true, searchRadiusMapUnits);
        if (foundFeatures.length > 0) {
          // Calcular distancias geodésicas para todas las features encontradas (ya están filtradas por radio)
          const displayName = getLayerDisplayName(layerId);
          
          foundFeatures.forEach((feature) => {
            const geometry = feature.getGeometry();
            let distanceInMeters;
            
            if (geometry instanceof Point) {
              // Para puntos: distancia geodésica directa
              const geomCoord = geometry.getCoordinates();
              distanceInMeters = calculateGeodesicDistance(coordinate, geomCoord);
            } else {
              // Para líneas y polígonos: encontrar el punto más cercano y calcular distancia geodésica
              const closestPoint = geometry.getClosestPoint(coordinate);
              distanceInMeters = calculateGeodesicDistance(coordinate, closestPoint);
            }
            
            allFeatures.push({
              feature: feature,
              layerName: layerId,
              layerDisplayName: displayName,
              distance: distanceInMeters / 1000, // En km
              distancePixels: distanceInMeters, // Mantener para compatibilidad
              properties: feature.getProperties(),
            });
          });
          
          layerResults[displayName] = foundFeatures.length;
        } else {
          layerResults[getLayerDisplayName(layerId)] = 0;
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

            // Calcular distancia geodésica a cada feature y filtrar por radio fijo
            const featuresInRange = [];
            // Convertir el radio de unidades del mapa a metros aproximados para comparación geodésica
            // Usamos la latitud del punto clickeado para la conversión
            const latRad = (lonLat[1] * Math.PI) / 180;
            const metersPerUnit = Math.cos(latRad) * 111320;
            const searchRadiusMeters = searchRadiusMapUnits * metersPerUnit;

            features.forEach((feature) => {
              const geometry = feature.getGeometry();
              let distanceInMeters;

              if (geometry instanceof Point) {
                // Para puntos: distancia geodésica directa
                const geomCoord = geometry.getCoordinates();
                distanceInMeters = calculateGeodesicDistance(coordinate, geomCoord);
              } else {
                // Para polígonos y líneas: encontrar el punto más cercano y calcular distancia geodésica
                const closestPoint = geometry.getClosestPoint(coordinate);
                distanceInMeters = calculateGeodesicDistance(coordinate, closestPoint);
              }

              // Solo incluir features que estén dentro del radio fijo (convertido a metros)
              if (distanceInMeters <= searchRadiusMeters) {
                const displayName = getLayerDisplayName(layerName);
                
                featuresInRange.push({ 
                  feature, 
                  layerName,
                  layerDisplayName: displayName,
                  distance: distanceInMeters / 1000, // En km para mostrar
                  distancePixels: distanceInMeters, // Mantener para compatibilidad
                  properties: feature.getProperties() 
                });
              }
            });

            // Agregar todas las features dentro del rango
            if (featuresInRange.length > 0) {
              featuresInRange.forEach(featureData => {
                allFeatures.push(featureData);
              });
              layerResults[getLayerDisplayName(layerName)] = featuresInRange.length;
            } else {
              layerResults[getLayerDisplayName(layerName)] = 0;
            }
          } else {
            layerResults[getLayerDisplayName(layerName)] = 0;
          }
          } catch (error) {
            console.error(`Error consultando capa ${layerName}:`, error);
            layerResults[getLayerDisplayName(layerName)] = `Error: ${error.message}`;
          }
        });

        await Promise.all(queries);
      }

      // Ordenar por distancia (de menor a mayor)
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
          ? `Se encontraron ${allFeatures.length} elemento(s) en ${Object.keys(layerResults).filter(k => layerResults[k] > 0).length} capa(s)`
          : "No se encontraron elementos en el punto seleccionado",
        features: allFeatures,
        layerResults: layerResults || {},
      });
    } catch (error) {
      console.error("Error en consulta WFS:", error);
      setQueryResults({
        message: `Error al consultar: ${error.message}`,
        features: [],
        layerResults: {},
      });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerManager, getLayerDisplayName, queryUserLayer]); // map se usa indirectamente a través de queryUserLayer

  /**
   * Consulta por rectángulo: encuentra todos los objetos que intersectan con el área seleccionada
   * Consulta todas las capas visibles y retorna todos los objetos dentro del rectángulo
   * @param {Array<number>} extent - Extent del rectángulo [minX, minY, maxX, maxY] en EPSG:3857
   */
  const queryByRectangle = useCallback(async (extent) => {
    if (!layerManager) {
      setIsLoading(false);
      setQueryResults({
        message: "No hay capas activas para consultar",
        features: [],
      });
      setSelectedFeature(null);
      return;
    }

    const visibleLayers = layerManager.getVisibleLayers();
    
    if (!visibleLayers || visibleLayers.length === 0) {
      setIsLoading(false);
      setQueryResults({
        message: "No hay capas activas para consultar",
        features: [],
        layerResults: {},
      });
      setSelectedFeature(null);
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
        const displayName = getLayerDisplayName(layerId);
        if (foundFeatures.length > 0) {
          foundFeatures.forEach(feature => {
            allFeatures.push({
              feature,
              layerName: layerId,
              layerDisplayName: displayName,
              properties: feature.getProperties(),
            });
          });
          layerResults[displayName] = foundFeatures.length;
        } else {
          layerResults[displayName] = 0;
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
            let intersectCount = 0;
            features.forEach((feature) => {
              const geometry = feature.getGeometry();
              // Verificar si la geometría intersecta con el rectángulo
              // (si al menos una parte del objeto está dentro del rectángulo)
              if (geometry.intersectsExtent(extent)) {
                const displayName = getLayerDisplayName(layerName);
                allFeatures.push({
                  feature,
                  layerName,
                  layerDisplayName: displayName,
                  properties: feature.getProperties(),
                });
                intersectCount++;
              }
            });

            layerResults[getLayerDisplayName(layerName)] = intersectCount;
          } else {
            layerResults[getLayerDisplayName(layerName)] = 0;
          }
          } catch (error) {
            console.error(`Error consultando capa ${layerName}:`, error);
            layerResults[getLayerDisplayName(layerName)] = `Error: ${error.message}`;
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
        layerResults: {},
      });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerManager, getLayerDisplayName, queryUserLayer]); // map no se usa directamente en este callback

  /**
   * Manejar la activación/desactivación de la herramienta de consulta
   * Configura los event listeners para click izquierdo (punto) y click derecho (rectángulo)
   */
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
  }, [activeTool, map, layerManager, queryByPoint, queryByRectangle]);

  /**
   * Maneja la selección de features para mostrar detalles
   * Cuando el usuario hace click en una feature resaltada, muestra sus atributos
   */
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

  // Obtener todos los atributos únicos de las features
  const getAvailableAttributes = () => {
    if (!queryResults || !queryResults.features || queryResults.features.length === 0) {
      return [];
    }

    const attributesSet = new Set();
    queryResults.features.forEach((item) => {
      if (item.properties) {
        Object.keys(item.properties).forEach((key) => {
          if (key !== "geometry") {
            attributesSet.add(key);
          }
        });
      }
    });

    return Array.from(attributesSet).sort();
  };

  // Calcular estadísticas
  const calculateStatistics = () => {
    if (!queryResults || !queryResults.features || queryResults.features.length === 0) {
      setStatisticResult(null);
      return;
    }

    if (!selectedAttribute) {
      setStatisticResult(null);
      return;
    }

    const values = [];
    queryResults.features.forEach((item) => {
      if (item.properties && item.properties[selectedAttribute] !== undefined) {
        const value = item.properties[selectedAttribute];
        if (value !== null && value !== "") {
          values.push(value);
        }
      }
    });

    if (values.length === 0) {
      setStatisticResult({
        type: statisticType,
        attribute: selectedAttribute,
        value: "No hay valores válidos para calcular",
      });
      return;
    }

    // Detectar si es un atributo lógico (V/F, True/False, 1/0)
    const isLogicalAttribute = values.every((v) => {
      const str = String(v).toUpperCase().trim();
      return (
        str === "V" ||
        str === "F" ||
        str === "TRUE" ||
        str === "FALSE" ||
        str === "1" ||
        str === "0" ||
        str === "T" ||
        str === "N" ||
        v === true ||
        v === false
      );
    });

    let result;
    let logicalBreakdown = null;

    switch (statisticType) {
      case "count":
        if (isLogicalAttribute) {
          // Contar verdaderos y falsos
          let trueCount = 0;
          let falseCount = 0;

          values.forEach((v) => {
            const str = String(v).toUpperCase().trim();
            const isTrue =
              str === "V" ||
              str === "TRUE" ||
              str === "1" ||
              str === "T" ||
              v === true;
            const isFalse =
              str === "F" ||
              str === "FALSE" ||
              str === "0" ||
              str === "N" ||
              v === false;

            if (isTrue) {
              trueCount++;
            } else if (isFalse) {
              falseCount++;
            }
          });

          logicalBreakdown = {
            true: trueCount,
            false: falseCount,
            total: values.length,
          };
          result = `${trueCount} verdaderos, ${falseCount} falsos`;
        } else {
          result = values.length;
        }
        break;
      case "sum":
        const numericValues = values
          .map((v) => {
            const num = parseFloat(v);
            return isNaN(num) ? null : num;
          })
          .filter((v) => v !== null);
        if (numericValues.length === 0) {
          result = "No se pueden sumar valores no numéricos";
        } else {
          result = numericValues.reduce((sum, val) => sum + val, 0);
        }
        break;
      case "average":
        const avgNumericValues = values
          .map((v) => {
            const num = parseFloat(v);
            return isNaN(num) ? null : num;
          })
          .filter((v) => v !== null);
        if (avgNumericValues.length === 0) {
          result = "No se puede calcular el promedio de valores no numéricos";
        } else {
          const sum = avgNumericValues.reduce((s, val) => s + val, 0);
          result = sum / avgNumericValues.length;
        }
        break;
      default:
        result = "Tipo de estadística no válido";
    }

    setStatisticResult({
      type: statisticType,
      attribute: selectedAttribute,
      value: result,
      totalValues: values.length,
      isLogical: isLogicalAttribute,
      logicalBreakdown: logicalBreakdown,
    });
  };

  // Resetear estadísticas cuando cambian los resultados
  useEffect(() => {
    if (queryResults) {
      setStatisticResult(null);
      setSelectedAttribute("");
    }
  }, [queryResults]);

  if (activeTool !== "query") return null;

  return (
    <>
      {isLoading && (
        <div className="query-loading">
          <div className="query-spinner"></div>
          <span>Consultando...</span>
        </div>
      )}

      {queryResults && (
        <div className="query-results">
          <div className="query-results-header">
            <h3>Resultados de Consulta</h3>
            <button
              className="query-close"
              onClick={() => {
                setQueryResults(null);
                setSelectedFeature(null);
                // Limpiar todas las features resaltadas
                if (highlightLayerRef.current) {
                  highlightLayerRef.current.getSource().clear();
                }
                if (selectedFeatureLayerRef.current) {
                  selectedFeatureLayerRef.current.getSource().clear();
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
                        // Actualizar la feature seleccionada y resaltarla en el mapa
                        const newSelected = {
                          ...item,
                          geometry: item.feature.getGeometry().getType(),
                        };
                        setSelectedFeature(newSelected);
                        
                        // Resaltar la feature seleccionada en el mapa
                        if (selectedFeatureLayerRef.current) {
                          const source = selectedFeatureLayerRef.current.getSource();
                          source.clear();
                          // Clonar la feature para evitar problemas de referencia
                          const clonedFeature = item.feature.clone();
                          source.addFeature(clonedFeature);
                          
                          // Centrar el mapa en la feature seleccionada
                          const geometry = item.feature.getGeometry();
                          if (geometry) {
                            const extent = geometry.getExtent();
                            map.getView().fit(extent, {
                              padding: [50, 50, 50, 50],
                              duration: 500,
                              maxZoom: 18,
                            });
                          }
                        }
                      }}
                    >
                      <div className="query-feature-header">
                        <strong>{item.layerDisplayName || getLayerDisplayName(item.layerName)}</strong>
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
                <div className="query-feature-details-header">
                  <h4>Detalles del Elemento</h4>
                  {selectedFeature.layerName.startsWith('user:') && (
                    <button
                      className="query-delete-feature-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('¿Estás seguro de que deseas eliminar este elemento?')) {
                          const success = layerManager.removeFeatureFromUserLayer(
                            selectedFeature.layerName,
                            selectedFeature.feature
                          );
                          if (success) {
                            // Eliminar de los resultados y del highlight
                            if (highlightLayerRef.current) {
                              const source = highlightLayerRef.current.getSource();
                              source.removeFeature(selectedFeature.feature);
                            }
                            
                            // Actualizar resultados
                            const updatedFeatures = queryResults.features.filter(
                              item => item.feature !== selectedFeature.feature
                            );
                            
                            // Actualizar contador de capa
                            const layerDisplayName = selectedFeature.layerDisplayName || getLayerDisplayName(selectedFeature.layerName);
                            const updatedLayerResults = { ...(queryResults.layerResults || {}) };
                            if (updatedLayerResults[layerDisplayName] > 0) {
                              updatedLayerResults[layerDisplayName]--;
                            }
                            
                            setQueryResults({
                              ...queryResults,
                              features: updatedFeatures,
                              layerResults: updatedLayerResults,
                              message: updatedFeatures.length > 0
                                ? `Se encontraron ${updatedFeatures.length} elemento(s) en el área seleccionada`
                                : "No se encontraron elementos en el área seleccionada",
                            });
                            
                            // Limpiar selección
                            setSelectedFeature(null);
                          }
                        }
                      }}
                      title="Eliminar este elemento"
                    >
                      🗑️ Eliminar
                    </button>
                  )}
                </div>
                <div className="query-details-content">
                  <div className="query-detail-row">
                    <strong>Capa:</strong>
                    <span>{selectedFeature.layerDisplayName || getLayerDisplayName(selectedFeature.layerName)}</span>
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

            {queryResults.features.length > 0 && (
              <div className="query-statistics">
                <h4>Estadísticas de Atributos</h4>
                <div className="query-statistics-controls">
                  <div className="query-statistics-row">
                    <label htmlFor="stat-attribute">Atributo:</label>
                    <select
                      id="stat-attribute"
                      value={selectedAttribute}
                      onChange={(e) => setSelectedAttribute(e.target.value)}
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "white",
                        cursor: "pointer",
                        flex: 1,
                      }}
                    >
                      <option value="">Seleccione un atributo</option>
                      {getAvailableAttributes().map((attr) => (
                        <option key={attr} value={attr}>
                          {attr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="query-statistics-row">
                    <label htmlFor="stat-type">Tipo de estadística:</label>
                    <select
                      id="stat-type"
                      value={statisticType}
                      onChange={(e) => setStatisticType(e.target.value)}
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        fontSize: 13,
                        background: "white",
                        cursor: "pointer",
                        flex: 1,
                      }}
                    >
                      <option value="count">Conteo</option>
                      <option value="sum">Suma</option>
                      <option value="average">Promedio</option>
                    </select>
                  </div>
                  <button
                    onClick={calculateStatistics}
                    disabled={!selectedAttribute}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 4,
                      border: "none",
                      backgroundColor: selectedAttribute ? "#1a73e8" : "#ccc",
                      color: "white",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: selectedAttribute ? "pointer" : "not-allowed",
                      transition: "background-color 0.2s",
                    }}
                  >
                    Calcular
                  </button>
                </div>
                {statisticResult && (
                  <div className="query-statistics-result">
                    <div className="query-statistics-result-label">
                      {statisticType === "count" && "Conteo"}
                      {statisticType === "sum" && "Suma"}
                      {statisticType === "average" && "Promedio"}
                      {" de "}
                      <strong>{statisticResult.attribute}</strong>:
                    </div>
                    {statisticResult.isLogical && statisticResult.logicalBreakdown ? (
                      <div className="query-statistics-logical-breakdown">
                        <div className="query-statistics-logical-item">
                          <span className="query-statistics-logical-label">Verdaderos:</span>
                          <span className="query-statistics-logical-value true">
                            {statisticResult.logicalBreakdown.true}
                          </span>
                        </div>
                        <div className="query-statistics-logical-item">
                          <span className="query-statistics-logical-label">Falsos:</span>
                          <span className="query-statistics-logical-value false">
                            {statisticResult.logicalBreakdown.false}
                          </span>
                        </div>
                        <div className="query-statistics-result-info">
                          (Total: {statisticResult.logicalBreakdown.total} valor(es) válido(s) de{" "}
                          {queryResults.features.length} elemento(s))
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="query-statistics-result-value">
                          {typeof statisticResult.value === "number"
                            ? statisticResult.value.toLocaleString("es-ES", {
                                maximumFractionDigits: 2,
                              })
                            : statisticResult.value}
                        </div>
                        {statisticResult.totalValues !== undefined && (
                          <div className="query-statistics-result-info">
                            (basado en {statisticResult.totalValues} valor(es) válido(s) de{" "}
                            {queryResults.features.length} elemento(s))
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {queryResults.layerResults && Object.keys(queryResults.layerResults).length > 0 && (
              <div className="query-layer-summary">
                <h4>Resumen por Capa:</h4>
                <ul>
                  {Object.entries(queryResults.layerResults).map(
                    ([layer, count]) => (
                      <li key={layer}>
                        <strong>{layer}:</strong>{" "}
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
