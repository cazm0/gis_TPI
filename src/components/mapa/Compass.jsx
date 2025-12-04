import React, { useState, useEffect } from "react";
import "./Compass.css";

export default function Compass({ map }) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!map) return;

    const updateRotation = () => {
      const view = map.getView();
      const currentRotation = view.getRotation();
      // Convertir de radianes a grados
      setRotation((currentRotation * 180) / Math.PI);
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
        style={{ transform: `rotate(${-rotation}deg)` }}
        onClick={handleResetNorth}
        title="Hacer clic para orientar al norte"
      >
        <svg width="44" height="44" viewBox="0 0 80 80">
          {/* Círculo exterior */}
          <circle cx="40" cy="40" r="38" fill="rgba(255, 255, 255, 0.95)" stroke="#5f6368" strokeWidth="2"/>
          
          {/* Líneas de dirección principales */}
          <line x1="40" y1="2" x2="40" y2="12" stroke="#d32f2f" strokeWidth="3" strokeLinecap="round"/>
          <line x1="40" y1="78" x2="40" y2="68" stroke="#5f6368" strokeWidth="2" strokeLinecap="round"/>
          <line x1="2" y1="40" x2="12" y2="40" stroke="#5f6368" strokeWidth="2" strokeLinecap="round"/>
          <line x1="78" y1="40" x2="68" y2="40" stroke="#5f6368" strokeWidth="2" strokeLinecap="round"/>
          
          {/* Líneas de dirección secundarias (NE, SE, SW, NW) */}
          <line x1="28" y1="12" x2="32" y2="16" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="52" y1="12" x2="48" y2="16" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="52" y1="68" x2="48" y2="64" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="28" y1="68" x2="32" y2="64" stroke="#5f6368" strokeWidth="1.5" strokeLinecap="round"/>
          
          {/* Letra N para el norte */}
          <text x="40" y="20" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#d32f2f">N</text>
          
          {/* Indicador de dirección actual (flecha) */}
          <polygon 
            points="40,8 35,18 40,15 45,18" 
            fill="#d32f2f"
            stroke="#d32f2f"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}

