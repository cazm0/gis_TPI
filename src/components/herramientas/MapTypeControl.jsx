/**
 * MapTypeControl - Control para cambiar el estilo de mapa base
 * 
 * Permite al usuario cambiar entre diferentes estilos de mapa base:
 * - Predeterminado (OSM)
 * - Urbano (Carto Voyager)
 * - Satélite (Esri)
 * - Híbrido
 * - Terreno (OpenTopoMap)
 * - Oscuro (Carto Dark)
 */

import React, { useState } from "react";
import { MAP_STYLES } from "../mapa/BaseMap";
import "./MapTypeControl.css";

/**
 * Componente MapTypeControl
 * @param {string} activeStyle - ID del estilo de mapa base actualmente activo
 * @param {function} onChange - Callback cuando se cambia el estilo (recibe el nuevo styleId)
 */
export default function MapTypeControl({ activeStyle, onChange }) {
  const [isOpen, setIsOpen] = useState(false); // Controla si el panel de estilos está abierto

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

