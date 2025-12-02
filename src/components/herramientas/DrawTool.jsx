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
import { URL_WFS } from "../../config";
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
  const hintRef = useRef(null);
  const [modal, setModal] = useState({ isOpen: false, message: "", type: "info", title: "" });

  /**
   * Crear capa temporal para mostrar el dibujo mientras se está dibujando
   * Esta capa se usa solo para visualización temporal, no se guarda
   */
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

    draw.on("drawend", (event) => {
      const feature = event.feature;
      setDrawnFeature(feature);
      setShowDialog(true);
      // Ocultar hint cuando termina el dibujo
      if (hintRef.current) {
        updateHint("");
      }
      // Desactivar la herramienta temporalmente
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
   * Obtiene las capas de usuario visibles que son compatibles con el tipo de geometría actual
   * Solo muestra capas que tienen el mismo tipo de geometría que se está dibujando
   * @returns {Array} Array de capas compatibles con su información
   */
  const getVisibleLayersForSelection = useCallback(async () => {
    if (!layerManager) return [];
    
    // Solo obtener capas de usuario visibles
    const allVisible = [];
    const userLayers = layerManager.getUserLayers();
    
    Object.keys(userLayers).forEach((layerId) => {
      const layer = userLayers[layerId];
      if (layer.getVisible()) {
        const layerGeomType = layer.get('geometryType');
        allVisible.push({
          id: layerId,
          name: layerId, // Para capas de usuario, usar el ID como nombre
          displayName: layer.get('title') || layerId.replace('user:', ''),
          isUserLayer: true,
          geometryType: layerGeomType, // Ya tenemos el tipo de geometría
        });
      }
    });

    // Filtrar por tipo de geometría que coincide con el dibujado
    const filtered = allVisible.filter(layer => {
      return layer.geometryType === geometryType;
    });

    return filtered;
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
            // Para capas de usuario, comparar por ID; para GeoServer, por name
            if (l.isUserLayer) {
              return l.id === selectedExistingLayer;
            } else {
              return l.name === selectedExistingLayer;
            }
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

        // Verificar si es una capa de usuario
        const isUserLayer = selectedExistingLayer.startsWith('user:');
        
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
        const layerName = selectedExistingLayer;
        const format = new GeoJSON();
        const geometry = drawnFeature.getGeometry();
        
        // Convertir geometría a GeoJSON en EPSG:4326
        const featureJSON = format.writeFeature(drawnFeature, {
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

        const layerNameOnly = layerName.split(':')[1];
        const geomFieldName = `${layerNameOnly}_geom`;

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
          throw new Error(`Error del servidor: ${response.status}`);
        }

        const resultXML = await response.text();
        if (resultXML.includes("Exception") || resultXML.includes("error")) {
          throw new Error("El servidor reportó un error al guardar el feature");
        }

        setModal({ isOpen: true, message: "Feature guardado exitosamente en GeoServer", type: "success", title: "Éxito" });
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
    setDrawnFeature(null);
    setLayerAttributes([]);
    setFeatureAttributes({});
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
                  ) : filteredLayers.length === 0 ? (
                    <p className="no-layers-message">
                      No hay capas visibles de tipo {geometryType === "Point" ? "punto" : geometryType === "LineString" ? "línea" : "polígono"}. 
                      Activa al menos una capa compatible para guardar aquí.
                    </p>
                  ) : (
                    <select
                      value={selectedExistingLayer}
                      onChange={(e) => {
                        setSelectedExistingLayer(e.target.value);
                        localStorage.setItem('drawTool_lastExistingLayer', e.target.value);
                      }}
                    >
                      <option value="">-- Selecciona una capa --</option>
                      {filteredLayers.map((layer) => (
                        <option key={layer.id} value={layer.isUserLayer ? layer.id : layer.name}>
                          {layer.displayName} {layer.isUserLayer ? '(Usuario)' : ''}
                        </option>
                      ))}
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

