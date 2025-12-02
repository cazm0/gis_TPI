/**
 * SearchBar - Barra de búsqueda de lugares
 * 
 * Permite al usuario buscar lugares usando Nominatim (OpenStreetMap):
 * - Búsqueda con autocompletado mientras escribe
 * - Sugerencias de lugares en Argentina
 * - Centrar el mapa en la ubicación encontrada
 * - Agregar marcador en la ubicación
 * - Integración con herramienta de medición (agregar puntos desde búsqueda)
 */

import React, { useState, useEffect, useRef } from "react";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Feature from "ol/Feature";
import { Point } from "ol/geom";
import { Style, Icon } from "ol/style";
import Modal from "../common/Modal";
import "./SearchBar.css";

/**
 * Componente SearchBar
 * @param {ol.Map} map - Instancia del mapa de OpenLayers
 * @param {function} onSearch - Callback cuando se realiza una búsqueda
 * @param {string} activeTool - Herramienta actualmente activa
 * @param {string} measureType - Tipo de medición ("length" o "area")
 * @param {ref} measureToolRef - Referencia a MeasureTool para agregar puntos
 */
export default function SearchBar({ map, onSearch, activeTool, measureType, measureToolRef }) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, message: "", type: "info", title: "" });
  const [markerLayer, setMarkerLayer] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasActiveMeasurement, setHasActiveMeasurement] = useState(false);
  const searchTimeoutRef = useRef(null);
  const suggestionsRef = useRef(null);
  const measurementCheckIntervalRef = useRef(null);

  /**
   * Crear capa vectorial para mostrar el marcador de ubicación encontrada
   */
  useEffect(() => {
    if (!map) return;

    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      style: new Style({
        image: new Icon({
          anchor: [0.5, 1],
          src: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          scale: 1,
        }),
      }),
    });

    layer.setZIndex(200);
    map.addLayer(layer);
    setMarkerLayer(layer);

    return () => {
      map.removeLayer(layer);
    };
  }, [map]);

  // Verificar si hay una medición activa cuando la herramienta de medir está activa
  useEffect(() => {
    if (activeTool === "measure" && measureToolRef?.current) {
      // Verificar periódicamente si hay una medición activa
      measurementCheckIntervalRef.current = setInterval(() => {
        if (measureToolRef.current?.hasActiveMeasurement) {
          const hasActive = measureToolRef.current.hasActiveMeasurement();
          setHasActiveMeasurement(hasActive);
        }
      }, 100);
    } else {
      setHasActiveMeasurement(false);
    }

    return () => {
      if (measurementCheckIntervalRef.current) {
        clearInterval(measurementCheckIntervalRef.current);
        measurementCheckIntervalRef.current = null;
      }
    };
  }, [activeTool, measureToolRef]);

  // Verificar inmediatamente cuando se agrega un punto
  useEffect(() => {
    if (activeTool === "measure" && measureToolRef?.current) {
      const hasActive = measureToolRef.current?.hasActiveMeasurement?.() || false;
      setHasActiveMeasurement(hasActive);
    }
  }, [query, activeTool, measureToolRef]);

  /**
   * Busca sugerencias de lugares usando la API de Nominatim (OpenStreetMap)
   * Limita la búsqueda a Argentina y muestra hasta 5 resultados
   * @param {string} searchQuery - Texto de búsqueda
   */
  const searchNominatim = async (searchQuery) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setIsSearching(true);
      const encodedQuery = encodeURIComponent(searchQuery);
      // Nominatim API - gratuito, sin API key
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5&addressdetails=1&countrycodes=ar&accept-language=es&bounded=1&viewbox=-73.5,-55.0,-53.5,-21.5`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GIS-TPI-App/1.0' // Nominatim requiere User-Agent
        }
      });

      if (!response.ok) {
        throw new Error('Error en la búsqueda');
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        setSuggestions(data);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error("Error buscando en Nominatim:", error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Buscar sugerencias mientras el usuario escribe (con debounce)
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Limpiar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Esperar 500ms antes de buscar (debounce)
    searchTimeoutRef.current = setTimeout(() => {
      searchNominatim(query);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const handleSelectSuggestion = (suggestion) => {
    if (!map || !suggestion) return;

    const lon = parseFloat(suggestion.lon);
    const lat = parseFloat(suggestion.lat);
    const displayName = suggestion.display_name || suggestion.name || "";

    if (isNaN(lon) || isNaN(lat)) {
      setModal({
        isOpen: true,
        message: "No se pudo obtener las coordenadas de la ubicación",
        type: "error",
        title: "Error",
      });
      return;
    }

    setQuery(displayName);
    setShowSuggestions(false);

    // Convertir a coordenadas del mapa (EPSG:3857)
    const coordinates = fromLonLat([lon, lat]);

    // Si la herramienta de medir está activa, agregar punto a la medición
    if (activeTool === "measure" && measureToolRef?.current) {
      measureToolRef.current.addPoint(coordinates);
      // Actualizar estado de medición activa
      setTimeout(() => {
        if (measureToolRef.current?.hasActiveMeasurement) {
          const hasActive = measureToolRef.current.hasActiveMeasurement();
          setHasActiveMeasurement(hasActive);
        }
      }, 100);
      // Centrar el mapa en la ubicación
      map.getView().animate({
        center: coordinates,
        zoom: 15,
        duration: 1000,
      });
    } else {
      // Comportamiento normal: centrar y agregar marcador
      map.getView().animate({
        center: coordinates,
        zoom: 15,
        duration: 1000,
      });

      // Agregar marcador
      if (markerLayer) {
        const source = markerLayer.getSource();
        source.clear();
        const marker = new Feature({
          geometry: new Point(coordinates),
          name: suggestion.name || displayName,
          address: displayName,
        });
        source.addFeature(marker);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (query.trim() && suggestions.length > 0) {
      // Seleccionar la primera sugerencia
      handleSelectSuggestion(suggestions[0]);
    } else if (query.trim()) {
      // Buscar directamente si no hay sugerencias visibles
      try {
        setIsSearching(true);
        const encodedQuery = encodeURIComponent(query);
        const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1&addressdetails=1&countrycodes=ar&accept-language=es&bounded=1&viewbox=-73.5,-55.0,-53.5,-21.5`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'GIS-TPI-App/1.0'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            handleSelectSuggestion(data[0]);
          } else {
            setModal({
              isOpen: true,
              message: "No se encontraron resultados para la búsqueda",
              type: "warning",
              title: "Sin resultados",
            });
          }
        } else {
          throw new Error('Error en la búsqueda');
        }
      } catch (error) {
        console.error("Error en búsqueda:", error);
        setModal({
          isOpen: true,
          message: "Error al realizar la búsqueda. Intenta nuevamente.",
          type: "error",
          title: "Error",
        });
      } finally {
        setIsSearching(false);
      }
    }
    if (onSearch) onSearch(query);
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    // Limpiar marcador
    if (markerLayer) {
      markerLayer.getSource().clear();
    }
  };

  const handleFinishMeasurement = () => {
    if (measureToolRef?.current?.finishMeasurement) {
      measureToolRef.current.finishMeasurement();
      setHasActiveMeasurement(false);
    }
  };

  return (
    <div className={`search-bar-container ${isFocused ? "focused" : ""}`}>
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
              fill="currentColor"
            />
          </svg>
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Buscar lugares, direcciones..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay para permitir click en sugerencias
            setTimeout(() => setIsFocused(false), 200);
          }}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="clear-btn"
            onClick={handleClear}
            title="Limpiar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
            </svg>
          </button>
        )}
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggestions" ref={suggestionsRef}>
          {suggestions.map((suggestion, index) => {
            // Formatear el nombre de la sugerencia
            const mainText = suggestion.name || suggestion.display_name?.split(',')[0] || "Ubicación";
            const secondaryText = suggestion.display_name 
              ? suggestion.display_name.split(',').slice(1).join(',').trim() 
              : suggestion.address?.road || "";
            
            return (
              <div
                key={suggestion.place_id || suggestion.osm_id || index}
                className="search-suggestion-item"
                onClick={() => handleSelectSuggestion(suggestion)}
                onMouseDown={(e) => e.preventDefault()} // Prevenir blur del input
              >
                <div className="suggestion-icon">📍</div>
                <div className="suggestion-content">
                  <div className="suggestion-main-text">{mainText}</div>
                  {secondaryText && (
                    <div className="suggestion-secondary-text">{secondaryText}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isSearching && (
        <div className="search-loading">
          <div className="spinner"></div>
          <span>Buscando...</span>
        </div>
      )}

      {activeTool === "measure" && hasActiveMeasurement && (
        <div className="measure-finish-button-container">
          <button
            type="button"
            className="measure-finish-button"
            onClick={handleFinishMeasurement}
            title="Finalizar medición"
          >
            Finalizar
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
