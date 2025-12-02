/**
 * ZoomControls - Controles de zoom y pantalla completa
 * 
 * Proporciona botones para:
 * - Acercar (zoom in)
 * - Alejar (zoom out)
 * - Pantalla completa (fullscreen)
 */

import React from "react";
import "./ZoomControls.css";

/**
 * Componente ZoomControls
 * @param {ol.Map} map - Instancia del mapa de OpenLayers
 */
export default function ZoomControls({ map }) {
  /**
   * Acerca el mapa en un nivel de zoom
   */
  const handleZoomIn = () => {
    if (map) {
      const view = map.getView();
      const zoom = view.getZoom();
      view.animate({ zoom: zoom + 1, duration: 250 });
    }
  };

  /**
   * Aleja el mapa en un nivel de zoom
   */
  const handleZoomOut = () => {
    if (map) {
      const view = map.getView();
      const zoom = view.getZoom();
      view.animate({ zoom: zoom - 1, duration: 250 });
    }
  };

  /**
   * Alterna el modo de pantalla completa
   */
  const handleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="zoom-controls">
      <button className="zoom-btn" onClick={handleZoomIn} title="Acercar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
        </svg>
      </button>
      <div className="zoom-divider"></div>
      <button className="zoom-btn" onClick={handleZoomOut} title="Alejar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
        </svg>
      </button>
      <div className="zoom-divider"></div>
      <button className="zoom-btn" onClick={handleFullScreen} title="Pantalla completa">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  );
}

