/**
 * ActiveLayersLegend - Leyenda de capas activas
 * 
 * Muestra una lista de todas las capas visibles con sus leyendas:
 * - Para capas de GeoServer: carga la leyenda desde GetLegendGraphic
 * - Para capas de usuario: muestra un símbolo con el color personalizado
 * 
 * Permite:
 * - Reordenar capas arrastrando y soltando (drag & drop)
 * - Editar color y opacidad de capas (click en la capa)
 * - Expandir/colapsar la leyenda
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import LayerStyleEditor from "./LayerStyleEditor";
import "./ActiveLayersLegend.css";

/**
 * Componente ActiveLayersLegend
 * @param {LayerManager} layerManager - Gestor de capas
 * @param {number} update - Contador de actualización para forzar re-render
 */
export default function ActiveLayersLegend({ layerManager, update }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [legends, setLegends] = useState({});
  const [editingLayer, setEditingLayer] = useState(null);
  const [draggedLayerId, setDraggedLayerId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isLoadingLegends, setIsLoadingLegends] = useState(false);
  const loadedLayerIdsRef = useRef(new Set());

  // Obtener capas activas ordenadas por z-index
  const activeLayers = useMemo(() => {
    if (!layerManager) return [];
    return layerManager.getVisibleLayersOrdered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerManager, update]); // update es necesario para re-renderizar cuando cambian las capas visibles

  // Crear una clave estable basada en los IDs de las capas (sin orden)
  const activeLayerIdsKey = useMemo(() => {
    return activeLayers.map(l => l.id).sort().join(',');
  }, [activeLayers]);

  // Cargar leyendas de capas activas - solo cuando cambian los IDs de las capas (no el orden)
  useEffect(() => {
    if (!layerManager) {
      setLegends({});
      setIsLoadingLegends(false);
      loadedLayerIdsRef.current = new Set();
      return;
    }
    
    // Si no hay capas activas, limpiar leyendas pero no ocultar el componente
    if (activeLayers.length === 0) {
      setLegends({});
      setIsLoadingLegends(false);
      loadedLayerIdsRef.current = new Set();
      return;
    }

    // Verificar si hay capas nuevas que necesitan leyendas
    const newLayers = activeLayers.filter(layer => !loadedLayerIdsRef.current.has(layer.id));

    // Solo cargar si hay capas nuevas
    if (newLayers.length === 0) {
      return; // No hacer nada si todas las capas ya tienen leyendas cargadas
    }

    const loadLegends = async () => {
      // Solo poner isLoadingLegends en true si hay capas que realmente necesitan cargar leyendas de GeoServer
      const needsGeoServerLoading = newLayers.some(layer => !layer.isUserLayer && !legends[layer.id]);
      if (needsGeoServerLoading) {
        setIsLoadingLegends(true);
      }
      const newLegends = { ...legends }; // Mantener leyendas existentes
      
      // Solo cargar leyendas para capas nuevas
      for (const layer of newLayers) {

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
              WIDTH: '200',
              HEIGHT: '50',
              TRANSPARENT: 'true',
              LEGEND_OPTIONS: 'fontName:Arial;fontSize:12;fontColor:0x000000;dpi:96;forceLabels:on'
            });

            const legendUrl = `/geoserver/gis_tpi/wms?${params.toString()}`;
            
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
      setIsLoadingLegends(false);
      // Actualizar el conjunto de IDs de capas cargadas
      loadedLayerIdsRef.current = new Set(activeLayers.map(l => l.id));
    };

    loadLegends();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerIdsKey, layerManager]); // Solo cuando cambian los IDs de las capas (no el orden)

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
              // Mostrar el indicador antes del elemento si dragOverIndex === index, o después si dragOverIndex === index + 1
              const showDropIndicatorBefore = dragOverIndex === index && draggedLayerId !== layer.id;
              const showDropIndicatorAfter = dragOverIndex === index + 1 && draggedLayerId !== layer.id;

              return (
                <React.Fragment key={layer.id}>
                  {showDropIndicatorBefore && (
                    <div className="legend-drop-indicator"></div>
                  )}
                  <div 
                    className={`legend-item loading ${isDragging ? 'dragging' : ''}`}
                    draggable={!isLoadingLegends}
                    onDragStart={(e) => {
                      if (isLoadingLegends) {
                        e.preventDefault();
                        return;
                      }
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
                    if (isLoadingLegends) {
                      e.preventDefault();
                      return;
                    }
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (draggedLayerId !== layer.id && draggedLayerId) {
                      // Obtener la lista actualizada de capas en cada evento
                      const currentLayers = layerManager.getVisibleLayersOrdered();
                      const draggedIndex = currentLayers.findIndex(l => l.id === draggedLayerId);
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
                      if (isLoadingLegends) {
                        e.preventDefault();
                        return;
                      }
                      e.preventDefault();
                      const draggedId = e.dataTransfer.getData('text/plain');
                      if (draggedId && draggedId !== layer.id) {
                        // Obtener la lista actualizada de capas antes de calcular índices
                        const currentLayers = layerManager.getVisibleLayersOrdered();
                        const currentIndex = currentLayers.findIndex(l => l.id === draggedId);
                        if (currentIndex !== -1) {
                          // Calcular la posición objetivo basada en dónde se soltó
                          // El indicador de drop (dragOverIndex) ya muestra la posición correcta
                          let targetIndex = dragOverIndex !== null ? dragOverIndex : index;
                          
                          // Si se arrastra hacia abajo (currentIndex < index), insertar después del elemento actual
                          // Si se arrastra hacia arriba (currentIndex > index), insertar antes del elemento actual
                          if (dragOverIndex === null) {
                            if (currentIndex < index) {
                              // Arrastrando hacia abajo: insertar después del elemento sobre el que se soltó
                              targetIndex = index + 1;
                            } else {
                              // Arrastrando hacia arriba: insertar antes del elemento sobre el que se soltó
                              targetIndex = index;
                            }
                          }
                          
                          // Asegurar que el índice esté en el rango válido (permitir insertar al final)
                          targetIndex = Math.max(0, Math.min(targetIndex, currentLayers.length));
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
                      geometryType === 'Polygon' ? (
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
                      )
                    ) : null}
                    <span className="legend-label">{layer.displayName}</span>
                  </div>
                  {showDropIndicatorAfter && (
                    <div className="legend-drop-indicator"></div>
                  )}
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
                  draggable={!isLoadingLegends}
                  onDragStart={(e) => {
                    if (isLoadingLegends) {
                      e.preventDefault();
                      return;
                    }
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
                    if (isLoadingLegends) {
                      e.preventDefault();
                      return;
                    }
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (draggedLayerId !== layer.id && draggedLayerId) {
                      // Obtener la lista actualizada de capas en cada evento
                      const currentLayers = layerManager.getVisibleLayersOrdered();
                      const draggedIndex = currentLayers.findIndex(l => l.id === draggedLayerId);
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
                    if (isLoadingLegends) {
                      e.preventDefault();
                      return;
                    }
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId && draggedId !== layer.id) {
                      // Obtener la lista actualizada de capas antes de calcular índices
                      const currentLayers = layerManager.getVisibleLayersOrdered();
                      const currentIndex = currentLayers.findIndex(l => l.id === draggedId);
                      if (currentIndex !== -1) {
                        // Usar el dragOverIndex que se calculó en onDragOver
                        let targetIndex;
                        if (dragOverIndex !== null) {
                          targetIndex = dragOverIndex;
                        } else {
                          // Fallback: calcular basado en la posición actual
                          if (currentIndex < index) {
                            targetIndex = index + 1;
                          } else {
                            targetIndex = index;
                          }
                        }
                        
                        // Asegurar que el índice esté en el rango válido
                        // Permitir insertar al final (targetIndex puede ser igual a length)
                        targetIndex = Math.max(0, Math.min(targetIndex, currentLayers.length));
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
                      <img
                        src={legend.url}
                        alt={`Leyenda de ${legend.displayName}`}
                        className="legend-image"
                        style={{ opacity: layer.isUserLayer ? currentOpacity : 1 }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : legend.type === 'user' ? (
                      (() => {
                        const geometryType = legend.geometryType || layer.geometryType || 'Point';
                        if (geometryType === 'Polygon') {
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
                      })()
                    ) : null}
                    <span className="legend-label">{legend.displayName}</span>
                  </div>
                  {dragOverIndex === index + 1 && draggedLayerId !== layer.id && (
                    <div className="legend-drop-indicator"></div>
                  )}
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

