/**
 * MeasureTool - Herramienta para medir distancias y áreas en el mapa
 * 
 * Permite al usuario:
 * - Medir distancias (longitud de líneas)
 * - Medir áreas (superficie de polígonos)
 * 
 * Muestra tooltips con las mediciones en tiempo real mientras se dibuja
 * y permite agregar puntos desde la barra de búsqueda.
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Draw } from "ol/interaction";
import Overlay from "ol/Overlay";
import { getLength, getArea } from "ol/sphere";
import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style";
import { unByKey } from "ol/Observable";
import Feature from "ol/Feature";
import { LineString, Polygon } from "ol/geom";
import "./MeasureTool.css";

/**
 * Componente MeasureTool (con forwardRef para exponer métodos al componente padre)
 * @param {ol.Map} map - Instancia del mapa de OpenLayers
 * @param {string} activeTool - Herramienta actualmente activa (debe ser "measure" para activarse)
 * @param {string} propMeasureType - Tipo de medición: "length" o "area"
 * @param {function} onMeasureTypeChange - Callback cuando cambia el tipo de medición
 * @param {ref} ref - Referencia para exponer métodos (addPoint, clearMeasurement, etc.)
 */
const MeasureTool = forwardRef(function MeasureTool({ map, activeTool, measureType: propMeasureType, onMeasureTypeChange }, ref) {
  const drawRef = useRef(null);
  const measureLayerRef = useRef(null);
  const tooltipRef = useRef(null);
  const hintRef = useRef(null);
  const currentFeatureRef = useRef(null);
  const measureType = propMeasureType !== undefined ? propMeasureType : "length";

  /**
   * Crear capa vectorial para mostrar las mediciones en el mapa
   * Las mediciones se dibujan como features temporales
   */
  useEffect(() => {
    if (!map) return;

    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      style: new Style({
        stroke: new Stroke({
          color: "#1a73e8",
          width: 3,
        }),
        fill: new Fill({
          color: "rgba(26, 115, 232, 0.2)",
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({
            color: "#1a73e8",
          }),
          stroke: new Stroke({
            color: "#fff",
            width: 2,
          }),
        }),
      }),
    });

    layer.setZIndex(50);
    map.addLayer(layer);
    measureLayerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      measureLayerRef.current = null;
    };
  }, [map]);

  /**
   * Manejar la activación/desactivación de la herramienta de medición
   * Crea la interacción de dibujo y los tooltips para mostrar las mediciones
   */
  useEffect(() => {
    if (!map || !measureLayerRef.current || activeTool !== "measure") {
      if (drawRef.current) {
        map?.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
      if (tooltipRef.current) {
        map.removeOverlay(tooltipRef.current.overlay);
        tooltipRef.current.element.remove();
        tooltipRef.current = null;
      }
      if (hintRef.current) {
        const targetElement = map.getTargetElement();
        if (targetElement && hintRef.current.parentNode === targetElement) {
          targetElement.removeChild(hintRef.current);
        }
        hintRef.current = null;
      }
      // Limpiar feature actual cuando se desactiva la herramienta
      currentFeatureRef.current = null;
      return;
    }

    const source = measureLayerRef.current.getSource();
    const targetElement = map.getTargetElement();

    // Función para actualizar el hint
    const updateHint = (message) => {
      if (hintRef.current) {
        if (message) {
          hintRef.current.textContent = message;
          hintRef.current.style.display = "";
        } else {
          hintRef.current.style.display = "none";
        }
      }
    };

    // Función para obtener el mensaje inicial según el tipo de medición
    const getInitialMessage = () => {
      if (measureType === "length") {
        return "Dibuja una línea en el mapa. Doble clic para finalizar";
      } else if (measureType === "area") {
        return "Dibuja un polígono en el mapa. Vuelve al primer punto para finalizar";
      }
      return "Selecciona un tipo de medición";
    };

    // Mostrar hint
    if (!hintRef.current) {
      const hint = document.createElement("div");
      hint.className = "measure-hint";
      hint.textContent = getInitialMessage();
      targetElement.appendChild(hint);
      hintRef.current = hint;
    } else {
      updateHint(getInitialMessage());
    }

    // Limpiar mediciones anteriores
    source.clear();

    // Crear tooltip para mostrar medidas
    let tooltipElement = document.createElement("div");
    tooltipElement.className = "measure-tooltip";
    let tooltipOverlay = new Overlay({
      element: tooltipElement,
      offset: [0, -15],
      positioning: "bottom-center",
      stopEvent: false,
    });
    map.addOverlay(tooltipOverlay);
    tooltipRef.current = { element: tooltipElement, overlay: tooltipOverlay };

    // Determinar el tipo de geometría según el tipo de medición
    const geometryType = measureType === "length" ? "LineString" : "Polygon";

    // Crear interacción de dibujo
    const draw = new Draw({
      source,
      type: geometryType,
      style: new Style({
        stroke: new Stroke({
          color: "#1a73e8",
          width: 3,
          lineDash: [10, 10],
        }),
        fill: new Fill({
          color: "rgba(26, 115, 232, 0.2)",
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({
            color: "#1a73e8",
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

    // Funciones para formatear medidas
    const formatLength = (line) => {
      const length = getLength(line, { projection: map.getView().getProjection() });
      if (length > 1000) {
        return `${(length / 1000).toFixed(2)} km`;
      }
      return `${length.toFixed(0)} m`;
    };

    const formatArea = (polygon) => {
      const area = getArea(polygon, { projection: map.getView().getProjection() });
      if (area > 1000000) {
        return `${(area / 1000000).toFixed(2)} km²`;
      }
      return `${area.toFixed(0)} m²`;
    };

    let sketch;
    let geometryListener = null;

    const onChange = (event) => {
      const geom = event.target;
      let output;
      
      if (measureType === "length") {
        output = formatLength(geom);
      } else {
        output = formatArea(geom);
      }
      
      const html = document.createElement("span");
      html.textContent = output;
      tooltipElement.innerHTML = "";
      tooltipElement.appendChild(html);

      // El tooltip temporal debe seguir el mouse (último punto)
      const coords = geom.getCoordinates();
      if (coords.length > 0) {
        let lastPoint;
        if (measureType === "length") {
          lastPoint = coords[coords.length - 1];
        } else {
          // Para polígonos, el último punto es el que sigue al cursor
          const polygonCoords = coords[0]; // Los polígonos tienen coordenadas anidadas
          if (polygonCoords && polygonCoords.length > 0) {
            lastPoint = polygonCoords[polygonCoords.length - 1];
          }
        }
        if (lastPoint) {
          tooltipOverlay.setPosition(lastPoint);
        }
      }
    };

    draw.on("drawstart", (event) => {
      sketch = event.feature;
      if (sketch) {
        geometryListener = sketch.getGeometry().on("change", onChange);
      }
      
      // Actualizar hint cuando comienza el dibujo
      if (measureType === "length") {
        updateHint("Dibuja una línea en el mapa. Doble clic para finalizar");
      } else {
        updateHint("Dibuja un polígono en el mapa. Vuelve al primer punto para finalizar");
      }
      
      // Asegurar que el tooltip esté visible
      if (tooltipElement) {
        tooltipElement.style.display = "";
        tooltipElement.innerHTML = "";
      }
    });

    draw.on("drawend", (event) => {
      const feature = event.feature;
      const geometry = feature.getGeometry();
      
      // Desactivar el listener de geometría
      if (geometryListener) {
        unByKey(geometryListener);
        geometryListener = null;
      }
      
      // Limpiar feature actual (ya terminó el dibujo manual)
      currentFeatureRef.current = null;
      
      // Calcular y mostrar la medida final
      let finalMeasure;
      if (measureType === "length") {
        finalMeasure = formatLength(geometry);
      } else {
        finalMeasure = formatArea(geometry);
      }
      
      const measureSpan = document.createElement("span");
      measureSpan.textContent = finalMeasure;
      tooltipElement.innerHTML = "";
      tooltipElement.appendChild(measureSpan);
      
      // Posicionar el tooltip
      let positionPoint;
      if (measureType === "length") {
        const coords = geometry.getCoordinates();
        positionPoint = coords[coords.length - 1];
      } else {
        const extent = geometry.getExtent();
        positionPoint = [
          (extent[0] + extent[2]) / 2,
          (extent[1] + extent[3]) / 2,
        ];
      }
      
      tooltipOverlay.setPositioning("bottom-center");
      tooltipOverlay.setOffset([0, -7]);
      tooltipOverlay.setPosition(positionPoint);
      
      tooltipElement.className = "measure-tooltip measure-tooltip-static";
      const currentTooltipElement = tooltipElement;
      const currentOverlay = tooltipOverlay;

      // Botón para eliminar la medición
      const deleteButton = document.createElement("button");
      deleteButton.className = "measure-delete";
      deleteButton.textContent = "✕";
      deleteButton.title = "Eliminar medición";
      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        source.removeFeature(feature);
        map.removeOverlay(currentOverlay);
        currentTooltipElement.remove();
      });
      currentTooltipElement.appendChild(deleteButton);

      sketch = null;

      // Ocultar hint cuando termina la medición
      if (hintRef.current) {
        hintRef.current.style.display = "none";
      }

      // Crear nuevo tooltip para la próxima medición
      tooltipElement = document.createElement("div");
      tooltipElement.className = "measure-tooltip";
      tooltipOverlay = new Overlay({
        element: tooltipElement,
        offset: [0, -15],
        positioning: "bottom-center",
        stopEvent: false,
      });
      map.addOverlay(tooltipOverlay);
      tooltipRef.current = { element: tooltipElement, overlay: tooltipOverlay };
    });

    draw.on("drawabort", () => {
      // Restaurar hint cuando se aborta el dibujo
      if (measureType === "length") {
        updateHint("Dibuja una línea en el mapa. Doble clic para finalizar");
      } else {
        updateHint("Dibuja un polígono en el mapa. Vuelve al primer punto para finalizar");
      }
      
      // Limpiar tooltip provisional
      if (tooltipRef.current && tooltipOverlay) {
        tooltipOverlay.setPosition(undefined);
        tooltipElement.innerHTML = "";
        tooltipElement.style.display = "none";
      }
      if (geometryListener) {
        unByKey(geometryListener);
        geometryListener = null;
      }
      sketch = null;
    });

    // Manejar clic derecho para cancelar
    const handleContextMenu = (e) => {
      if (activeTool !== "measure") return;
      e.preventDefault();
      if (drawRef.current) {
        draw.abortDrawing();
      }
    };

    // Manejar Escape para cancelar
    const handleKeyDown = (e) => {
      if (activeTool !== "measure") return;
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        if (drawRef.current) {
          draw.abortDrawing();
        }
      }
    };

    targetElement.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (drawRef.current) {
        map.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
      if (tooltipRef.current) {
        map.removeOverlay(tooltipRef.current.overlay);
        tooltipRef.current.element.remove();
        tooltipRef.current = null;
      }
      if (hintRef.current) {
        if (targetElement && hintRef.current.parentNode === targetElement) {
          targetElement.removeChild(hintRef.current);
        }
        hintRef.current = null;
      }
      targetElement.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      if (geometryListener) {
        unByKey(geometryListener);
      }
    };
  }, [map, activeTool, measureType]);

  /**
   * Expone métodos al componente padre mediante useImperativeHandle
   * Permite que otros componentes (como SearchBar) agreguen puntos a la medición
   */
  useImperativeHandle(ref, () => ({
    /**
     * Agrega un punto a la medición actual desde coordenadas externas
     * Útil para agregar puntos desde la barra de búsqueda
     * @param {Array<number>} coordinates - Coordenadas [x, y] en EPSG:3857
     */
    addPoint: (coordinates) => {
      if (!map || !measureLayerRef.current || activeTool !== "measure") return;
      
      const source = measureLayerRef.current.getSource();
      
      // Funciones para formatear medidas
      const formatLength = (line) => {
        const length = getLength(line, { projection: map.getView().getProjection() });
        if (length > 1000) {
          return `${(length / 1000).toFixed(2)} km`;
        }
        return `${length.toFixed(0)} m`;
      };

      const formatArea = (polygon) => {
        const area = getArea(polygon, { projection: map.getView().getProjection() });
        if (area > 1000000) {
          return `${(area / 1000000).toFixed(2)} km²`;
        }
        return `${area.toFixed(0)} m²`;
      };
      
      // Si no hay feature actual, crear una nueva
      if (!currentFeatureRef.current) {
        const geometryType = measureType === "length" ? "LineString" : "Polygon";
        let geometry;
        
        if (geometryType === "LineString") {
          geometry = new LineString([coordinates]);
        } else {
          geometry = new Polygon([[coordinates]]);
        }
        
        const feature = new Feature({ geometry });
        source.addFeature(feature);
        currentFeatureRef.current = feature;
        
        // Crear tooltip si no existe
        if (!tooltipRef.current) {
          let tooltipElement = document.createElement("div");
          tooltipElement.className = "measure-tooltip";
          let tooltipOverlay = new Overlay({
            element: tooltipElement,
            offset: [0, -15],
            positioning: "bottom-center",
            stopEvent: false,
          });
          map.addOverlay(tooltipOverlay);
          tooltipRef.current = { element: tooltipElement, overlay: tooltipOverlay };
        }
        
        // Mostrar medida inicial (0 para el primer punto)
        const measure = measureType === "length" ? "0 m" : "0 m²";
        tooltipRef.current.element.innerHTML = `<span>${measure}</span>`;
        tooltipRef.current.overlay.setPosition(coordinates);
      } else {
        // Agregar punto a la feature existente
        const geometry = currentFeatureRef.current.getGeometry();
        const coords = geometry.getCoordinates();
        
        if (measureType === "length") {
          // Para líneas, agregar al final
          coords.push(coordinates);
          geometry.setCoordinates(coords);
        } else {
          // Para polígonos, agregar al anillo exterior
          const ring = coords[0];
          ring.push(coordinates);
          geometry.setCoordinates(coords);
        }
        
        // Calcular y mostrar medida
        let measure;
        if (measureType === "length") {
          measure = formatLength(geometry);
        } else {
          measure = formatArea(geometry);
        }
        
        // Actualizar tooltip
        if (tooltipRef.current) {
          const tooltipElement = tooltipRef.current.element;
          tooltipElement.innerHTML = `<span>${measure}</span>`;
          tooltipRef.current.overlay.setPosition(coordinates);
        }
      }
    },
    /**
     * Limpia todas las mediciones del mapa
     */
    clearMeasurement: () => {
      if (measureLayerRef.current) {
        measureLayerRef.current.getSource().clear();
        currentFeatureRef.current = null;
      }
    },
    /**
     * Verifica si hay una medición en progreso
     * @returns {boolean} true si hay una medición activa
     */
    hasActiveMeasurement: () => {
      return currentFeatureRef.current !== null;
    },
    /**
     * Finaliza la medición actual y la convierte en una medición permanente
     * Agrega un botón de eliminar al tooltip
     */
    finishMeasurement: () => {
      if (!map || !measureLayerRef.current || !currentFeatureRef.current) return;
      
      const feature = currentFeatureRef.current;
      const geometry = feature.getGeometry();
      
      // Funciones para formatear medidas
      const formatLength = (line) => {
        const length = getLength(line, { projection: map.getView().getProjection() });
        if (length > 1000) {
          return `${(length / 1000).toFixed(2)} km`;
        }
        return `${length.toFixed(0)} m`;
      };

      const formatArea = (polygon) => {
        const area = getArea(polygon, { projection: map.getView().getProjection() });
        if (area > 1000000) {
          return `${(area / 1000000).toFixed(2)} km²`;
        }
        return `${area.toFixed(0)} m²`;
      };
      
      // Calcular medida final
      let finalMeasure;
      if (measureType === "length") {
        finalMeasure = formatLength(geometry);
      } else {
        finalMeasure = formatArea(geometry);
      }
      
      // Crear tooltip final si no existe
      if (!tooltipRef.current) {
        let tooltipElement = document.createElement("div");
        tooltipElement.className = "measure-tooltip measure-tooltip-static";
        let tooltipOverlay = new Overlay({
          element: tooltipElement,
          offset: [0, -7],
          positioning: "bottom-center",
          stopEvent: false,
        });
        map.addOverlay(tooltipOverlay);
        tooltipRef.current = { element: tooltipElement, overlay: tooltipOverlay };
      }
      
      // Actualizar tooltip con medida final
      const tooltipElement = tooltipRef.current.element;
      tooltipElement.className = "measure-tooltip measure-tooltip-static";
      tooltipElement.innerHTML = `<span>${finalMeasure}</span>`;
      
      // Posicionar tooltip
      let positionPoint;
      if (measureType === "length") {
        const coords = geometry.getCoordinates();
        positionPoint = coords[coords.length - 1];
      } else {
        const extent = geometry.getExtent();
        positionPoint = [
          (extent[0] + extent[2]) / 2,
          (extent[1] + extent[3]) / 2,
        ];
      }
      tooltipRef.current.overlay.setPosition(positionPoint);
      
      // Guardar referencias al tooltip actual antes de crear uno nuevo
      const currentTooltipElement = tooltipElement;
      const currentTooltipOverlay = tooltipRef.current.overlay;
      const source = measureLayerRef.current.getSource();
      
      // Agregar botón de eliminar
      const deleteButton = document.createElement("button");
      deleteButton.className = "measure-delete";
      deleteButton.textContent = "✕";
      deleteButton.title = "Eliminar medición";
      deleteButton.addEventListener("click", (e) => {
        e.stopPropagation();
        // Eliminar la feature del mapa
        source.removeFeature(feature);
        // Eliminar el overlay
        map.removeOverlay(currentTooltipOverlay);
        currentTooltipElement.remove();
        // Limpiar referencias
        if (tooltipRef.current && tooltipRef.current.overlay === currentTooltipOverlay) {
          tooltipRef.current = null;
        }
        currentFeatureRef.current = null;
      });
      tooltipElement.appendChild(deleteButton);
      
      // Limpiar referencia para permitir nueva medición
      currentFeatureRef.current = null;
      
      // Crear nuevo tooltip para la próxima medición
      let newTooltipElement = document.createElement("div");
      newTooltipElement.className = "measure-tooltip";
      let newTooltipOverlay = new Overlay({
        element: newTooltipElement,
        offset: [0, -15],
        positioning: "bottom-center",
        stopEvent: false,
      });
      map.addOverlay(newTooltipOverlay);
      tooltipRef.current = { element: newTooltipElement, overlay: newTooltipOverlay };
    }
  }));

  return null;
});

export default MeasureTool;

