/**
 * LayerPanel - Panel lateral para gestionar capas del mapa
 * 
 * Muestra todas las capas disponibles organizadas por grupos temáticos:
 * - Capas de GeoServer (definidas en layersConfig)
 * - Capas de usuario (creadas por el usuario)
 * 
 * Permite:
 * - Activar/desactivar capas
 * - Buscar capas por nombre o grupo
 * - Expandir/colapsar grupos
 * - Descargar y eliminar capas de usuario
 */

import React, { useState, useMemo, useEffect } from "react";
import { layersConfig, groupConfig } from "../../layers";
import Modal from "../common/Modal";
import "./LayerPanel.css";

/**
 * Componente LayerPanel
 * @param {LayerManager} layerManager - Gestor de capas
 * @param {number} update - Contador de actualización para forzar re-render cuando cambian las capas
 */
export default function LayerPanel({ layerManager, update }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});
  const [modal, setModal] = useState({ isOpen: false, message: "", type: "info", title: "" });

  /**
   * Alterna el estado expandido/colapsado de un grupo de capas
   * @param {string} group - Nombre del grupo
   */
  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  /**
   * Obtiene las capas de usuario de forma reactiva
   * Se actualiza cuando cambia el contador 'update'
   */
  const userLayers = useMemo(() => {
    if (!layerManager) return [];
    const userLayersObj = layerManager.getUserLayers();
    return Object.keys(userLayersObj).map(layerId => {
      const layer = userLayersObj[layerId];
      return {
        id: layerId,
        title: layer.get('title') || layerId.replace('user:', ''),
        group: 'Usuario',
        isUserLayer: true,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerManager, update]); // Depender de update para reactividad

  /**
   * Combina las capas de GeoServer y las capas de usuario en una sola lista
   */
  const allLayers = useMemo(() => {
    return [...layersConfig, ...userLayers];
  }, [userLayers]);

  /**
   * Filtra las capas según el texto de búsqueda
   * Busca en el título de la capa y en el nombre del grupo
   */
  const filteredLayers = useMemo(() => {
    if (!searchQuery.trim()) return allLayers;
    const query = searchQuery.toLowerCase();
    return allLayers.filter(layer => 
      layer.title.toLowerCase().includes(query) ||
      layer.group.toLowerCase().includes(query)
    );
  }, [searchQuery, allLayers]);

  /**
   * Agrupa las capas filtradas por su categoría temática
   * @returns {Array} Array de objetos {group, layers}
   */
  const groupedLayers = useMemo(() => {
    const groups = {};
    filteredLayers.forEach(layer => {
      if (!groups[layer.group]) {
        groups[layer.group] = [];
      }
      groups[layer.group].push(layer);
    });
    return Object.keys(groups).map(group => ({
      group,
      layers: groups[group]
    }));
  }, [filteredLayers]);

  /**
   * Descarga una capa de usuario como archivo GeoJSON
   * @param {string} layerId - ID de la capa de usuario
   * @param {string} layerTitle - Título de la capa (para el nombre del archivo)
   */
  const downloadUserLayer = (layerId, layerTitle) => {
    if (!layerManager) return;
    
    const geoJSON = layerManager.exportUserLayerToGeoJSON(layerId);
    if (!geoJSON) {
      setModal({ isOpen: true, message: 'Error al exportar la capa', type: "error", title: "Error" });
      return;
    }

    const blob = new Blob([geoJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${layerTitle || layerId}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Elimina una capa de usuario del mapa y del almacenamiento
   * @param {string} layerId - ID de la capa de usuario
   * @param {string} layerTitle - Título de la capa (para el mensaje de confirmación)
   */
  const deleteUserLayer = (layerId, layerTitle) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la capa "${layerTitle}"?`)) {
      return;
    }
    if (layerManager) {
      layerManager.removeUserLayer(layerId);
    }
  };

  // Expandir grupos que tienen resultados en la búsqueda
  useEffect(() => {
    if (searchQuery.trim()) {
      const newExpanded = {};
      groupedLayers.forEach(({ group }) => {
        newExpanded[group] = true;
      });
      setExpandedGroups(newExpanded);
    }
  }, [searchQuery, groupedLayers]);

  // Expandir automáticamente el grupo "Usuario" si hay capas de usuario
  useEffect(() => {
    if (userLayers.length > 0) {
      setExpandedGroups(prev => ({
        ...prev,
        'Usuario': true,
      }));
    }
  }, [userLayers.length]);

  if (!layerManager) {
    return (
      <div className="layer-panel">
        <div className="layer-panel-header">
          <h2>Cargando...</h2>
        </div>
      </div>
    );
  }

  const handleToggle = () => {
    if (isCollapsed) {
      setIsCollapsed(false);
    } else {
      setIsClosing(true);
      setTimeout(() => {
        setIsCollapsed(true);
        setIsClosing(false);
      }, 300);
    }
  };

  return (
    <div className="layer-panel-wrapper">
      {isCollapsed ? (
        <button
          className="layer-panel-toggle"
          onClick={handleToggle}
          title="Mostrar capas"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" fill="currentColor"/>
          </svg>
        </button>
      ) : (
        <div className={`layer-panel ${isClosing ? "closing" : ""}`}>
            <div className="layer-panel-header">
            <div className="layer-panel-header-content">
              <div>
                <h2>SIG – TPI</h2>
                <h4>Visualizador geoespacial</h4>
              </div>
            </div>
          </div>

          <div className="layer-search-container">
            <div className="layer-search">
              <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/>
              </svg>
              <input
                type="text"
                className="layer-search-input"
                placeholder="Buscar capas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery("")}
                  title="Limpiar búsqueda"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="layers-container">
            {groupedLayers.length === 0 ? (
              <div className="no-results">
                <p>No se encontraron capas</p>
              </div>
            ) : (
              groupedLayers.map(({ group, layers }) => {
                const isExpanded = expandedGroups[group] === true; // Por defecto cerrado
                const emoji = groupConfig[group] || "📁";
                
                return (
                  <div key={group} className="layer-group">
                    <div 
                      className="layer-group-header"
                      onClick={() => toggleGroup(group)}
                    >
                      <div className="layer-group-title-container">
                        <span className="layer-group-emoji">{emoji}</span>
                        <span className="layer-group-title">{group}</span>
                        <span className="layer-group-count">({layers.length})</span>
                      </div>
                      <svg 
                        className={`group-chevron ${isExpanded ? "expanded" : ""}`}
                        width="20" 
                        height="20" 
                        viewBox="0 0 24 24" 
                        fill="none"
                      >
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/>
                      </svg>
                    </div>
                    {isExpanded && (
                      <div className="layer-group-content">
                        {layers.map((c) => (
                          <div
                            key={c.id}
                            className={`layer-item ${c.isUserLayer ? 'user-layer-item' : ''}`}
                          >
                            <div
                              className="layer-item-main"
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
                            {c.isUserLayer && (
                              <div className="user-layer-actions">
                                <button
                                  className="layer-action-btn download-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadUserLayer(c.id, c.title);
                                  }}
                                  title="Descargar capa"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
                                  </svg>
                                </button>
                                <button
                                  className="layer-action-btn delete-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteUserLayer(c.id, c.title);
                                  }}
                                  title="Eliminar capa"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <button
            className="layer-panel-toggle layer-panel-toggle-right"
            onClick={handleToggle}
            title="Ocultar capas"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
    </div>
  );
}
