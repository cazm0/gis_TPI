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
  const [legends, setLegends] = useState({}); // Ahora puede contener múltiples leyendas por capa
  const [expandedLayers, setExpandedLayers] = useState({}); // Controla qué capas tienen subcategorías expandidas
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
          // Cargar leyenda de GeoServer con todas las clasificaciones
          try {
            // Obtener la leyenda completa con ancho mayor para mejor legibilidad
            const params = new URLSearchParams({
              REQUEST: 'GetLegendGraphic',
              VERSION: '1.0.0',
              FORMAT: 'image/png',
              LAYER: layer.name,
              WIDTH: '300', // Ancho mayor para que las leyendas se vean mejor
              HEIGHT: '500', // Altura mayor para capturar todas las reglas
              TRANSPARENT: 'true',
              LEGEND_OPTIONS: 'fontName:Arial;fontSize:12;fontColor:0x000000;dpi:96;forceLabels:on'
            });

            const legendUrl = `/geoserver/gisTPI/wms?${params.toString()}`;
            
            // Intentar obtener las reglas del estilo desde GeoServer REST API
            let ruleLegends = [];
            try {
              const [workspace, layerNameOnly] = layer.name.split(':');
              const layerRestName = `${workspace}__${layerNameOnly}`;
              
              // Obtener información de la capa
              const layerResponse = await fetch(`/geoserver/rest/layers/${layerRestName}.json`, {
                headers: {
                  'Authorization': `Basic ${btoa('admin:geoserver')}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (layerResponse.ok) {
                const layerData = await layerResponse.json();
                const defaultStyleName = layerData.layer?.defaultStyle?.name;
                
                if (defaultStyleName) {
                  // Obtener el SLD del estilo
                  const styleResponse = await fetch(`/geoserver/rest/styles/${defaultStyleName}.sld`, {
                    headers: {
                      'Authorization': `Basic ${btoa('admin:geoserver')}`,
                      'Accept': 'application/vnd.ogc.sld+xml'
                    }
                  });
                  
                  if (styleResponse.ok) {
                    const sldText = await styleResponse.text();
                    const parser = new DOMParser();
                    const sldDoc = parser.parseFromString(sldText, 'text/xml');
                    
                    // Buscar todas las reglas en el SLD (sin namespace primero, luego con namespace)
                    let rules = sldDoc.querySelectorAll('Rule');
                    if (rules.length === 0) {
                      // Intentar buscar con diferentes variantes
                      const allElements = sldDoc.querySelectorAll('*');
                      rules = Array.from(allElements).filter(el => 
                        el.localName === 'Rule' || el.tagName === 'Rule'
                      );
                    }
                    
                    console.log(`Encontradas ${rules.length} reglas en el estilo de ${layer.name}`);
                    
                    Array.from(rules).forEach((rule, index) => {
                      // Obtener nombre de la regla - buscar en diferentes lugares
                      let ruleName = null;
                      
                      // Intentar Name (sin namespace)
                      const nameEl = rule.querySelector('Name');
                      if (nameEl && nameEl.textContent) {
                        ruleName = nameEl.textContent.trim();
                      }
                      
                      // Si no, intentar Title
                      if (!ruleName) {
                        const titleEl = rule.querySelector('Title');
                        if (titleEl && titleEl.textContent) {
                          ruleName = titleEl.textContent.trim();
                        }
                      }
                      
                      // Si no, buscar en todos los elementos hijos que puedan tener el nombre
                      if (!ruleName) {
                        const allChildren = rule.querySelectorAll('*');
                        for (const child of allChildren) {
                          if ((child.localName === 'Name' || child.localName === 'Title') && child.textContent) {
                            ruleName = child.textContent.trim();
                            break;
                          }
                        }
                      }
                      
                      // Si aún no se encontró, usar un nombre por defecto
                      if (!ruleName || ruleName === '') {
                        ruleName = `Categoría ${index + 1}`;
                      }
                      
                      // Obtener color de la regla
                      let color = '#808080';
                      
                      // Buscar Fill
                      const fillEl = rule.querySelector('Fill');
                      if (fillEl) {
                        const cssParam = fillEl.querySelector('CssParameter[name="fill"], SvgParameter[name="fill"]');
                        if (cssParam && cssParam.textContent) {
                          color = cssParam.textContent.trim();
                        }
                      }
                      
                      // Si no se encontró, buscar Stroke
                      if (color === '#808080') {
                        const strokeEl = rule.querySelector('Stroke');
                        if (strokeEl) {
                          const cssParam = strokeEl.querySelector('CssParameter[name="stroke"], SvgParameter[name="stroke"]');
                          if (cssParam && cssParam.textContent) {
                            color = cssParam.textContent.trim();
                          }
                        }
                      }
                      
                      // Obtener leyenda individual para esta regla con tamaño MUY grande para legibilidad
                      // Usar ancho mayor para imágenes más legibles
                      const ruleParams = new URLSearchParams({
                        REQUEST: 'GetLegendGraphic',
                        VERSION: '1.0.0',
                        FORMAT: 'image/png',
                        LAYER: layer.name,
                        RULE: ruleName,
                        WIDTH: '200',
                        HEIGHT: '30',
                        TRANSPARENT: 'true',
                        LEGEND_OPTIONS: 'fontName:Arial;fontSize:14;fontColor:0x000000;dpi:96;forceLabels:on'
                      });
                      
                      ruleLegends.push({
                        name: ruleName,
                        color: color,
                        url: `/geoserver/gisTPI/wms?${ruleParams.toString()}`
                      });
                    });
                    
                    console.log(`Reglas extraídas para ${layer.name}:`, ruleLegends.map(r => r.name));
                  }
                }
              }
            } catch (styleError) {
              console.log('No se pudo obtener reglas del estilo, usando leyenda completa:', styleError);
            }
            
            // Cargar la leyenda completa (que incluye todas las reglas en una imagen)
            const img = new Image();
            await new Promise((resolve) => {
              img.onload = () => {
                // Almacenar la leyenda completa con reglas si están disponibles
                newLegends[layer.id] = { 
                  type: 'geoserver', 
                  url: legendUrl, 
                  displayName: layer.displayName,
                  imageHeight: img.height, // Guardar la altura real de la imagen
                  ruleLegends: ruleLegends.length > 0 ? ruleLegends : null // Array de reglas individuales
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
                        <div className="legend-symbol-placeholder" style={{ width: '20px', height: '20px' }}></div>
                      </div>
                    )}
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
                  <div className="legend-item-content" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <div className="legend-drag-handle">⋮⋮</div>
                      {legend.type === 'geoserver' && legend.url ? (
                  <>
                    {/* TÍTULO: Solo el nombre de la capa como encabezado, sin sangría */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        flex: 1, 
                        cursor: 'pointer',
                        padding: '4px 0'
                      }}
                      onClick={() => {
                        // Toggle expandir/colapsar esta capa
                        setExpandedLayers(prev => ({
                          ...prev,
                          [layer.id]: !prev[layer.id]
                        }));
                      }}
                      title="Clic para expandir/colapsar todas las clasificaciones"
                    >
                      <div className="legend-symbol-container">
                        {/* Mostrar siempre una vista previa pequeña */}
                        {!layer.isUserLayer && legend.ruleLegends && legend.ruleLegends.length > 0 ? (
                          <div style={{ 
                            width: '16px', 
                            height: '16px', 
                            backgroundColor: '#e0e0e0', 
                            borderRadius: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9px',
                            color: '#666'
                          }}>
                            {legend.ruleLegends.length}
                          </div>
                        ) : (
                          <>
                            <img
                              src={legend.url}
                              alt={`Leyenda de ${legend.displayName}`}
                              className="legend-image"
                              style={{ 
                                opacity: layer.isUserLayer ? currentOpacity : 1,
                                maxHeight: '20px',
                                maxWidth: '20px'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                if (e.target.nextSibling) {
                                  e.target.nextSibling.style.display = 'block';
                                }
                              }}
                            />
                            <div className="legend-symbol-placeholder" style={{ display: 'none' }}></div>
                          </>
                        )}
                      </div>
                      <span 
                        className="legend-label" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLayer(layer);
                        }} 
                        title="Clic para editar color y transparencia"
                        style={{ fontWeight: '600' }}
                      >
                        {legend.displayName}
                      </span>
                      {/* Mostrar ícono de expandir para todas las capas de GeoServer */}
                      <svg
                        className={`legend-expand-icon ${expandedLayers[layer.id] ? 'expanded' : ''}`}
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{ 
                          marginLeft: 'auto', 
                          flexShrink: 0,
                          color: '#666',
                          transition: 'transform 0.2s ease'
                        }}
                      >
                        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" fill="currentColor"/>
                      </svg>
                    </div>
                    {/* CONTENIDO SCROLLEABLE: Todas las categorías debajo del título, con scroll */}
                    {expandedLayers[layer.id] && (
                      <div 
                        className="legend-expanded-content"
                        style={{
                          marginTop: '8px',
                          marginLeft: '0',
                          paddingLeft: '28px',
                          paddingRight: '8px',
                          paddingTop: '8px',
                          paddingBottom: '8px',
                          borderLeft: '2px solid #e0e0e0',
                          backgroundColor: '#f9f9f9',
                          width: '100%',
                          boxSizing: 'border-box',
                          maxHeight: '400px',
                          overflowY: 'auto',
                          overflowX: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {legend.ruleLegends && legend.ruleLegends.length > 0 ? (
                          // Mostrar cada regla como subcategoría con nombre e imagen grande
                          legend.ruleLegends.map((rule, ruleIndex) => (
                            <div 
                              key={ruleIndex}
                              className="legend-subcategory"
                              style={{
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '8px 0',
                                width: '100%',
                                borderBottom: ruleIndex < legend.ruleLegends.length - 1 ? '1px solid #e8e8e8' : 'none'
                              }}
                            >
                              <img
                                src={rule.url}
                                alt={rule.name}
                                style={{
                                  width: 'auto',
                                  maxWidth: '180px',
                                  minWidth: '150px',
                                  height: 'auto',
                                  objectFit: 'contain',
                                  flexShrink: 0
                                }}
                                onError={(e) => {
                                  // Si falla la imagen, mostrar un símbolo de color más grande
                                  e.target.style.display = 'none';
                                  const container = e.target.parentNode;
                                  const fallback = document.createElement('div');
                                  fallback.style.width = '40px';
                                  fallback.style.height = '40px';
                                  fallback.style.backgroundColor = rule.color;
                                  fallback.style.borderRadius = '2px';
                                  fallback.style.border = '1px solid #000';
                                  container.appendChild(fallback);
                                }}
                              />
                              <span 
                                className="legend-subcategory-label" 
                                style={{ 
                                  color: '#202124', 
                                  fontSize: '12px',
                                  lineHeight: '1.5',
                                  fontWeight: 'normal',
                                  flex: 1,
                                  wordWrap: 'break-word'
                                }}
                              >
                                {rule.name}
                              </span>
                            </div>
                          ))
                        ) : (
                          // Fallback: mostrar la imagen completa más grande y ancha con scroll vertical
                          <div style={{ 
                            width: '100%'
                          }}>
                            <img
                              src={legend.url}
                              alt={`Leyenda completa de ${legend.displayName}`}
                              style={{ 
                                width: '100%',
                                maxWidth: '100%',
                                height: 'auto',
                                display: 'block'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
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

