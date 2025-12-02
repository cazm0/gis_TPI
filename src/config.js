// Usar proxy para evitar CORS en desarrollo
const GEOSERVER_BASE = process.env.NODE_ENV === 'production' 
  ? 'http://localhost:8081' 
  : ''; // En desarrollo, usar proxy configurado en package.json

export const URL_OGC = `${GEOSERVER_BASE}/geoserver/gisTPI/wms`;
export const URL_WFS = `${GEOSERVER_BASE}/geoserver/gisTPI/wfs`;

// Google Maps API Key (ya no se usa - ahora se usa Nominatim/OpenStreetMap que es gratuito)
// Se mantiene por compatibilidad pero no es necesario
export const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';


