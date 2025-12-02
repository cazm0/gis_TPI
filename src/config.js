/**
 * Configuración de URLs para conexión con GeoServer
 * 
 * En desarrollo: usa un proxy configurado en package.json para evitar problemas de CORS
 * En producción: conecta directamente a GeoServer en localhost:8081
 */
const GEOSERVER_BASE = process.env.NODE_ENV === 'production' 
  ? 'http://localhost:8081'  // En producción, conexión directa a GeoServer
  : ''; // En desarrollo, usar proxy configurado en package.json (línea 30)

/**
 * URL del servicio WMS (Web Map Service) de GeoServer
 * WMS se usa para obtener imágenes rasterizadas de las capas
 */
export const URL_OGC = `${GEOSERVER_BASE}/geoserver/gisTPI/wms`;

/**
 * URL del servicio WFS (Web Feature Service) de GeoServer
 * WFS se usa para obtener datos vectoriales (features) de las capas
 */
export const URL_WFS = `${GEOSERVER_BASE}/geoserver/gisTPI/wfs`;



