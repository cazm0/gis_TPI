import React, { useState } from "react";
import { MAP_STYLES } from "./BaseMap";
import "./MapTypeControl.css";

export default function MapTypeControl({ activeStyle, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`map-type-control ${isOpen ? "open" : ""}`}>
      <button
        className="map-type-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Capas del mapa"
      >
        🗺️
      </button>

      <div className="map-type-panel">
        {MAP_STYLES.map((style) => (
          <button
            key={style.id}
            className={`map-type-button ${
              activeStyle === style.id ? "active" : ""
            }`}
            onClick={() => onChange(style.id)}
          >
            {style.label}
          </button>
        ))}
      </div>
    </div>
  );
}

