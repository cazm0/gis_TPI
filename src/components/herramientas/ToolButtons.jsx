import React from "react";
import "./ToolButtons.css";

export default function ToolButtons({ activeTool, onChange, toolContent }) {
  const tools = [
    { id: "measure", icon: "📏", label: "Medir", title: "Medir distancia" },
    { id: "draw", icon: "✏️", label: "Dibujar", title: "Dibujar elemento" },
    { id: "query", icon: "🔍", label: "Consultar", title: "Consultar información" },
    { id: "print", icon: "🖨️", label: "Imprimir", title: "Imprimir mapa" },
    { id: "waypoints", icon: "📌", label: "Waypoints", title: "Marcadores / Waypoints" },
  ];

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

