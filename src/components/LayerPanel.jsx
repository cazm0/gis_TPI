import React from "react";
import { layersConfig } from "../layers";
import "./LayerPanel.css";

export default function LayerPanel({ layerManager }) {
  if (!layerManager) return <div className="layer-panel">Cargando capas...</div>;

  return (
    <div className="layer-panel">
      <h2>SIG – TPI Grupo 1</h2>
      <h4>Visualizador geoespacial</h4>

      {layersConfig.map((c) => (
        <div
          key={c.id}
          className="layer-item"
          onClick={() =>
            layerManager.setVisible(c.id, !layerManager.getVisible(c.id))
          }
        >
          <input
            type="checkbox"
            className="layer-checkbox"
            checked={!!layerManager.getVisible(c.id)}
            onChange={() => {}}
          />

          <span className="layer-title">{c.title}</span>
        </div>
      ))}
    </div>
  );
}
