// Usar proxy para evitar CORS en desarrollo
const GEOSERVER_BASE = process.env.NODE_ENV === 'production' 
  ? 'http://localhost:8081' 
  : ''; // En desarrollo, usar proxy configurado en package.json

export const URL_OGC = `${GEOSERVER_BASE}/geoserver/gisTPI/wms`;
export const URL_WFS = `${GEOSERVER_BASE}/geoserver/gisTPI/wfs`;


