/**
 * ToolButtons - Barra de herramientas del mapa
 * 
 * Muestra botones para activar diferentes herramientas GIS:
 * - Medir: Medir distancias y áreas
 * - Dibujar: Dibujar features (puntos, líneas, polígonos)
 * - Consultar: Consultar información de features
 * - Imprimir: Exportar mapa a PDF
 */

import React from "react";
import "./ToolButtons.css";

/**
 * Componente ToolButtons
 * @param {string} activeTool - ID de la herramienta actualmente activa (null si ninguna)
 * @param {function} onChange - Callback cuando se cambia la herramienta activa
 * @param {object} toolContent - Contenido adicional a mostrar debajo de cada botón cuando está activo
 */
export default function ToolButtons({ activeTool, onChange, toolContent }) {
  // Configuración de las herramientas disponibles
  const tools = [
    { id: "measure", icon: "📏", label: "Medir", title: "Medir distancia" },
    { id: "draw", icon: "✏️", label: "Dibujar", title: "Dibujar elemento" },
    { id: "query", icon: "🔍", label: "Consultar", title: "Consultar información" },
    { id: "print", icon: "🖨️", label: "Imprimir", title: "Imprimir mapa" },
    { id: "waypoints", icon: "📌", label: "Waypoints", title: "Marcadores / Waypoints" },
  ];

  /**
   * Maneja el toggle de una herramienta
   * Si la herramienta ya está activa, la desactiva (null)
   * Si no está activa, la activa
   */
  const handleToggle = (toolId) => {
    if (!onChange) return;
    onChange(activeTool === toolId ? null : toolId);
  };

  return (
    <div className="tool-buttons">
      {tools.map((tool) => (
        <div key={tool.id} className="tool-button-wrapper">
          <button
            className={`tool-button ${activeTool === tool.id ? "active" : ""}`}
            onClick={() => handleToggle(tool.id)}
            title={tool.title}
          >
            <span className="tool-icon">{tool.icon}</span>
            <span className="tool-label">{tool.label}</span>
          </button>
          {activeTool === tool.id && toolContent && toolContent[tool.id] && (
            <div className={`tool-button-content ${tool.id === "waypoints" ? "waypoints-content" : ""}`}>
              {toolContent[tool.id]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

