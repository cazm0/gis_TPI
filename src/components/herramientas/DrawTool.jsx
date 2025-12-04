/**
 * DrawTool - Herramienta para dibujar features en el mapa
 * 
 * Permite al usuario dibujar puntos, líneas y polígonos en el mapa y guardarlos:
 * - En capas de usuario nuevas (en memoria, con atributos personalizables)
 * - En capas de usuario existentes (en memoria)
 * - En capas de GeoServer (usando WFS Transaction)
 * 
 * Soporta definición de esquema de atributos para nuevas capas y entrada de valores
 * para features individuales.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Draw } from "ol/interaction";
import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style";
import { GeoJSON } from "ol/format";
import { Point, LineString, Polygon } from "ol/geom";
import { URL_WFS, GEOSERVER_REST, GEOSERVER_WORKSPACE, GEOSERVER_DATASTORE } from "../../config";
import { layersConfig } from "../../layers";
import Modal from "../common/Modal";
import "./DrawTool.css";

/**
 * Componente DrawTool
 * @param {ol.Map} map - Instancia del mapa de OpenLayers
 * @param {string} activeTool - Herramienta actualmente activa (debe ser "draw" para activarse)
 * @param {LayerManager} layerManager - Gestor de capas
 * @param {function} onToolChange - Callback cuando se cambia la herramienta activa
 * @param {string} propGeometryType - Tipo de geometría a dibujar: "Point", "LineString", "Polygon"
 * @param {function} onGeometryTypeChange - Callback cuando cambia el tipo de geometría
 */
