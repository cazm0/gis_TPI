import React, { useState, useEffect, useMemo } from "react";
import LayerStyleEditor from "./LayerStyleEditor";
import "./ActiveLayersLegend.css";

export default function ActiveLayersLegend({ layerManager, update }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [legends, setLegends] = useState({});
  const [editingLayer, setEditingLayer] = useState(null);
  const [draggedLayerId, setDraggedLayerId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Obtener capas activas ordenadas por z-index
  const activeLayers = useMemo(() => {
    if (!layerManager) return [];
    return layerManager.getVisibleLayersOrdered();
  }, [layerManager]);

  // Cargar leyendas de capas activas
  useEffect(() => {
    if (!layerManager || activeLayers.length === 0) {
      setLegends({});
      return;
    }

    const loadLegends = async () => {
      const newLegends = {};
      
      for (const layer of activeLayers) {
        if (layer.isUserLayer) {
          // Para capas de usuario, obtener color y opacidad actuales
          const userLayer = layerManager.userLayers[layer.id];
          let customColor = '#ff6b6b';
          let customOpacity = 1;
          if (userLayer) {
            const savedColor = userLayer.get('customColor');
            const savedOpacity = userLayer.get('customOpacity');
            if (savedColor) customColor = savedColor;
            if (savedOpacity !== undefined) customOpacity = savedOpacity;
          }
          newLegends[layer.id] = { 
            type: 'user', 
            displayName: layer.displayName,
            color: customColor,
            opacity: customOpacity,
            geometryType: layer.geometryType || 'Point' // Agregar tipo de geometría
          };
        } else {
          // Cargar leyenda de GeoServer
          try {
            const params = new URLSearchParams({
              REQUEST: 'GetLegendGraphic',
              VERSION: '1.0.0',
              FORMAT: 'image/png',
              LAYER: layer.name,
              WIDTH: '20',
              HEIGHT: '20',
              TRANSPARENT: 'true',
              LEGEND_OPTIONS: 'fontName:Arial;fontSize:10;fontColor:0x000000;dpi:96;forceLabels:off'
            });

            const legendUrl = `/geoserver/gisTPI/wms?${params.toString()}`;
            
            // Verificar que la imagen se puede cargar
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = () => {
                newLegends[layer.id] = { 
                  type: 'geoserver', 
                  url: legendUrl, 
                  displayName: layer.displayName 
                };
                resolve();
              };
              img.onerror = () => {
                newLegends[layer.id] = { 
                  type: 'error', 
                  displayName: layer.displayName 
                };
                resolve();
              };
              img.src = legendUrl;
            });
          } catch (error) {
            console.error(`Error cargando leyenda para ${layer.name}:`, error);
            newLegends[layer.id] = { 
              type: 'error', 
              displayName: layer.displayName 
            };
          }
        }
      }

      setLegends(newLegends);
    };

    loadLegends();
  }, [activeLayers, layerManager, update]); // Agregar update como dependencia para refrescar cuando cambia el estilo

  if (activeLayers.length === 0) {
    return null;
  }

  return (
    <div className={`active-layers-legend ${isExpanded ? "expanded" : "collapsed"}`}>
      <div className="legend-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="legend-header-title">Leyenda</span>
        <span className="legend-header-count">({activeLayers.length})</span>
        <svg 
          className={`legend-chevron ${isExpanded ? "expanded" : ""}`}
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none"
        >
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/>
        </svg>
      </div>
      
      {isExpanded && (
        <div className="legend-content">
          {activeLayers.map((layer, index) => {
            const legend = legends[layer.id];
            
            // Obtener color y opacidad actuales directamente de la capa (siempre actualizado)
            let currentColor = '#ff6b6b';
            let currentOpacity = 1;
            
            if (layer.isUserLayer && layerManager) {
              const userLayer = layerManager.userLayers[layer.id];
              if (userLayer) {
                // Siempre obtener valores actuales directamente de la capa
                const savedColor = userLayer.get('customColor');
                const savedOpacity = userLayer.get('customOpacity');
                if (savedColor) {
                  currentColor = savedColor;
                } else if (legend && legend.color) {
                  currentColor = legend.color;
                }
                if (savedOpacity !== undefined) {
                  currentOpacity = savedOpacity;
                } else if (legend && legend.opacity !== undefined) {
                  currentOpacity = legend.opacity;
                }
              }
            }
            
            if (!legend) {
              // Determinar tipo de geometría para mostrar símbolo correcto
              let geometryType = 'Point';
              if (layer.isUserLayer && layerManager) {
                const userLayer = layerManager.userLayers[layer.id];
                if (userLayer) {
                  geometryType = userLayer.get('geometryType') || 'Point';
                }
              }

              const isDragging = draggedLayerId === layer.id;
              const showDropIndicator = dragOverIndex === index && draggedLayerId !== layer.id;

              return (
                <React.Fragment key={layer.id}>
                  {showDropIndicator && (
                    <div className="legend-drop-indicator"></div>
                  )}
                  <div 
                    className={`legend-item loading ${isDragging ? 'dragging' : ''}`}
                    draggable={true}
                    onDragStart={(e) => {
                      setDraggedLayerId(layer.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', layer.id);
                      e.currentTarget.style.opacity = '0.5';
                    }}
                    onDragEnd={(e) => {
                      setDraggedLayerId(null);
                      setDragOverIndex(null);
                      e.currentTarget.style.opacity = '1';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (draggedLayerId !== layer.id && draggedLayerId) {
                        const draggedIndex = activeLayers.findIndex(l => l.id === draggedLayerId);
                        // Mostrar el indicador en la posición correcta
                        if (draggedIndex !== -1) {
                          if (draggedIndex < index) {
                            // Arrastrando hacia abajo: mostrar después del elemento actual
                            setDragOverIndex(index + 1);
                          } else {
                            // Arrastrando hacia arriba: mostrar antes del elemento actual
                            setDragOverIndex(index);
                          }
                        }
                      }
                    }}
                    onDragLeave={(e) => {
                      // Solo limpiar si realmente salimos del elemento (no solo de un hijo)
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        setDragOverIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = e.dataTransfer.getData('text/plain');
                      if (draggedId && draggedId !== layer.id) {
                        const currentIndex = activeLayers.findIndex(l => l.id === draggedId);
                        if (currentIndex !== -1) {
                          // Calcular la posición objetivo basada en dónde se soltó
                          // Si se arrastra hacia abajo (currentIndex < index), insertar después del elemento actual
                          // Si se arrastra hacia arriba (currentIndex > index), insertar antes del elemento actual
                          let targetIndex = index;
                          if (currentIndex < index) {
                            // Arrastrando hacia abajo: insertar después del elemento sobre el que se soltó
                            targetIndex = index + 1;
                          } else {
                            // Arrastrando hacia arriba: insertar antes del elemento sobre el que se soltó
                            targetIndex = index;
                          }
                          // Asegurar que el índice no exceda el rango
                          targetIndex = Math.max(0, Math.min(targetIndex, activeLayers.length - 1));
                          layerManager.moveLayerToPosition(draggedId, targetIndex);
                        }
                      }
                      setDraggedLayerId(null);
                      setDragOverIndex(null);
                    }}
                  >
                    <div className="legend-item-content">
                      <div className="legend-drag-handle">⋮⋮</div>
                    {layer.isUserLayer ? (
                      <div className="legend-symbol-container">
                        {geometryType === 'Polygon' ? (
                          <div 
                            className="legend-symbol user-layer-symbol polygon-symbol"
                            style={{
                              backgroundColor: currentColor,
                              opacity: currentOpacity,
                              width: '14px',
                              height: '14px',
                              borderRadius: '1px',
                              border: '1px solid #000'
                            }}
                          ></div>
                        ) : geometryType === 'LineString' ? (
                          <div 
                            className="legend-symbol user-layer-symbol line-symbol"
                            style={{
                              backgroundColor: currentColor,
                              opacity: currentOpacity,
                              width: '16px',
                              height: '2px',
                              transform: 'rotate(135deg)',
                              transformOrigin: 'center'
                            }}
                          ></div>
                        ) : (
                          <div 
                            className="legend-symbol user-layer-symbol point-symbol"
                            style={{
                              backgroundColor: currentColor,
                              opacity: currentOpacity,
                              width: '8px',
                              height: '8px',
                              borderRadius: '1px'
                            }}
                          ></div>
                        )}
                      </div>
                    ) : (
                      <div className="legend-symbol-container">
                        <div className="legend-symbol-placeholder"></div>
                      </div>
                    )}
                    <span className="legend-label">{layer.displayName}</span>
                  </div>
                </div>
                </React.Fragment>
              );
            }

            const isDragging = draggedLayerId === layer.id;
            const showDropIndicator = dragOverIndex === index && draggedLayerId !== layer.id;

            return (
              <React.Fragment key={layer.id}>
                {showDropIndicator && (
                  <div className="legend-drop-indicator"></div>
                )}
                <div 
                  className={`legend-item ${isDragging ? 'dragging' : ''}`}
                  draggable={true}
                  onDragStart={(e) => {
                    setDraggedLayerId(layer.id);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', layer.id);
                    e.currentTarget.style.opacity = '0.5';
                  }}
                  onDragEnd={(e) => {
                    setDraggedLayerId(null);
                    setDragOverIndex(null);
                    e.currentTarget.style.opacity = '1';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (draggedLayerId !== layer.id && draggedLayerId) {
                      const draggedIndex = activeLayers.findIndex(l => l.id === draggedLayerId);
                      // Mostrar el indicador en la posición correcta
                      if (draggedIndex !== -1) {
                        if (draggedIndex < index) {
                          // Arrastrando hacia abajo: mostrar después del elemento actual
                          setDragOverIndex(index + 1);
                        } else {
                          // Arrastrando hacia arriba: mostrar antes del elemento actual
                          setDragOverIndex(index);
                        }
                      }
                    }
                  }}
                  onDragLeave={(e) => {
                    // Solo limpiar si realmente salimos del elemento (no solo de un hijo)
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setDragOverIndex(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId && draggedId !== layer.id) {
                      const currentIndex = activeLayers.findIndex(l => l.id === draggedId);
                      if (currentIndex !== -1) {
                        // Calcular la posición objetivo basada en dónde se soltó
                        // Si se arrastra hacia abajo (currentIndex < index), insertar después del elemento actual
                        // Si se arrastra hacia arriba (currentIndex > index), insertar antes del elemento actual
                        let targetIndex = index;
                        if (currentIndex < index) {
                          // Arrastrando hacia abajo: insertar después del elemento sobre el que se soltó
                          targetIndex = index + 1;
                        } else {
                          // Arrastrando hacia arriba: insertar antes del elemento sobre el que se soltó
                          targetIndex = index;
                        }
                        // Asegurar que el índice no exceda el rango
                        targetIndex = Math.max(0, Math.min(targetIndex, activeLayers.length - 1));
                        layerManager.moveLayerToPosition(draggedId, targetIndex);
                      }
                    }
                    setDraggedLayerId(null);
                    setDragOverIndex(null);
                  }}
                >
                  <div className="legend-item-content" onClick={() => setEditingLayer(layer)} title="Clic para editar color y transparencia">
                    <div className="legend-drag-handle">⋮⋮</div>
                    {legend.type === 'geoserver' && legend.url ? (
                  <>
                    <div className="legend-symbol-container">
                      <img
                        src={legend.url}
                        alt={`Leyenda de ${legend.displayName}`}
                        className="legend-image"
                        style={{ opacity: layer.isUserLayer ? currentOpacity : 1 }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div className="legend-symbol-placeholder" style={{ display: 'none' }}></div>
                    </div>
                    <span className="legend-label">{legend.displayName}</span>
                  </>
                ) : legend.type === 'user' ? (
                  <>
                    <div className="legend-symbol-container">
                      {(() => {
                        const geometryType = legend.geometryType || layer.geometryType || 'Point';
                        if (geometryType === 'Polygon') {
                          // Cuadrado para polígonos (más pequeño, con borde negro)
                          return (
                            <div 
                              className="legend-symbol user-layer-symbol polygon-symbol"
                              style={{ 
                                backgroundColor: currentColor,
                                opacity: currentOpacity,
                                width: '14px',
                                height: '14px',
                                borderRadius: '1px',
                                border: '1px solid #000'
                              }}
                            ></div>
                          );
                        } else if (geometryType === 'LineString') {
                          // Línea diagonal a 45 grados (de abajo izquierda a arriba derecha)
                          return (
                            <div 
                              className="legend-symbol user-layer-symbol line-symbol"
                              style={{ 
                                backgroundColor: currentColor,
                                opacity: currentOpacity,
                                width: '16px',
                                height: '2px',
                                transform: 'rotate(135deg)',
                                transformOrigin: 'center'
                              }}
                            ></div>
                          );
                        } else {
                          // Cuadrado muy pequeño para puntos
                          return (
                            <div 
                              className="legend-symbol user-layer-symbol point-symbol"
                              style={{ 
                                backgroundColor: currentColor,
                                opacity: currentOpacity,
                                width: '8px',
                                height: '8px',
                                borderRadius: '1px'
                              }}
                            ></div>
                          );
                        }
                      })()}
                    </div>
                    <span className="legend-label">{legend.displayName}</span>
                  </>
                ) : (
                  <>
                    <div className="legend-symbol-container">
                      <div className="legend-symbol-placeholder"></div>
                    </div>
                    <span className="legend-label">{legend.displayName}</span>
                  </>
                )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
      
      {editingLayer && (
        <LayerStyleEditor
          layerId={editingLayer.id}
          layerName={editingLayer.displayName}
          isUserLayer={editingLayer.isUserLayer}
          layerManager={layerManager}
          onClose={() => setEditingLayer(null)}
        />
      )}
    </div>
  );
}

