/**
 * ScaleBar - Barra de escala gráfica
 * 
 * Muestra una barra de escala que representa una distancia real en el mapa
 * Se actualiza automáticamente cuando cambia el zoom o se mueve el mapa
 * Calcula valores "bonitos" (1, 2, 5, 10, 20, 50, etc.) para mostrar
 */

import React, { useState, useEffect } from "react";
import "./ScaleBar.css";

/**
 * Componente ScaleBar
 * @param {ol.Map} map - Instancia del mapa de OpenLayers
 */
export default function ScaleBar({ map }) {
  const [scaleInfo, setScaleInfo] = useState({ distance: "", width: 100 });

  useEffect(() => {
    if (!map) return;

    const updateScale = () => {
      const view = map.getView();
      const resolution = view.getResolution();
      const units = view.getProjection().getUnits();
      
      if (units === "m" && resolution) {
        // Ancho fijo de la barra de escala en píxeles
        const scaleBarWidth = 100;
        
        // Calcular la distancia real que representa la barra
        // resolution está en metros por píxel
        const meters = resolution * scaleBarWidth;
        
        // Redondear a un valor "bonito" para mostrar
        let niceDistance, niceWidth, unit;
        
        if (meters >= 1000) {
          // Para distancias grandes, usar km
          const km = meters / 1000;
          // Redondear a valores bonitos: 1, 2, 5, 10, 20, 50, 100, 200, 500, etc.
          const magnitude = Math.pow(10, Math.floor(Math.log10(km)));
          const normalized = km / magnitude;
          let niceValue;
          
          if (normalized <= 1) niceValue = 1;
          else if (normalized <= 2) niceValue = 2;
          else if (normalized <= 5) niceValue = 5;
          else niceValue = 10;
          
          niceDistance = niceValue * magnitude;
          niceWidth = (niceDistance * 1000) / resolution;
          unit = "km";
        } else {
          // Para distancias pequeñas, usar metros
          const magnitude = Math.pow(10, Math.floor(Math.log10(meters)));
          const normalized = meters / magnitude;
          let niceValue;
          
          if (normalized <= 1) niceValue = 1;
          else if (normalized <= 2) niceValue = 2;
          else if (normalized <= 5) niceValue = 5;
          else niceValue = 10;
          
          niceDistance = niceValue * magnitude;
          niceWidth = niceDistance / resolution;
          unit = "m";
        }
        
        // Limitar el ancho máximo
        const maxWidth = 150;
        if (niceWidth > maxWidth) {
          niceWidth = maxWidth;
          niceDistance = niceWidth * resolution;
          if (niceDistance >= 1000) {
            niceDistance = Math.round(niceDistance / 1000);
            unit = "km";
          } else {
            niceDistance = Math.round(niceDistance);
            unit = "m";
          }
        }
        
        setScaleInfo({
          distance: `${niceDistance} ${unit}`,
          width: Math.min(niceWidth, maxWidth)
        });
      } else {
        setScaleInfo({ distance: "", width: 100 });
      }
    };

    updateScale();
    map.on("moveend", updateScale);
    map.getView().on("change:resolution", updateScale);
    map.on("resize", updateScale);

    return () => {
      map.un("moveend", updateScale);
      map.getView().un("change:resolution", updateScale);
      map.un("resize", updateScale);
    };
  }, [map]);

  if (!scaleInfo.distance) return null;

  return (
    <div className="scale-bar">
      <div className="scale-line" style={{ width: `${scaleInfo.width}px` }}></div>
      <span className="scale-text">{scaleInfo.distance}</span>
    </div>
  );
}