export default function DrawTool({ map, activeTool, layerManager, onToolChange, geometryType: propGeometryType, onGeometryTypeChange }) {
  const drawRef = useRef(null);
  const drawLayerRef = useRef(null);
  const geometryType = propGeometryType !== undefined ? propGeometryType : "Point";
  const [showDialog, setShowDialog] = useState(false);
  const [drawnFeature, setDrawnFeature] = useState(null);
  const [targetLayer, setTargetLayer] = useState(() => {
    // Cargar última selección desde localStorage
    const saved = localStorage.getItem('drawTool_lastTarget');
    return saved || "new";
  });
  const [selectedExistingLayer, setSelectedExistingLayer] = useState(() => {
    const saved = localStorage.getItem('drawTool_lastExistingLayer');
    return saved || "";
  });
  const [newLayerName, setNewLayerName] = useState(() => {
    const saved = localStorage.getItem('drawTool_lastNewLayer');
    return saved || "";
  });
  const [isSaving, setIsSaving] = useState(false);
  const [filteredLayers, setFilteredLayers] = useState([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [layerAttributes, setLayerAttributes] = useState([]); // Atributos para nueva capa
  const [featureAttributes, setFeatureAttributes] = useState({}); // Valores de atributos para la feature actual
  const [showAttributesForm, setShowAttributesForm] = useState(false);
  const [postgisAttributes, setPostgisAttributes] = useState({ nombre: '', tipo: '', descripcion: '' }); // Atributos para capas de PostGIS
  const [showPostgisForm, setShowPostgisForm] = useState(false); // Mostrar formulario de PostGIS
  const hintRef = useRef(null);
  const [modal, setModal] = useState({ isOpen: false, message: "", type: "info", title: "" });

  // Función para guardar feature en PostGIS usando WFS Transaction
  // Esta función ya no se usa directamente, el código está en saveFeature
  // Se mantiene por compatibilidad pero se puede eliminar en el futuro
  // eslint-disable-next-line no-unused-vars
  const _saveFeatureToPostGIS = async (feature, layerNameOrId) => {
    const format = new GeoJSON();
    const geometry = feature.getGeometry();
    
    // Convertir geometría a GeoJSON en EPSG:4326
    const featureJSON = format.writeFeature(feature, {
      featureProjection: "EPSG:3857",
      dataProjection: "EPSG:4326",
    });

    const featureObj = JSON.parse(featureJSON);
    const coordinates = featureObj.geometry.coordinates;

    // Construir XML GML para la geometría según el tipo
    let gmlGeometry = "";
    if (geometry instanceof Point) {
      gmlGeometry = `<gml:Point srsName="EPSG:4326"><gml:pos>${coordinates[1]} ${coordinates[0]}</gml:pos></gml:Point>`;
    } else if (geometry instanceof LineString) {
      const posList = coordinates.map(c => `${c[1]} ${c[0]}`).join(" ");
      gmlGeometry = `<gml:LineString srsName="EPSG:4326"><gml:posList>${posList}</gml:posList></gml:LineString>`;
    } else if (geometry instanceof Polygon) {
      const exteriorRing = coordinates[0].map(c => `${c[1]} ${c[0]}`).join(" ");
      gmlGeometry = `<gml:Polygon srsName="EPSG:4326"><gml:exterior><gml:LinearRing><gml:posList>${exteriorRing}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon>`;
    }

    // Si es un ID de configuración, obtener el nombre activo real de GeoServer
    let layerName = layerNameOrId;
    if (layerManager && layerManager.getActiveLayerName) {
      const activeName = layerManager.getActiveLayerName(layerNameOrId);
      if (activeName) {
        layerName = activeName;
      }
    }

    // El campo de geometría en las tablas de usuario se llama "geom"
    const geomFieldName = "geom";

    // Calcular bbox aproximado
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    const processCoords = (coords) => {
      if (Array.isArray(coords[0])) {
        coords.forEach(c => processCoords(c));
      } else {
        const [lon, lat] = coords;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    };
    processCoords(coordinates);

    const transactionXML = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.1.0"
  xmlns:wfs="http://www.opengis.net/wfs"
  xmlns:gml="http://www.opengis.net/gml"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
  <wfs:Insert>
    <${layerName}>
      <gml:boundedBy>
        <gml:Envelope srsName="EPSG:4326">
          <gml:lowerCorner>${minLat} ${minLon}</gml:lowerCorner>
          <gml:upperCorner>${maxLat} ${maxLon}</gml:upperCorner>
        </gml:Envelope>
      </gml:boundedBy>
      <${geomFieldName}>${gmlGeometry}</${geomFieldName}>
    </${layerName}>
  </wfs:Insert>
</wfs:Transaction>`;

    const response = await fetch(URL_WFS, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
      },
      body: transactionXML,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`Error del servidor: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const resultXML = await response.text();
    if (resultXML.includes("Exception") || resultXML.includes("error")) {
      console.error("Error XML:", resultXML);
      throw new Error("El servidor reportó un error al guardar el feature");
    }

    return true;
  };

  // Función para refrescar capa en GeoServer usando REST API
  const refreshGeoServerLayer = async (layerNameOrId) => {
    // Obtener el nombre activo de la capa (con "0" si es necesario)
    let layerNameForRefresh = layerNameOrId;
    if (layerManager && layerManager.getActiveLayerName) {
      const activeName = layerManager.getActiveLayerName(layerNameOrId);
      if (activeName) {
        layerNameForRefresh = activeName;
      }
    }
    
    // Extraer solo el nombre de la capa sin el workspace (ej: "capa_usuario0")
    const layerNameOnly = layerNameForRefresh.split(':')[1] || layerNameForRefresh;
    
    // Credenciales de GeoServer
    const username = 'admin';
    const password = 'geoserver';
    const auth = btoa(`${username}:${password}`);
    
    try {
      // Método 1: Recargar el FeatureType específico (equivalente a "Recargar feature type" en la UI)
      // Este es el método más efectivo para forzar que GeoServer recargue los datos de PostGIS
      const featureTypeUrl = `${GEOSERVER_REST}/workspaces/${GEOSERVER_WORKSPACE}/datastores/${GEOSERVER_DATASTORE}/featuretypes/${layerNameOnly}.xml`;
      
      console.log('Recargando feature type en GeoServer:', featureTypeUrl);
      
      // Primero obtener la configuración actual del featuretype
      const getResponse = await fetch(featureTypeUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/xml'
        }
      });
      
      if (getResponse.ok) {
        const featureTypeXML = await getResponse.text();
        
        // Hacer PUT con la misma configuración para forzar reload del feature type
        const putResponse = await fetch(featureTypeUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/xml'
          },
          body: featureTypeXML
        });
        
        if (putResponse.ok) {
          console.log(`✓ Feature type ${layerNameOnly} recargado en GeoServer`);
        } else {
          const errorText = await putResponse.text();
          console.warn('Error al recargar feature type:', errorText);
        }
      } else {
        console.warn('No se pudo obtener configuración del feature type:', getResponse.status);
      }
      
      // Método 2: Resetear el datastore completo (más agresivo pero funciona)
      const resetUrl = `${GEOSERVER_REST}/workspaces/${GEOSERVER_WORKSPACE}/datastores/${GEOSERVER_DATASTORE}/reset`;
      
      const resetResponse = await fetch(resetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (resetResponse.ok) {
        console.log(`✓ Datastore ${GEOSERVER_DATASTORE} reseteado en GeoServer`);
      }
      
    } catch (error) {
      console.warn('Error refrescando capa en GeoServer:', error.message);
      console.warn('Los datos están guardados en PostgreSQL. Puede que necesites recargar manualmente en GeoServer.');
    }
    
    // Refrescar la capa WMS en el cliente (esto es lo más importante para ver los cambios)
    refreshWMSLayerInClient(layerNameForRefresh);
    
    // Segundo refresh después de un delay para asegurar que GeoServer haya procesado
    setTimeout(() => {
      refreshWMSLayerInClient(layerNameForRefresh);
    }, 1500);
  };

  // Función para refrescar capa WMS en el cliente después de guardar
  const refreshWMSLayerInClient = (layerName) => {
    if (!layerManager || !map) return;
    
    // Buscar la capa por ID de configuración (el LayerManager usa el ID de config, no el nombre activo)
    // Primero intentar encontrar el ID de configuración que corresponde a este nombre activo
    let layerId = null;
    let layer = null;
    
    // Si el nombre incluye "0", buscar el ID de configuración sin el "0"
    if (layerName.includes('0')) {
      const baseName = layerName.replace('0', '');
      layerId = baseName;
      layer = layerManager.layers[baseName];
    }
    
    // Si no se encuentra, intentar con el nombre exacto
    if (!layer) {
      layerId = layerName;
      layer = layerManager.layers[layerName];
    }
    
    // Si aún no se encuentra, buscar en todas las capas
    if (!layer) {
      for (const [key, value] of Object.entries(layerManager.layers)) {
        const layerNameOnly = layerName.split(':')[1] || layerName;
        const keyNameOnly = key.split(':')[1] || key;
        
        // Comparar nombres sin el workspace
        if (keyNameOnly.replace('0', '') === layerNameOnly.replace('0', '') || 
            keyNameOnly === layerNameOnly) {
          layerId = key;
          layer = value;
          break;
        }
      }
    }
    
    if (layer && layer.getSource) {
      const source = layer.getSource();
      
      // Actualizar el nombre activo de la capa en el source para que use el nombre correcto
      const params = source.getParams();
      
      // Asegurarse de que el parámetro LAYERS use el nombre activo correcto
      if (params.LAYERS !== layerName) {
        params.LAYERS = layerName;
      }
      
      // Agregar timestamp único para forzar refresh completo
      params._t = Date.now();
      params._refresh = Math.random();
      
      // Actualizar parámetros (esto fuerza una nueva solicitud WMS)
      source.updateParams(params);
      
      // Forzar cambio inmediato en la fuente
      source.changed();
      
      // Si la capa está visible, forzar redibujado completo del mapa
      if (layer.getVisible()) {
        // Método más agresivo: forzar actualización del mapa completo
        map.renderSync();
        
        // También actualizar el viewport ligeramente y volver
        const view = map.getView();
        const resolution = view.getResolution();
        view.setResolution(resolution * 1.0001);
        setTimeout(() => {
          view.setResolution(resolution);
          map.renderSync();
        }, 100);
      }
      
      console.log(`Capa WMS refrescada en cliente: ${layerName} (ID: ${layerId || 'no encontrado'})`);
    } else {
      console.warn(`No se encontró la capa para refrescar: ${layerName}`);
      console.warn('Capas disponibles:', Object.keys(layerManager.layers));
    }
  };

  // Crear capa temporal para dibujar
  useEffect(() => {
    if (!map) return;

    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({
          color: "#00ff00",
          width: 3,
        }),
        fill: new Fill({
          color: "rgba(0, 255, 0, 0.2)",
        }),
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({
            color: "#00ff00",
          }),
          stroke: new Stroke({
            color: "#fff",
            width: 2,
          }),
        }),
      }),
    });

    layer.setZIndex(60);
    map.addLayer(layer);
    drawLayerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      drawLayerRef.current = null;
    };
  }, [map]);

  /**
   * Manejar la activación/desactivación de la herramienta de dibujo
   * Crea la interacción de dibujo de OpenLayers cuando la herramienta está activa
   */
  useEffect(() => {
    if (!map || !drawLayerRef.current || activeTool !== "draw") {
      if (drawRef.current) {
        map?.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
      if (hintRef.current) {
        hintRef.current.remove();
        hintRef.current = null;
      }
      return;
    }

    const targetElement = map.getTargetElement();
    const source = drawLayerRef.current.getSource();

    // Función para actualizar el hint
    const updateHint = (message) => {
      if (hintRef.current) {
        hintRef.current.textContent = message;
      }
    };

    // Función para obtener el mensaje inicial según el tipo de geometría
    const getInitialMessage = () => {
      if (geometryType === "Point") {
        return "Dibuja un punto en el mapa";
      } else if (geometryType === "LineString") {
        return "Dibuja una línea en el mapa. Doble clic para finalizar";
      } else if (geometryType === "Polygon") {
        return "Dibuja un polígono en el mapa. Vuelve al primer punto para finalizar";
      } else {
        return "Dibuja en el mapa";
      }
    };

    // Mostrar hint con mensaje específico según el tipo de geometría
    if (!hintRef.current) {
      const hint = document.createElement("div");
      hint.className = "draw-hint";
      hint.textContent = getInitialMessage();
      targetElement.appendChild(hint);
      hintRef.current = hint;
    } else {
      // Actualizar mensaje según el tipo
      updateHint(getInitialMessage());
    }

    // Limpiar dibujos anteriores
    source.clear();

    // Crear interacción de dibujo
    const draw = new Draw({
      source,
      type: geometryType,
      style: new Style({
        stroke: new Stroke({
          color: "#00ff00",
          width: 3,
        }),
        fill: new Fill({
          color: "rgba(0, 255, 0, 0.2)",
        }),
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({
            color: "#00ff00",
          }),
          stroke: new Stroke({
            color: "#fff",
            width: 2,
          }),
        }),
      }),
    });

    map.addInteraction(draw);
    drawRef.current = draw;

    // Actualizar hint cuando comienza el dibujo
    draw.on("drawstart", () => {
      if (geometryType === "LineString") {
        updateHint("Dibuja una línea en el mapa. Doble clic para finalizar");
      } else if (geometryType === "Polygon") {
        updateHint("Dibuja un polígono en el mapa. Vuelve al primer punto para finalizar");
      }
    });

    draw.on("drawend", async (event) => {
      const feature = event.feature;
      setDrawnFeature(feature);
      
      // Ocultar hint cuando termina el dibujo
      if (hintRef.current) {
        updateHint("");
      }
      
      // Mostrar diálogo para que el usuario elija dónde guardar
      setShowDialog(true);
      // Desactivar la herramienta temporalmente hasta que se complete el guardado
      if (onToolChange) {
        onToolChange(null);
      }
    });

    // Actualizar hint cuando se aborta el dibujo
    draw.on("drawabort", () => {
      if (geometryType === "Point") {
        updateHint("Dibuja un punto en el mapa");
      } else if (geometryType === "LineString") {
        updateHint("Dibuja una línea en el mapa. Doble clic para finalizar");
      } else if (geometryType === "Polygon") {
        updateHint("Dibuja un polígono en el mapa. Vuelve al primer punto para finalizar");
      }
    });

    return () => {
      if (drawRef.current) {
        map.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
      if (hintRef.current) {
        hintRef.current.remove();
        hintRef.current = null;
      }
    };
  }, [map, activeTool, geometryType, onToolChange]);

  /**
   * Obtiene las capas compatibles con el tipo de geometría actual
   * Siempre incluye las capas de usuario de GeoServer (puntos, líneas, polígonos) aunque no estén visibles
   * También incluye capas de usuario en memoria (temporales) visibles con la misma geometría
   * @returns {Array} Array de capas compatibles con su información
   */
  const getVisibleLayersForSelection = useCallback(async () => {
    if (!layerManager) return [];
    
    const allLayers = [];
    
    // 1. SIEMPRE incluir las capas de usuario de GeoServer (puntos, líneas, polígonos)
    // aunque no estén visibles
    const userGeoServerLayers = [
      { id: "gisTPI:capa_usuario", geometryType: "Point" },
      { id: "gisTPI:capa_usuario_linea", geometryType: "LineString" },
      { id: "gisTPI:capa_usuario_poligono", geometryType: "Polygon" }
    ];
    
    userGeoServerLayers.forEach(({ id, geometryType: layerGeomType }) => {
      if (layerGeomType === geometryType) {
        // Buscar configuración de la capa para obtener el título
        const layerConfig = layersConfig.find(cfg => cfg.id === id);
        const displayName = layerConfig ? layerConfig.title : id.split(':')[1];
        
        // Para capas de usuario de GeoServer, SIEMPRE usar el nombre con "0"
        // porque esa es la capa publicada en GeoServer
        const [workspace, tableName] = id.split(':');
        const activeName = `${workspace}:${tableName}0`;
        
        allLayers.push({
          id: id,
          name: activeName, // Siempre usar nombre con "0" para capas de usuario de GeoServer
          displayName: displayName,
          isUserLayer: false, // Es una capa de GeoServer
          isGeoServerUserLayer: true, // Marca especial para identificar capas de usuario de GeoServer
          geometryType: layerGeomType,
          isVisible: layerManager.getVisible(id) // Guardar estado de visibilidad
        });
      }
    });
    
    // 2. Incluir capas de usuario en memoria (temporales) visibles con la misma geometría
    const userLayers = layerManager.getUserLayers();
    
    Object.keys(userLayers).forEach((layerId) => {
      const layer = userLayers[layerId];
      const layerGeomType = layer.get('geometryType');
      
      // Solo incluir si tiene la misma geometría y está visible
      if (layerGeomType === geometryType && layer.getVisible()) {
        allLayers.push({
          id: layerId,
          name: layerId,
          displayName: layer.get('title') || layerId.replace('user:', ''),
          isUserLayer: true,
          isGeoServerUserLayer: false,
          geometryType: layerGeomType,
          isVisible: true
        });
      }
    });

    return allLayers;
  }, [layerManager, geometryType]);

  // Cargar capas filtradas cuando cambia el tipo de geometría o se abre el diálogo
  useEffect(() => {
    if (showDialog && drawnFeature) {
      setLoadingLayers(true);
      getVisibleLayersForSelection().then(layers => {
        setFilteredLayers(layers);
        setLoadingLayers(false);
        
        // Si hay una capa preseleccionada en localStorage, verificar que esté en la lista filtrada
        if (selectedExistingLayer) {
          const isInList = layers.some(l => {
            // Comparar siempre por ID de configuración
            return l.id === selectedExistingLayer;
          });
          if (!isInList) {
            // La capa preseleccionada no es compatible con este tipo de geometría
            setSelectedExistingLayer("");
            localStorage.removeItem('drawTool_lastExistingLayer');
          }
        }
      });
    }
  }, [showDialog, geometryType, layerManager, drawnFeature, getVisibleLayersForSelection, selectedExistingLayer]);

  /**
   * Guarda el feature en una capa de GeoServer (PostGIS) con atributos
   * @param {Object} postgisAttrs - Atributos PostGIS: { nombre, tipo, descripcion }
   */
  const saveFeatureToPostGIS = async (postgisAttrs = {}) => {
    if (!drawnFeature) return;

    setIsSaving(true);
    try {
      // Buscar la capa seleccionada en la lista filtrada
      const selectedLayerInfo = filteredLayers.find(l => {
        if (l.isUserLayer) {
          return l.id === selectedExistingLayer;
        } else {
          return l.id === selectedExistingLayer || l.name === selectedExistingLayer;
        }
      });
      
      const isGeoServerUserLayer = selectedLayerInfo && selectedLayerInfo.isGeoServerUserLayer;
      
      if (!isGeoServerUserLayer) {
        throw new Error("Esta función solo debe usarse para capas de usuario de GeoServer");
      }

      // Si es una capa de usuario de GeoServer y no está visible, activarla automáticamente
      if (selectedLayerInfo && !selectedLayerInfo.isVisible) {
        const layerId = selectedLayerInfo.id;
        if (layerManager && layerManager.setVisible) {
          layerManager.setVisible(layerId, true);
          if (layerManager.onChange) {
            layerManager.onChange();
          }
        }
      }

      const layerId = selectedLayerInfo.id;
      const [workspace, tableName] = layerId.split(':');
      const layerName = `${workspace}:${tableName}0`;

      const format = new GeoJSON();
      const geometry = drawnFeature.getGeometry();
      
      // Convertir geometría a GeoJSON en EPSG:4326
      const featureJSON = format.writeFeature(drawnFeature, {
        featureProjection: "EPSG:3857",
        dataProjection: "EPSG:4326",
      });

      const featureObj = JSON.parse(featureJSON);
      const coordinates = featureObj.geometry.coordinates;

      // Validar coordenadas
      const validateCoords = (lon, lat) => {
        if (isNaN(lon) || isNaN(lat)) {
          throw new Error(`Coordenadas no son números: Lon=${lon}, Lat=${lat}`);
        }
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
          throw new Error(`Coordenadas inválidas: longitud debe estar entre -180 y 180, latitud entre -90 y 90. Recibido: Lon=${lon}, Lat=${lat}`);
        }
      };

      // Construir XML GML para la geometría
      let gmlGeometry = "";
      if (geometry instanceof Point) {
        const [lon, lat] = coordinates;
        validateCoords(lon, lat);
        gmlGeometry = `<gml:Point srsName="EPSG:4326"><gml:pos>${lon} ${lat}</gml:pos></gml:Point>`;
      } else if (geometry instanceof LineString) {
        coordinates.forEach(([lon, lat]) => validateCoords(lon, lat));
        const posList = coordinates.map(([lon, lat]) => `${lon} ${lat}`).join(" ");
        gmlGeometry = `<gml:LineString srsName="EPSG:4326"><gml:posList>${posList}</gml:posList></gml:LineString>`;
      } else if (geometry instanceof Polygon) {
        coordinates[0].forEach(([lon, lat]) => validateCoords(lon, lat));
        const exteriorRing = coordinates[0].map(([lon, lat]) => `${lon} ${lat}`).join(" ");
        gmlGeometry = `<gml:Polygon srsName="EPSG:4326"><gml:exterior><gml:LinearRing><gml:posList>${exteriorRing}</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon>`;
      }

      const geomFieldName = "geom";

      // Construir el XML de transacción WFS con atributos
      const nombre = (postgisAttrs.nombre || '').trim();
      const tipo = (postgisAttrs.tipo || '').trim();
      const descripcion = (postgisAttrs.descripcion || '').trim();

      // Escapar valores XML
      const escapeXML = (str) => {
        if (!str) return '';
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      };

      const transactionXML = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.1.0"
  xmlns:wfs="http://www.opengis.net/wfs"
  xmlns:gml="http://www.opengis.net/gml"
  xmlns:${workspace}="http://${workspace}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
  <wfs:Insert>
    <${layerName}>
      <${geomFieldName}>${gmlGeometry}</${geomFieldName}>
      ${nombre ? `<nombre>${escapeXML(nombre)}</nombre>` : ''}
      ${tipo ? `<tipo>${escapeXML(tipo)}</tipo>` : ''}
      ${descripcion ? `<descripcion>${escapeXML(descripcion)}</descripcion>` : ''}
    </${layerName}>
  </wfs:Insert>
</wfs:Transaction>`;
      
      console.log("WFS Transaction XML:", transactionXML);

      const response = await fetch(URL_WFS, {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
        },
        body: transactionXML,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const resultXML = await response.text();
      console.log("WFS Transaction Response:", resultXML);
      
      // Verificar errores
      const errorPatterns = [
        /Exception/i,
        /error/i,
        /Error/i,
        /ows:ExceptionReport/i,
        /ServiceException/i
      ];
      
      const hasError = errorPatterns.some(pattern => pattern.test(resultXML));
      
      if (hasError) {
        let errorMessage = "Error desconocido del servidor";
        const owsMatch = resultXML.match(/<ows:ExceptionText[^>]*>([^<]+)<\/ows:ExceptionText>/i);
        if (owsMatch) {
          errorMessage = owsMatch[1].trim();
        } else {
          const serviceMatch = resultXML.match(/<ServiceException[^>]*>([^<]+)<\/ServiceException>/i);
          if (serviceMatch) {
            errorMessage = serviceMatch[1].trim();
          }
        }
        throw new Error(`Error al guardar: ${errorMessage}`);
      }
      
      // Verificar éxito
      const successPatterns = [
        /<wfs:totalInserted>/i,
        /InsertResults/i,
        /SUCCESS/i,
        /<wfs:InsertResults>/i
      ];
      
      const isSuccess = successPatterns.some(pattern => pattern.test(resultXML));
      
      if (!isSuccess) {
        throw new Error("El servidor no devolvió una confirmación de guardado exitoso.");
      }

      // Activar la capa si no está visible
      if (selectedLayerInfo && layerManager) {
        const layerId = selectedLayerInfo.id;
        if (!layerManager.getVisible(layerId)) {
          layerManager.setVisible(layerId, true);
        }
      }

      // Refrescar la capa
      await new Promise(resolve => setTimeout(resolve, 300));
      await refreshGeoServerLayer(selectedLayerInfo.id);

      const layerDisplayName = selectedLayerInfo ? selectedLayerInfo.displayName : layerName.split(':')[1];
      setModal({ isOpen: true, message: `Feature guardado exitosamente en "${layerDisplayName}"`, type: "success", title: "Éxito" });

      // Limpiar y cerrar
      drawLayerRef.current?.getSource().clear();
      setShowDialog(false);
      setShowPostgisForm(false);
      setDrawnFeature(null);
      setPostgisAttributes({ nombre: '', tipo: '', descripcion: '' });

      // Notificar cambio
      if (layerManager && layerManager.onChange) {
        layerManager.onChange();
      }
    } catch (error) {
      console.error("Error guardando feature en PostGIS:", error);
      setModal({ isOpen: true, message: `Error al guardar el feature: ${error.message}`, type: "error", title: "Error" });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Guarda el feature dibujado en la capa seleccionada
   * Puede guardar en:
   * - Capa de usuario nueva (en memoria)
   * - Capa de usuario existente (en memoria)
   * - Capa de GeoServer (usando WFS Transaction)
   */
  const saveFeature = async () => {
    if (!drawnFeature) return;

    setIsSaving(true);
    try {
      if (targetLayer === "existing") {
        // Guardar en capa existente (GeoServer o usuario)
        if (!selectedExistingLayer) {
          setModal({ isOpen: true, message: "Por favor selecciona una capa existente", type: "warning", title: "Advertencia" });
          setIsSaving(false);
          return;
        }

        // Buscar la capa seleccionada en la lista filtrada para obtener su información
        const selectedLayerInfo = filteredLayers.find(l => {
          if (l.isUserLayer) {
            return l.id === selectedExistingLayer;
          } else {
            return l.id === selectedExistingLayer || l.name === selectedExistingLayer;
          }
        });
        
        // Verificar si es una capa de usuario en memoria
        const isUserLayer = selectedExistingLayer.startsWith('user:');
        
        // Verificar si es una capa de usuario de GeoServer
        const isGeoServerUserLayer = selectedLayerInfo && selectedLayerInfo.isGeoServerUserLayer;
        
        // Si es una capa de GeoServer de usuario y no está visible, activarla automáticamente
        if (isGeoServerUserLayer && selectedLayerInfo && !selectedLayerInfo.isVisible) {
          const layerId = selectedLayerInfo.id;
          if (layerManager && layerManager.setVisible) {
            layerManager.setVisible(layerId, true);
            // Notificar cambio
            if (layerManager.onChange) {
              layerManager.onChange();
            }
          }
        }
        
        if (isUserLayer) {
          // Guardar en capa de usuario existente
          const layerId = selectedExistingLayer;
          const userLayer = layerManager.userLayers[layerId];
          
          if (!userLayer) {
            setModal({ isOpen: true, message: "La capa seleccionada no existe", type: "error", title: "Error" });
            setIsSaving(false);
            return;
          }

          // Asegurarse de que la capa esté visible
          userLayer.setVisible(true);

          // Obtener atributos definidos para esta capa
          const layerAttrs = userLayer.get('attributes') || [];
          
          // Si hay atributos definidos, mostrar formulario para ingresar valores
          if (layerAttrs.length > 0) {
            // Inicializar valores de atributos
            const initialValues = {};
            layerAttrs.forEach(attr => {
              initialValues[attr.name] = attr.defaultValue || '';
            });
            setFeatureAttributes(initialValues);
            setShowAttributesForm(true);
            setIsSaving(false);
            return;
          }

          // Agregar feature a la capa (sin atributos)
          layerManager.addFeatureToUserLayer(layerId, drawnFeature);
          setModal({ isOpen: true, message: `Feature guardado en capa "${userLayer.get('title')}" (en memoria)`, type: "success", title: "Éxito" });
          
          // Guardar selección en localStorage
          localStorage.setItem('drawTool_lastTarget', targetLayer);
          localStorage.setItem('drawTool_lastExistingLayer', selectedExistingLayer);

          // Limpiar y cerrar
          drawLayerRef.current?.getSource().clear();
          setShowDialog(false);
          setDrawnFeature(null);

          // Notificar cambio
          if (layerManager && layerManager.onChange) {
            layerManager.onChange();
          }
          
          setIsSaving(false);
          return;
        }

        // Guardar en capa de GeoServer usando WFS Transaction
        // IMPORTANTE: Para guardar en la tabla "capa_usuario" (sin "0"), necesitamos usar
        // el nombre de la capa publicado en GeoServer (con "0"), pero la configuración de 
        // la capa en GeoServer debe estar apuntando a la tabla sin "0" en PostGIS.
        // 
        // Si GeoServer guarda en capa_usuario0 en lugar de capa_usuario, hay que reconfigurar
        // la capa en GeoServer:
        // 1. Ir a Layers → capa_usuario0 → Data
        // 2. Verificar que "Native name" apunte a la tabla "capa_usuario" (sin el 0)
        let layerId, layerName;
        if (isGeoServerUserLayer && selectedLayerInfo) {
          layerId = selectedLayerInfo.id; // ID de configuración (ej: "gisTPI:capa_usuario")
          
          // Para las capas de usuario de GeoServer, SIEMPRE usar el nombre con "0"
          // porque esa es la capa publicada en GeoServer (capa_usuario0, capa_usuario_linea0, etc.)
          const [workspace, tableName] = layerId.split(':');
          
          // Construir el nombre correcto con "0" al final
          // Para: gisTPI:capa_usuario → gisTPI:capa_usuario0
          // Para: gisTPI:capa_usuario_linea → gisTPI:capa_usuario_linea0
          // Para: gisTPI:capa_usuario_poligono → gisTPI:capa_usuario_poligono0
          layerName = `${workspace}:${tableName}0`;
          
          console.log(`Usando nombre de capa GeoServer: ${layerName} (desde ID: ${layerId})`);
          
          // Si es una capa de usuario de GeoServer, mostrar formulario de atributos PostGIS
          if (isGeoServerUserLayer) {
            setShowDialog(false); // Cerrar diálogo principal
            setShowPostgisForm(true); // Mostrar formulario PostGIS
            setIsSaving(false);
            return;
          }
        }
      } else {
        // Guardar en nueva capa de usuario (en memoria)
        if (!newLayerName.trim()) {
          setModal({ isOpen: true, message: "Por favor ingresa un nombre para la nueva capa", type: "warning", title: "Advertencia" });
          setIsSaving(false);
          return;
        }

        // Validar nombre de capa (sin espacios, caracteres especiales)
        const cleanName = newLayerName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
        const layerId = `user:${cleanName}`;

        // Verificar si la capa ya existe
        let userLayer = layerManager.userLayers[layerId];
        if (userLayer) {
          setModal({ isOpen: true, message: `Ya existe una capa con el nombre "${cleanName}". Por favor elige otro nombre o selecciona "Capa existente" para agregar a esa capa.`, type: "warning", title: "Advertencia" });
          setIsSaving(false);
          return;
        }

        // Para nueva capa, siempre mostrar formulario de atributos primero
        // (puede definir 0 atributos si no quiere)
        setShowAttributesForm(true);
        setIsSaving(false);
        return;
      }

      // Guardar selección en localStorage
      localStorage.setItem('drawTool_lastTarget', targetLayer);
      if (targetLayer === "existing") {
        localStorage.setItem('drawTool_lastExistingLayer', selectedExistingLayer);
      } else {
        localStorage.setItem('drawTool_lastNewLayer', newLayerName);
      }

      // Limpiar y cerrar
      drawLayerRef.current?.getSource().clear();
      setShowDialog(false);
      setDrawnFeature(null);

      // Notificar cambio para actualizar el panel de capas
      if (layerManager && layerManager.onChange) {
        layerManager.onChange();
      }
    } catch (error) {
      console.error("Error guardando feature:", error);
      setModal({ isOpen: true, message: `Error al guardar el feature: ${error.message}`, type: "error", title: "Error" });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Agrega un nuevo atributo al esquema de la capa
   */
  const addAttribute = () => {
    setLayerAttributes([...layerAttributes, { name: '', type: 'string', defaultValue: '' }]);
  };

  /**
   * Elimina un atributo del esquema de la capa
   * @param {number} index - Índice del atributo a eliminar
   */
  const removeAttribute = (index) => {
    setLayerAttributes(layerAttributes.filter((_, i) => i !== index));
    // También eliminar de featureAttributes si existe
    const attrName = layerAttributes[index]?.name;
    if (attrName) {
      const updated = { ...featureAttributes };
      delete updated[attrName];
      setFeatureAttributes(updated);
    }
  };

  /**
   * Actualiza un campo de un atributo en el esquema
   * @param {number} index - Índice del atributo
   * @param {string} field - Campo a actualizar ('name', 'type', 'defaultValue')
   * @param {any} value - Nuevo valor
   */
  const updateAttribute = (index, field, value) => {
    const updated = [...layerAttributes];
    const oldName = updated[index].name;
    updated[index] = { ...updated[index], [field]: value };
    setLayerAttributes(updated);
    
    // Si cambió el nombre, actualizar featureAttributes
    if (field === 'name' && oldName && oldName !== value) {
      const updatedFeatureAttrs = { ...featureAttributes };
      if (updatedFeatureAttrs[oldName] !== undefined) {
        updatedFeatureAttrs[value] = updatedFeatureAttrs[oldName];
        delete updatedFeatureAttrs[oldName];
        setFeatureAttributes(updatedFeatureAttrs);
      }
    }
  };

  /**
   * Actualiza el valor de un atributo para la feature actual
   * @param {string} name - Nombre del atributo
   * @param {any} value - Valor del atributo
   */
  const updateFeatureAttribute = (name, value) => {
    setFeatureAttributes({ ...featureAttributes, [name]: value });
  };

  /**
   * Guarda el feature con todos sus atributos
   * Se llama después de que el usuario completa el formulario de atributos
   */
  const saveFeatureWithAttributes = () => {
    if (!drawnFeature) return;

    setIsSaving(true);
    try {
      if (targetLayer === "new") {
        // Validar que todos los atributos tengan nombre
        const invalidAttrs = layerAttributes.filter(attr => !attr.name.trim());
        if (invalidAttrs.length > 0) {
          setModal({ isOpen: true, message: "Por favor completa el nombre de todos los atributos o elimina los que no uses.", type: "warning", title: "Advertencia" });
          setIsSaving(false);
          return;
        }

        // Crear nueva capa con atributos
        const cleanName = newLayerName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
        const layerId = `user:${cleanName}`;

        // Validar nombres de atributos (sin espacios, caracteres especiales)
        const cleanedAttributes = layerAttributes.map(attr => ({
          ...attr,
          name: attr.name.trim().replace(/[^a-zA-Z0-9_]/g, '_'),
        }));

        layerManager.createUserLayer(
          layerId,
          cleanName,
          geometryType,
          [],
          cleanedAttributes
        );

        // Agregar atributos a la feature (solo los que tienen valor)
        Object.keys(featureAttributes).forEach(key => {
          const value = featureAttributes[key];
          if (value !== '' && value !== null && value !== undefined) {
            // Convertir según el tipo
            const attrDef = cleanedAttributes.find(a => a.name === key);
            if (attrDef) {
              let finalValue = value;
              if (attrDef.type === 'number') {
                finalValue = parseFloat(value) || 0;
              } else if (attrDef.type === 'boolean') {
                finalValue = value === 'true' || value === true;
              }
              drawnFeature.set(key, finalValue);
            }
          }
        });

        layerManager.addFeatureToUserLayer(layerId, drawnFeature);
        setModal({ isOpen: true, message: `Feature guardado en capa "${cleanName}" (en memoria)`, type: "success", title: "Éxito" });
      } else {
        // Agregar a capa existente con atributos
        const layerId = selectedExistingLayer;
        const userLayer = layerManager.userLayers[layerId];
        const layerAttrs = userLayer?.get('attributes') || [];

        // Agregar atributos a la feature (solo los que tienen valor)
        Object.keys(featureAttributes).forEach(key => {
          const value = featureAttributes[key];
          if (value !== '' && value !== null && value !== undefined) {
            // Convertir según el tipo
            const attrDef = layerAttrs.find(a => a.name === key);
            if (attrDef) {
              let finalValue = value;
              if (attrDef.type === 'number') {
                finalValue = parseFloat(value) || 0;
              } else if (attrDef.type === 'boolean') {
                finalValue = value === 'true' || value === true;
              }
              drawnFeature.set(key, finalValue);
            }
          }
        });

        layerManager.addFeatureToUserLayer(layerId, drawnFeature);
        setModal({ isOpen: true, message: `Feature guardado en capa "${userLayer.get('title')}" (en memoria)`, type: "success", title: "Éxito" });
      }

      // Guardar selección en localStorage
      localStorage.setItem('drawTool_lastTarget', targetLayer);
      if (targetLayer === "existing") {
        localStorage.setItem('drawTool_lastExistingLayer', selectedExistingLayer);
      } else {
        localStorage.setItem('drawTool_lastNewLayer', newLayerName);
      }

      // Limpiar y cerrar
      drawLayerRef.current?.getSource().clear();
      setShowDialog(false);
      setShowAttributesForm(false);
      setDrawnFeature(null);
      setLayerAttributes([]);
      setFeatureAttributes({});

      // Notificar cambio
      if (layerManager && layerManager.onChange) {
        layerManager.onChange();
      }
    } catch (error) {
      console.error("Error guardando feature:", error);
      setModal({ isOpen: true, message: `Error al guardar el feature: ${error.message}`, type: "error", title: "Error" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    drawLayerRef.current?.getSource().clear();
    setShowDialog(false);
    setShowAttributesForm(false);
    setShowPostgisForm(false);
    setDrawnFeature(null);
    setLayerAttributes([]);
    setFeatureAttributes({});
    setPostgisAttributes({ nombre: '', tipo: '', descripcion: '' });
    // No resetear los valores, mantener la última selección
  };

  return (
    <>

      {showDialog && drawnFeature && (
        <div className="draw-dialog-overlay">
          <div className="draw-dialog">
            <h3>Guardar Feature</h3>
            <div className="draw-dialog-content">
              <div className="form-group">
                <label>Guardar en:</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="existing"
                      checked={targetLayer === "existing"}
                      onChange={(e) => {
                        setTargetLayer(e.target.value);
                        localStorage.setItem('drawTool_lastTarget', e.target.value);
                      }}
                    />
                    Capa existente
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="new"
                      checked={targetLayer === "new"}
                      onChange={(e) => {
                        setTargetLayer(e.target.value);
                        localStorage.setItem('drawTool_lastTarget', e.target.value);
                      }}
                    />
                    Nueva capa
                  </label>
                </div>
              </div>

              {targetLayer === "existing" && (
                <div className="form-group">
                  <label>Seleccionar capa ({geometryType === "Point" ? "Puntos" : geometryType === "LineString" ? "Líneas" : "Polígonos"}):</label>
                  {loadingLayers ? (
                    <p className="loading-message">Cargando capas compatibles...</p>
                  ) : (
                    <select
                      value={selectedExistingLayer}
                      onChange={(e) => {
                        setSelectedExistingLayer(e.target.value);
                        localStorage.setItem('drawTool_lastExistingLayer', e.target.value);
                      }}
                    >
                      <option value="">-- Selecciona una capa --</option>
                      {filteredLayers.map((layer) => {
                        // Usar siempre el ID de configuración para poder identificar la capa correctamente
                        const optionValue = layer.id;
                        const visibilityLabel = !layer.isVisible ? ' (no visible)' : '';
                        const layerTypeLabel = layer.isUserLayer ? ' (Usuario)' : '';
                        return (
                          <option key={layer.id} value={optionValue}>
                            {layer.displayName}{layerTypeLabel}{visibilityLabel}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              )}

              {targetLayer === "new" && (
                <div className="form-group">
                  <label>Nombre de la nueva capa:</label>
                  <input
                    type="text"
                    value={newLayerName}
                    onChange={(e) => {
                      setNewLayerName(e.target.value);
                      localStorage.setItem('drawTool_lastNewLayer', e.target.value);
                    }}
                    placeholder="ej: Mi_Capa (sin espacios ni caracteres especiales)"
                  />
                  <small className="form-hint">Solo letras, números y guiones bajos</small>
                </div>
              )}

              <div className="draw-dialog-actions">
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="btn-cancel"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveFeature}
                  disabled={
                    isSaving || 
                    (targetLayer === "existing" && !selectedExistingLayer) || 
                    (targetLayer === "new" && !newLayerName.trim())
                  }
                  className="btn-save"
                >
                  {isSaving ? "Guardando..." : "Siguiente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de atributos */}
      {showAttributesForm && drawnFeature && (
        <div className="draw-dialog-overlay">
          <div className="draw-dialog" style={{ maxWidth: '600px' }}>
            <h3>
              {targetLayer === "new" 
                ? "Definir Atributos de la Capa" 
                : "Ingresar Atributos del Feature"}
            </h3>
            <div className="draw-dialog-content">
              {targetLayer === "new" ? (
                // Formulario para definir atributos de nueva capa
                <>
                  <div className="form-group">
                    <label>Atributos de la capa:</label>
                    <small className="form-hint">Define los atributos que tendrán todas las features de esta capa</small>
                  </div>
                  
                  {layerAttributes.map((attr, index) => (
                    <div key={index} className="attribute-row">
                      <input
                        type="text"
                        placeholder="Nombre del atributo"
                        value={attr.name}
                        onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                        className="attr-name-input"
                      />
                      <select
                        value={attr.type}
                        onChange={(e) => updateAttribute(index, 'type', e.target.value)}
                        className="attr-type-select"
                      >
                        <option value="string">Texto</option>
                        <option value="number">Número</option>
                        <option value="boolean">Booleano</option>
                        <option value="date">Fecha</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Valor por defecto (opcional)"
                        value={attr.defaultValue}
                        onChange={(e) => updateAttribute(index, 'defaultValue', e.target.value)}
                        className="attr-default-input"
                      />
                      <button
                        type="button"
                        onClick={() => removeAttribute(index)}
                        className="btn-remove-attr"
                        title="Eliminar atributo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={addAttribute}
                    className="btn-add-attr"
                  >
                    + Agregar Atributo
                  </button>

                  {layerAttributes.length > 0 && (
                    <div className="form-group" style={{ marginTop: '20px' }}>
                      <label>Valores para esta feature:</label>
                      {layerAttributes.filter(attr => attr.name.trim()).map((attr, index) => {
                        const cleanAttrName = attr.name.trim().replace(/[^a-zA-Z0-9_]/g, '_');
                        return (
                          <div key={index} className="form-group" style={{ marginTop: '10px' }}>
                            <label style={{ fontSize: '13px' }}>{attr.name || `Atributo ${index + 1}`}:</label>
                            {attr.type === 'boolean' ? (
                              <select
                                value={featureAttributes[cleanAttrName] || attr.defaultValue || ''}
                                onChange={(e) => updateFeatureAttribute(cleanAttrName, e.target.value)}
                              >
                                <option value="">-- Seleccionar --</option>
                                <option value="true">Verdadero</option>
                                <option value="false">Falso</option>
                              </select>
                            ) : attr.type === 'number' ? (
                              <input
                                type="number"
                                value={featureAttributes[cleanAttrName] || attr.defaultValue || ''}
                                onChange={(e) => updateFeatureAttribute(cleanAttrName, e.target.value)}
                                placeholder={attr.defaultValue || "Ingrese un número"}
                              />
                            ) : attr.type === 'date' ? (
                              <input
                                type="date"
                                value={featureAttributes[cleanAttrName] || attr.defaultValue || ''}
                                onChange={(e) => updateFeatureAttribute(cleanAttrName, e.target.value)}
                              />
                            ) : (
                              <input
                                type="text"
                                value={featureAttributes[cleanAttrName] || attr.defaultValue || ''}
                                onChange={(e) => updateFeatureAttribute(cleanAttrName, e.target.value)}
                                placeholder={attr.defaultValue || "Ingrese un valor"}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                // Formulario para ingresar valores de atributos en capa existente
                <>
                  {(() => {
                    const selectedLayer = layerManager?.userLayers[selectedExistingLayer];
                    const attrs = selectedLayer?.get('attributes') || [];
                    
                    if (attrs.length === 0) {
                      return <p>Esta capa no tiene atributos definidos.</p>;
                    }
                    
                    return (
                      <>
                        <div className="form-group">
                          <label>Ingrese los valores de los atributos:</label>
                        </div>
                        {attrs.map((attr, index) => (
                          <div key={index} className="form-group">
                            <label>{attr.name}:</label>
                            {attr.type === 'boolean' ? (
                              <select
                                value={featureAttributes[attr.name] || ''}
                                onChange={(e) => updateFeatureAttribute(attr.name, e.target.value)}
                              >
                                <option value="">-- Seleccionar --</option>
                                <option value="true">Verdadero</option>
                                <option value="false">Falso</option>
                              </select>
                            ) : attr.type === 'number' ? (
                              <input
                                type="number"
                                value={featureAttributes[attr.name] || ''}
                                onChange={(e) => updateFeatureAttribute(attr.name, e.target.value)}
                                placeholder={attr.defaultValue || "Ingrese un número"}
                              />
                            ) : attr.type === 'date' ? (
                              <input
                                type="date"
                                value={featureAttributes[attr.name] || ''}
                                onChange={(e) => updateFeatureAttribute(attr.name, e.target.value)}
                              />
                            ) : (
                              <input
                                type="text"
                                value={featureAttributes[attr.name] || ''}
                                onChange={(e) => updateFeatureAttribute(attr.name, e.target.value)}
                                placeholder={attr.defaultValue || "Ingrese un valor"}
                              />
                            )}
                            <small className="form-hint" style={{ fontSize: '11px', color: '#666' }}>
                              Tipo: {attr.type === 'string' ? 'Texto' : attr.type === 'number' ? 'Número' : attr.type === 'boolean' ? 'Booleano' : 'Fecha'}
                            </small>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </>
              )}

              <div className="draw-dialog-actions">
                <button
                  onClick={() => {
                    setShowAttributesForm(false);
                    setIsSaving(false);
                  }}
                  disabled={isSaving}
                  className="btn-cancel"
                >
                  Atrás
                </button>
                <button
                  onClick={saveFeatureWithAttributes}
                  disabled={isSaving}
                  className="btn-save"
                >
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de atributos PostGIS */}
      {showPostgisForm && drawnFeature && (
        <div className="draw-dialog-overlay">
          <div className="draw-dialog" style={{ maxWidth: '500px' }}>
            <h3>Atributos del Feature</h3>
            <div className="draw-dialog-content">
              <div className="form-group">
                <label>Nombre:</label>
                <input
                  type="text"
                  value={postgisAttributes.nombre}
                  onChange={(e) => setPostgisAttributes({ ...postgisAttributes, nombre: e.target.value })}
                  placeholder="Ingrese el nombre"
                />
              </div>
              
              <div className="form-group">
                <label>Tipo:</label>
                <input
                  type="text"
                  value={postgisAttributes.tipo}
                  onChange={(e) => setPostgisAttributes({ ...postgisAttributes, tipo: e.target.value })}
                  placeholder="Ingrese el tipo"
                />
              </div>
              
              <div className="form-group">
                <label>Descripción:</label>
                <textarea
                  value={postgisAttributes.descripcion}
                  onChange={(e) => setPostgisAttributes({ ...postgisAttributes, descripcion: e.target.value })}
                  placeholder="Ingrese la descripción"
                  rows="4"
                  style={{ width: '100%', padding: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <div className="draw-dialog-actions">
                <button
                  onClick={() => {
                    setShowPostgisForm(false);
                    setShowDialog(true); // Volver al diálogo principal
                    setIsSaving(false);
                  }}
                  disabled={isSaving}
                  className="btn-cancel"
                >
                  Atrás
                </button>
                <button
                  onClick={() => saveFeatureToPostGIS(postgisAttributes)}
                  disabled={isSaving}
                  className="btn-save"
                >
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </>
  );
}

