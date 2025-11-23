import React from "react";
import { layersConfig } from "../layers"; // o la ruta correcta

export default function LayerPanel({ layerManager }) {
  if (!layerManager) return <div style={{ padding: 15 }}>Cargando capas...</div>;

  return (
    <div style={{ width: "25%", padding: 15 }}>
      <h3>Capas</h3>

      {layersConfig.map((c) => (
        <div key={c.id}>
          <input
            type="checkbox"
            checked={!!layerManager.getVisible(c.id)}  // 👈 fuerza booleano
            onChange={() =>
              layerManager.setVisible(c.id, !layerManager.getVisible(c.id))
            }
          />
          {c.title}
        </div>
      ))}
    </div>
  );
}
