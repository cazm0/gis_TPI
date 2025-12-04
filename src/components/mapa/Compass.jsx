import React, { useState, useEffect, useRef } from "react";
import "./Compass.css";

export default function Compass({ map }) {
  const [rotation, setRotation] = useState(0);
  const prevRotationRef = useRef(0);

  useEffect(() => {
    if (!map) return;

    const updateRotation = () => {
      const view = map.getView();
      const currentRotation = view.getRotation();
      // Convertir de radianes a grados
      let degrees = (currentRotation * 180) / Math.PI;
      
      // Normalizar el ángulo para evitar saltos cuando pasa de 180/-180
      // Mantener el ángulo en el rango más cercano al anterior
      let normalized = degrees;
      const prev = prevRotationRef.current;
      
      // Si la diferencia es mayor a 180, ajustar para tomar el camino más corto
      while (normalized - prev > 180) {
        normalized -= 360;
      }
      while (normalized - prev < -180) {
        normalized += 360;
      }
      
      prevRotationRef.current = normalized;
      setRotation(normalized);
    };

    updateRotation();
    
    const view = map.getView();
    view.on("change:rotation", updateRotation);

    return () => {
      view.un("change:rotation", updateRotation);
    };
  }, [map]);

  const handleResetNorth = () => {
    if (map) {
      const view = map.getView();
      view.animate({
        rotation: 0,
        duration: 300,
      });
    }
  };

  return (
    <div className="compass-container">
      <div 
        className="compass-rose" 
        style={{ transform: `rotate(${rotation}deg)` }}
        onClick={handleResetNorth}
        title="Hacer clic para orientar al norte"
      >
        <svg width="44" height="44" viewBox="0 0 44 44">
          {/* Círculo exterior */}
          <circle 
            cx="22" 
            cy="22" 
            r="20" 
            fill="rgba(255, 255, 255, 0.98)" 
            stroke="#5f6368" 
            strokeWidth="1.2"
          />
          
          {/* Marcas cardinales (N, S, E, W) - más largas */}
          {[0, 90, 180, 270].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 22 + 20 * Math.sin(rad);
            const y1 = 22 - 20 * Math.cos(rad);
            const x2 = 22 + 14 * Math.sin(rad);
            const y2 = 22 - 14 * Math.cos(rad);
            
            return (
              <line
                key={`cardinal-${angle}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#5f6368"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            );
          })}
          
          {/* Marcas intercardinales (NE, SE, SW, NW) - más cortas */}
          {[45, 135, 225, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 22 + 20 * Math.sin(rad);
            const y1 = 22 - 20 * Math.cos(rad);
            const x2 = 22 + 16 * Math.sin(rad);
            const y2 = 22 - 16 * Math.cos(rad);
            
            return (
              <line
                key={`intercardinal-${angle}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#5f6368"
                strokeWidth="1"
                strokeLinecap="round"
              />
            );
          })}
          
          {/* Aguja del compás - Norte (roja) - más grande y clara */}
          <polygon 
            points="22,3 17,18 22,14 27,18" 
            fill="#d32f2f"
            stroke="#b71c1c"
            strokeWidth="0.3"
          />
          
          {/* Aguja del compás - Sur (gris oscuro) - más grande */}
          <polygon 
            points="22,41 17,26 22,30 27,26" 
            fill="#424242"
            stroke="#212121"
            strokeWidth="0.3"
          />
          
          {/* Círculo central - más pequeño para no encimar */}
          <circle 
            cx="22" 
            cy="22" 
            r="2.5" 
            fill="#424242"
          />
        </svg>
      </div>
    </div>
  );
}

