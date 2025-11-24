import { useEffect, useRef } from "react";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Draw } from "ol/interaction";
import Overlay from "ol/Overlay";
import { getLength } from "ol/sphere";
import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style";
import { unByKey } from "ol/Observable";
import "./MapTools.css";

export default function MapTools({ map, activeTool }) {
  const measureLayerRef = useRef(null);
  const drawRef = useRef(null);
  const tooltipRef = useRef(null);
  const hintRef = useRef(null);

  // Create measurement layer once
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

  // Handle measurement tool
  useEffect(() => {
    if (!map || !measureLayerRef.current) return;

    const source = measureLayerRef.current.getSource();
    const targetElement = map.getTargetElement();

    const removeInteraction = () => {
      if (drawRef.current) {
        map.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
      if (tooltipRef.current) {
        map.removeOverlay(tooltipRef.current.overlay);
        tooltipRef.current.element.remove();
        tooltipRef.current = null;
      }
    };

    if (activeTool !== "measure") {
      removeInteraction();
      if (tooltipRef.current) {
        map.removeOverlay(tooltipRef.current.overlay);
        tooltipRef.current.element.remove();
        tooltipRef.current = null;
      }

      if (hintRef.current) {
        targetElement.removeChild(hintRef.current);
        hintRef.current = null;
      }
      return;
    }

    if (!hintRef.current) {
      const hint = document.createElement("div");
      hint.className = "measure-hint";
      hint.textContent = "Click para comenzar, doble clic para finalizar";
      targetElement.appendChild(hint);
      hintRef.current = hint;
    }

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

    const draw = new Draw({
      source,
      type: "LineString",
      style: new Style({
        stroke: new Stroke({
          color: "#1a73e8",
          width: 3,
          lineDash: [10, 10],
        }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: "#1a73e8" }),
          stroke: new Stroke({ color: "#fff", width: 2 }),
        }),
      }),
    });

    map.addInteraction(draw);
    drawRef.current = draw;

    let sketch;

    const formatLength = (line) => {
      const length = getLength(line, { projection: map.getView().getProjection() });
      if (length > 1000) {
        return `${(length / 1000).toFixed(2)} km`;
      }
      return `${length.toFixed(0)} m`;
    };

    let geometryListener = null;

    const onChange = (event) => {
      const geom = event.target;
      const output = formatLength(geom);
      const html = document.createElement("span");
      html.textContent = output;
      tooltipElement.innerHTML = "";
      tooltipElement.appendChild(html);

      // El tooltip temporal debe seguir el mouse (último punto de la línea)
      const coords = geom.getCoordinates();
      if (coords.length > 0) {
        // El último punto es donde está el cursor del mouse
        const lastPoint = coords[coords.length - 1];
        tooltipOverlay.setPosition(lastPoint);
      }
    };

    draw.on("drawstart", (event) => {
      sketch = event.feature;
      geometryListener = sketch.getGeometry().on("change", onChange);
      // Asegurar que el tooltip esté visible para la nueva medición
      if (tooltipElement) {
        tooltipElement.style.display = "";
        tooltipElement.innerHTML = "";
      }
    });

    draw.on("drawend", (event) => {
      const feature = event.feature;
      const geometry = feature.getGeometry();
      const coords = geometry.getCoordinates();
      
      // Desactivar el listener de geometría para que no siga moviendo el tooltip
      if (geometryListener) {
        unByKey(geometryListener);
        geometryListener = null;
      }
      
      // Calcular y mostrar la distancia final
      const finalLength = formatLength(geometry);
      const lengthSpan = document.createElement("span");
      lengthSpan.textContent = finalLength;
      tooltipElement.innerHTML = "";
      tooltipElement.appendChild(lengthSpan);
      
      // Posicionar el tooltip en el último punto de la medición (punto final)
      const lastPoint = coords[coords.length - 1];
      
      // Asegurar que el positioning y offset estén correctos
      tooltipOverlay.setPositioning("bottom-center");
      tooltipOverlay.setOffset([0, -7]);
      tooltipOverlay.setPosition(lastPoint);
      
      tooltipElement.className = "measure-tooltip measure-tooltip-static";
      const currentTooltipElement = tooltipElement;
      const currentOverlay = tooltipOverlay;

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

      // create new tooltip for next measurement
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

      if (geometryListener) {
        unByKey(geometryListener);
        geometryListener = null;
      }
    });

    draw.on("drawabort", () => {
      // Limpiar tooltip provisional cuando se cancela
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

    const handleContextMenu = (e) => {
      if (activeTool !== "measure") return;
      e.preventDefault();
      if (drawRef.current) {
        draw.abortDrawing();
      }
    };

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
      removeInteraction();
      if (tooltipRef.current) {
        map.removeOverlay(tooltipRef.current.overlay);
        tooltipRef.current.element.remove();
        tooltipRef.current = null;
      }
      if (hintRef.current) {
        targetElement.removeChild(hintRef.current);
        hintRef.current = null;
      }
      targetElement.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      if (geometryListener) {
        unByKey(geometryListener);
      }
    };
  }, [activeTool, map]);

  return null;
}

