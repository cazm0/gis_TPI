/**
 * Legend - Componente para mostrar la leyenda de una capa individual
 * 
 * Carga y muestra la leyenda de una capa desde GeoServer usando GetLegendGraphic
 * Para capas de usuario, muestra un símbolo simple con el color personalizado
 */

import React, { useState, useEffect } from "react";
import "./Legend.css";

/**
 * Componente Legend
 * @param {string} layerName - Nombre de la capa en GeoServer (formato "workspace:layerName")
 * @param {string} layerId - ID de la capa
 * @param {boolean} isUserLayer - true si es una capa de usuario
 * @param {LayerManager} layerManager - Gestor de capas
 */
export default function Legend({ layerName, layerId, isUserLayer, layerManager }) {
  const [legendUrl, setLegendUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    if (showLegend && !isUserLayer && layerName) {
      loadLegend();
    } else if (showLegend && isUserLayer) {
      // Para capas de usuario, no hay leyenda de GeoServer
      setLegendUrl(null);
      setError(null);
    }
  }, [showLegend, layerName, isUserLayer]);

  const loadLegend = async () => {
    if (!layerName || isUserLayer) return;

    setLoading(true);
    setError(null);

    try {
      // Construir URL de GetLegendGraphic
      const params = new URLSearchParams({
        REQUEST: 'GetLegendGraphic',
        VERSION: '1.0.0',
        FORMAT: 'image/png',
        LAYER: layerName,
        WIDTH: '25',
        HEIGHT: '25',
        TRANSPARENT: 'true',
        LEGEND_OPTIONS: 'fontName:Arial;fontSize:11;fontColor:0x000000;dpi:96;forceLabels:off'
      });

      // Usar el proxy en desarrollo (configurado en package.json)
      const legendUrl = `/geoserver/gisTPI/wms?${params.toString()}`;
      
      // Verificar que la imagen se puede cargar
      const img = new Image();
      img.onload = () => {
        setLegendUrl(legendUrl);
        setLoading(false);
      };
      img.onerror = () => {
        setError("No se pudo cargar la leyenda");
        setLoading(false);
      };
      img.src = legendUrl;
    } catch (err) {
      console.error("Error cargando leyenda:", err);
      setError("Error al cargar la leyenda");
      setLoading(false);
    }
  };

  if (!showLegend) {
    return (
      <button
        className="legend-toggle-btn"
        onClick={() => setShowLegend(true)}
        title="Mostrar leyenda"
      >
        📋
      </button>
    );
  }

  return (
    <div className="legend-container">
      <div className="legend-header">
        <span className="legend-title">Leyenda</span>
        <button
          className="legend-close-btn"
          onClick={() => {
            setShowLegend(false);
            setLegendUrl(null);
            setError(null);
          }}
          title="Cerrar leyenda"
        >
          ✕
        </button>
      </div>
      <div className="legend-content">
        {isUserLayer ? (
          <div className="legend-user-layer">
            <p>Las capas de usuario no tienen leyenda de GeoServer.</p>
            <div className="legend-simple">
              <div className="legend-item">
                <div className="legend-symbol" style={{ backgroundColor: '#ff6b6b' }}></div>
                <span>{layerName || layerId}</span>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="legend-loading">Cargando leyenda...</div>
        ) : error ? (
          <div className="legend-error">{error}</div>
        ) : legendUrl ? (
          <div className="legend-image-container">
            <img
              src={legendUrl}
              alt={`Leyenda de ${layerName}`}
              className="legend-image"
              onError={() => setError("Error al mostrar la imagen de la leyenda")}
            />
          </div>
        ) : (
          <div className="legend-no-data">No hay leyenda disponible</div>
        )}
      </div>
    </div>
  );
}

