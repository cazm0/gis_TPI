import React, { useState, useEffect } from "react";
import "./LayerStyleEditor.css";

export default function LayerStyleEditor({ layerId, layerName, isUserLayer, layerManager, onClose }) {
  const [color, setColor] = useState("#ff6b6b");
  const [opacity, setOpacity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!layerManager) return;

    // Cargar valores actuales
    if (isUserLayer) {
      const userLayer = layerManager.userLayers[layerId];
      if (userLayer) {
        // Primero intentar obtener valores guardados
        const savedColor = userLayer.get('customColor');
        const savedOpacity = userLayer.get('customOpacity');
        
        if (savedColor) {
          setColor(savedColor);
        }
        
        if (savedOpacity !== undefined) {
          setOpacity(savedOpacity);
        } else {
          const currentOpacity = userLayer.getOpacity();
          if (currentOpacity !== undefined) {
            setOpacity(currentOpacity);
          }
        }
      }
    } else {
      // Para capas WMS, solo podemos cambiar opacidad
      const layer = layerManager.layers[layerId];
      if (layer) {
        const currentOpacity = layer.getOpacity();
        if (currentOpacity !== undefined) {
          setOpacity(currentOpacity);
        } else {
          setOpacity(1);
        }
      }
    }
  }, [layerId, isUserLayer, layerManager]);

  const handleSave = () => {
    if (!layerManager) return;
    
    setIsLoading(true);
    try {
      if (isUserLayer) {
        // Aplicar estilo a capa de usuario
        layerManager.setUserLayerStyle(layerId, color, opacity);
      } else {
        // Aplicar opacidad a capa WMS
        layerManager.setLayerOpacity(layerId, opacity);
      }
      
      // Notificar el cambio primero (esto forzará el re-render)
      if (layerManager.onChange) {
        layerManager.onChange();
      }
      
      // Cerrar el diálogo después
      onClose();
    } catch (error) {
      console.error("Error aplicando estilo:", error);
      alert("Error al aplicar el estilo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleColorChange = (e) => {
    setColor(e.target.value);
  };

  const handleOpacityChange = (e) => {
    setOpacity(parseFloat(e.target.value));
  };

  return (
    <div className="style-editor-overlay" onClick={onClose}>
      <div className="style-editor-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="style-editor-header">
          <h3>Editar Estilo: {layerName}</h3>
          <button className="style-editor-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="style-editor-content">
          {isUserLayer && (
            <div className="style-editor-field">
              <label>Color:</label>
              <div className="color-picker-container">
                <input
                  type="color"
                  value={color}
                  onChange={handleColorChange}
                  className="color-picker"
                />
                <input
                  type="text"
                  value={color}
                  onChange={handleColorChange}
                  className="color-input"
                  placeholder="#ff6b6b"
                />
              </div>
            </div>
          )}
          
          <div className="style-editor-field">
            <label>Transparencia: {Math.round(opacity * 100)}%</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={opacity}
              onChange={handleOpacityChange}
              className="opacity-slider"
            />
            <div className="opacity-preview">
              <div 
                className="opacity-preview-box"
                style={{ 
                  backgroundColor: isUserLayer ? color : '#1a73e8',
                  opacity: opacity 
                }}
              ></div>
              <span className="opacity-preview-text">
                {Math.round(opacity * 100)}% opaco
              </span>
            </div>
          </div>
        </div>
        
        <div className="style-editor-actions">
          <button className="style-editor-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button 
            className="style-editor-save" 
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

