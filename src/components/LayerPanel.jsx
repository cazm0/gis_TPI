import React, { useState, useMemo, useEffect } from "react";
import { layersConfig, layerGroups, groupConfig } from "../layers";
import "./LayerPanel.css";

export default function LayerPanel({ layerManager }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState({});

  // Toggle grupo expandido/colapsado
  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  // Filtrar capas por búsqueda
  const filteredLayers = useMemo(() => {
    if (!searchQuery.trim()) return layersConfig;
    const query = searchQuery.toLowerCase();
    return layersConfig.filter(layer => 
      layer.title.toLowerCase().includes(query) ||
      layer.group.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Agrupar capas filtradas por categoría
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
    </div>
  );
}
