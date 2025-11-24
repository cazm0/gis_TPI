import { useEffect, useRef } from "react";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Draw } from "ol/interaction";
import Overlay from "ol/Overlay";
import { getLength } from "ol/sphere";
import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style";
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

    const tooltipElement = document.createElement("div");
    tooltipElement.className = "measure-tooltip";
    const tooltipOverlay = new Overlay({
      element: tooltipElement,
      offset: [0, -15],
      positioning: "bottom-center",
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

    const onChange = (event) => {
      const geom = event.target;
      const output = formatLength(geom);
      tooltipElement.innerHTML = output;
      tooltipOverlay.setPosition(geom.getLastCoordinate());
    };

    draw.on("drawstart", (event) => {
      sketch = event.feature;
      sketch.getGeometry().on("change", onChange);
    });

    draw.on("drawend", () => {
      tooltipElement.className = "measure-tooltip measure-tooltip-static";
      tooltipOverlay.setOffset([0, -7]);
      sketch = null;

      // create new tooltip for next measurement
      const newTooltipElement = document.createElement("div");
      newTooltipElement.className = "measure-tooltip";
      const newOverlay = new Overlay({
        element: newTooltipElement,
        offset: [0, -15],
        positioning: "bottom-center",
      });
      map.addOverlay(newOverlay);
      tooltipRef.current = { element: newTooltipElement, overlay: newOverlay };
    });

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
    };
  }, [activeTool, map]);

  return null;
}

