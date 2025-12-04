# Guía: Persistencia de Capas de Usuario en PostGIS y GeoServer

## Objetivo

Hacer que las capas de usuario se guarden automáticamente en PostGIS y se publiquen en GeoServer cada vez que se modifiquen, permitiendo visualizarlas como capas WMS en el mapa.

---

## Arquitectura Propuesta

```
Frontend (React)
    ↓
Backend API (Node.js/Express) o Directo a PostGIS
    ↓
PostGIS (Base de datos)
    ↓
GeoServer (Publicación automática)
    ↓
Frontend (Visualización WMS)
```

---

## Paso 1: Crear Tabla en PostGIS

### 1.1. Conectarse a PostGIS

```bash
# Desde pgAdmin o psql
psql -h localhost -p 5433 -U postgres -d geoserver
```

### 1.2. Crear Tabla para Capas de Usuario

```sql
-- Tabla para almacenar las capas de usuario
CREATE TABLE user_layers (
    id SERIAL PRIMARY KEY,
    layer_name VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    geometry_type VARCHAR(50) NOT NULL CHECK (geometry_type IN ('Point', 'LineString', 'Polygon')),
    attributes JSONB, -- Esquema de atributos
    custom_color VARCHAR(50),
    custom_opacity FLOAT DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para almacenar las features de cada capa
CREATE TABLE user_layer_features (
    id SERIAL PRIMARY KEY,
    layer_id INTEGER REFERENCES user_layers(id) ON DELETE CASCADE,
    geometry GEOMETRY NOT NULL,
    attributes JSONB, -- Atributos dinámicos de la feature
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice espacial para mejorar rendimiento
CREATE INDEX idx_user_layer_features_geometry ON user_layer_features USING GIST (geometry);

-- Índice para búsquedas por capa
CREATE INDEX idx_user_layer_features_layer_id ON user_layer_features(layer_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_layers_updated_at BEFORE UPDATE ON user_layers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_layer_features_updated_at BEFORE UPDATE ON user_layer_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 1.3. Verificar que PostGIS esté activo

```sql
SELECT PostGIS_version();
```

---

## Paso 2: Crear Backend API (Node.js/Express)

### 2.1. Instalar dependencias

```bash
npm install express pg cors dotenv
```

### 2.2. Crear estructura de backend

```
backend/
├── server.js
├── routes/
│   └── userLayers.js
├── db/
│   └── connection.js
└── .env
```

### 2.3. Archivo `backend/db/connection.js`

```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'geoserver',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

module.exports = pool;
```

### 2.4. Archivo `backend/routes/userLayers.js`

```javascript
const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { GeoJSON } = require('ol/format'); // Necesitarás adaptar esto

// Obtener todas las capas de usuario
router.get('/layers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, layer_name, title, geometry_type, attributes, 
             custom_color, custom_opacity, created_at, updated_at
      FROM user_layers
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error obteniendo capas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener una capa específica con sus features
router.get('/layers/:layerName', async (req, res) => {
  try {
    const { layerName } = req.params;
    
    // Obtener información de la capa
    const layerResult = await pool.query(
      'SELECT * FROM user_layers WHERE layer_name = $1',
      [layerName]
    );
    
    if (layerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capa no encontrada' });
    }
    
    const layer = layerResult.rows[0];
    
    // Obtener features de la capa
    const featuresResult = await pool.query(
      `SELECT id, ST_AsGeoJSON(geometry)::json as geometry, attributes
       FROM user_layer_features
       WHERE layer_id = $1`,
      [layer.id]
    );
    
    // Construir GeoJSON FeatureCollection
    const features = featuresResult.rows.map(row => ({
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: row.attributes || {}
    }));
    
    res.json({
      ...layer,
      features: {
        type: 'FeatureCollection',
        features: features
      }
    });
  } catch (error) {
    console.error('Error obteniendo capa:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear nueva capa
router.post('/layers', async (req, res) => {
  try {
    const { layerName, title, geometryType, attributes } = req.body;
    
    const result = await pool.query(
      `INSERT INTO user_layers (layer_name, title, geometry_type, attributes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [layerName, title, geometryType, JSON.stringify(attributes || [])]
    );
    
    // Publicar en GeoServer (ver paso 3)
    await publishLayerInGeoServer(layerName, geometryType);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creando capa:', error);
    res.status(500).json({ error: error.message });
  }
});

// Agregar feature a una capa
router.post('/layers/:layerName/features', async (req, res) => {
  try {
    const { layerName } = req.params;
    const { geometry, attributes } = req.body;
    
    // Obtener ID de la capa
    const layerResult = await pool.query(
      'SELECT id FROM user_layers WHERE layer_name = $1',
      [layerName]
    );
    
    if (layerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capa no encontrada' });
    }
    
    const layerId = layerResult.rows[0].id;
    
    // Insertar feature
    const result = await pool.query(
      `INSERT INTO user_layer_features (layer_id, geometry, attributes)
       VALUES ($1, ST_GeomFromGeoJSON($2), $3)
       RETURNING id, ST_AsGeoJSON(geometry)::json as geometry, attributes`,
      [layerId, JSON.stringify(geometry), JSON.stringify(attributes || {})]
    );
    
    // Actualizar publicación en GeoServer
    await refreshGeoServerLayer(layerName);
    
    res.json({
      type: 'Feature',
      id: result.rows[0].id,
      geometry: result.rows[0].geometry,
      properties: result.rows[0].attributes
    });
  } catch (error) {
    console.error('Error agregando feature:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar feature
router.delete('/layers/:layerName/features/:featureId', async (req, res) => {
  try {
    const { layerName, featureId } = req.params;
    
    // Obtener ID de la capa
    const layerResult = await pool.query(
      'SELECT id FROM user_layers WHERE layer_name = $1',
      [layerName]
    );
    
    if (layerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Capa no encontrada' });
    }
    
    const layerId = layerResult.rows[0].id;
    
    // Eliminar feature
    await pool.query(
      'DELETE FROM user_layer_features WHERE id = $1 AND layer_id = $2',
      [featureId, layerId]
    );
    
    // Actualizar publicación en GeoServer
    await refreshGeoServerLayer(layerName);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando feature:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar capa completa
router.delete('/layers/:layerName', async (req, res) => {
  try {
    const { layerName } = req.params;
    
    // Eliminar de PostGIS (CASCADE eliminará las features)
    await pool.query(
      'DELETE FROM user_layers WHERE layer_name = $1',
      [layerName]
    );
    
    // Eliminar de GeoServer
    await deleteLayerFromGeoServer(layerName);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando capa:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### 2.5. Archivo `backend/server.js`

```javascript
const express = require('express');
const cors = require('cors');
const userLayersRoutes = require('./routes/userLayers');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/user-layers', userLayersRoutes);

app.listen(PORT, () => {
  console.log(`Backend API corriendo en http://localhost:${PORT}`);
});
```

---

## Paso 3: Integración con GeoServer REST API

### 3.1. Funciones para publicar/actualizar capas en GeoServer

Crear archivo `backend/services/geoserver.js`:

```javascript
const axios = require('axios');

const GEOSERVER_BASE = process.env.GEOSERVER_URL || 'http://localhost:8081/geoserver';
const GEOSERVER_USER = process.env.GEOSERVER_USER || 'admin';
const GEOSERVER_PASS = process.env.GEOSERVER_PASS || 'geoserver';
const WORKSPACE = 'gisTPI';

// Autenticación básica
const auth = Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString('base64');

// Publicar nueva capa en GeoServer
async function publishLayerInGeoServer(layerName, geometryType) {
  try {
    // 1. Verificar que el DataStore existe (debe existir el de PostGIS)
    // 2. Crear FeatureType
    const featureTypeXML = `<?xml version="1.0" encoding="UTF-8"?>
<featureType>
  <name>${layerName}</name>
  <nativeName>${layerName}</nativeName>
  <title>${layerName}</title>
  <srs>EPSG:4326</srs>
  <nativeBoundingBox>
    <minx>-180</minx>
    <maxx>180</maxx>
    <miny>-90</miny>
    <maxy>90</maxy>
  </nativeBoundingBox>
  <latLonBoundingBox>
    <minx>-180</minx>
    <maxx>180</maxx>
    <miny>-90</miny>
    <maxy>90</maxy>
  </latLonBoundingBox>
</featureType>`;

    const response = await axios.post(
      `${GEOSERVER_BASE}/rest/workspaces/${WORKSPACE}/datastores/postgis_gisTPI/featuretypes`,
      featureTypeXML,
      {
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': `Basic ${auth}`
        }
      }
    );
    
    console.log(`Capa ${layerName} publicada en GeoServer`);
    return true;
  } catch (error) {
    console.error(`Error publicando capa ${layerName}:`, error.response?.data || error.message);
    throw error;
  }
}

// Refrescar capa en GeoServer (forzar recarga de datos)
async function refreshGeoServerLayer(layerName) {
  try {
    // Usar REST API para recargar la capa
    await axios.post(
      `${GEOSERVER_BASE}/rest/workspaces/${WORKSPACE}/datastores/postgis_gisTPI/reset`,
      {},
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );
    
    console.log(`Capa ${layerName} refrescada en GeoServer`);
    return true;
  } catch (error) {
    console.error(`Error refrescando capa ${layerName}:`, error.response?.data || error.message);
    // No lanzar error, solo loguear
  }
}

// Eliminar capa de GeoServer
async function deleteLayerFromGeoServer(layerName) {
  try {
    await axios.delete(
      `${GEOSERVER_BASE}/rest/workspaces/${WORKSPACE}/datastores/postgis_gisTPI/featuretypes/${layerName}`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );
    
    console.log(`Capa ${layerName} eliminada de GeoServer`);
    return true;
  } catch (error) {
    console.error(`Error eliminando capa ${layerName}:`, error.response?.data || error.message);
    // No lanzar error, solo loguear
  }
}

module.exports = {
  publishLayerInGeoServer,
  refreshGeoServerLayer,
  deleteLayerFromGeoServer
};
```

### 3.2. Actualizar `backend/routes/userLayers.js`

Agregar al inicio:
```javascript
const {
  publishLayerInGeoServer,
  refreshGeoServerLayer,
  deleteLayerFromGeoServer
} = require('../services/geoserver');
```

---

## Paso 4: Modificar Frontend para usar Backend API

### 4.1. Actualizar `src/config.js`

```javascript
// Usar proxy para evitar CORS en desarrollo
const GEOSERVER_BASE = process.env.NODE_ENV === 'production' 
  ? 'http://localhost:8081' 
  : ''; // En desarrollo, usar proxy configurado en package.json

export const URL_OGC = `${GEOSERVER_BASE}/geoserver/gisTPI/wms`;
export const URL_WFS = `${GEOSERVER_BASE}/geoserver/gisTPI/wfs`;

// API Backend
export const API_BASE = process.env.NODE_ENV === 'production'
  ? 'http://localhost:3001'
  : 'http://localhost:3001';

export const API_USER_LAYERS = `${API_BASE}/api/user-layers`;
```

### 4.2. Crear servicio para API en `src/services/userLayersAPI.js`

```javascript
import { API_USER_LAYERS } from '../config';

export const userLayersAPI = {
  // Obtener todas las capas
  async getAllLayers() {
    const response = await fetch(`${API_USER_LAYERS}/layers`);
    if (!response.ok) throw new Error('Error obteniendo capas');
    return response.json();
  },

  // Obtener una capa con sus features
  async getLayer(layerName) {
    const response = await fetch(`${API_USER_LAYERS}/layers/${layerName}`);
    if (!response.ok) throw new Error('Error obteniendo capa');
    return response.json();
  },

  // Crear nueva capa
  async createLayer(layerName, title, geometryType, attributes = []) {
    const response = await fetch(`${API_USER_LAYERS}/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layerName, title, geometryType, attributes })
    });
    if (!response.ok) throw new Error('Error creando capa');
    return response.json();
  },

  // Agregar feature a una capa
  async addFeature(layerName, geometry, attributes = {}) {
    const response = await fetch(`${API_USER_LAYERS}/layers/${layerName}/features`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geometry, attributes })
    });
    if (!response.ok) throw new Error('Error agregando feature');
    return response.json();
  },

  // Eliminar feature
  async deleteFeature(layerName, featureId) {
    const response = await fetch(`${API_USER_LAYERS}/layers/${layerName}/features/${featureId}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error eliminando feature');
    return response.json();
  },

  // Eliminar capa
  async deleteLayer(layerName) {
    const response = await fetch(`${API_USER_LAYERS}/layers/${layerName}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Error eliminando capa');
    return response.json();
  }
};
```

### 4.3. Modificar `LayerManager.jsx`

Reemplazar métodos de localStorage por llamadas a la API:

```javascript
// En lugar de saveUserLayers(), usar:
async saveUserLayerToDB(layerId, layer) {
  const layerName = layerId.replace('user:', '');
  const source = layer.getSource();
  const features = source.getFeatures();
  const format = new GeoJSON();
  
  // Guardar cada feature en la base de datos
  for (const feature of features) {
    const featureJSON = format.writeFeature(feature, {
      featureProjection: "EPSG:3857",
      dataProjection: "EPSG:4326",
    });
    const featureObj = JSON.parse(featureJSON);
    
    await userLayersAPI.addFeature(
      layerName,
      featureObj.geometry,
      featureObj.properties
    );
  }
}

// En lugar de loadUserLayers(), usar:
async loadUserLayersFromDB() {
  try {
    const layers = await userLayersAPI.getAllLayers();
    
    for (const layerData of layers) {
      const layerInfo = await userLayersAPI.getLayer(layerData.layer_name);
      
      // Crear capa desde GeoServer (WMS) en lugar de VectorLayer
      const layerId = `user:${layerData.layer_name}`;
      
      // Cargar como capa WMS desde GeoServer
      const source = new ImageWMS({
        url: URL_OGC,
        params: {
          LAYERS: `gisTPI:${layerData.layer_name}`,
          VERSION: "1.1.0",
          SRS: "EPSG:4326",
          FORMAT: "image/png",
        },
        serverType: "geoserver",
      });

      const wmsLayer = new ImageLayer({
        visible: false,
        source: source,
      });

      wmsLayer.set('title', layerData.title);
      wmsLayer.set('geometryType', layerData.geometry_type);
      wmsLayer.set('isUserLayer', true);
      wmsLayer.set('layerName', layerData.layer_name);

      this.map.addLayer(wmsLayer);
      this.userLayers[layerId] = wmsLayer;
    }
  } catch (error) {
    console.error('Error cargando capas desde DB:', error);
  }
}
```

---

## Paso 5: Configurar GeoServer DataStore

### 5.1. Verificar DataStore PostGIS

1. Acceder a GeoServer: http://localhost:8081/geoserver
2. Ir a **Stores** → **postgis_gisTPI**
3. Verificar que esté configurado para usar la tabla `user_layers` y `user_layer_features`

### 5.2. Configurar publicación automática

GeoServer detectará automáticamente las nuevas tablas en PostGIS si:
- El DataStore está configurado correctamente
- Las tablas tienen columna `geometry` con tipo PostGIS
- Las tablas están en el schema `public`

---

## Paso 6: Actualizar package.json

```json
{
  "scripts": {
    "start": "react-scripts start",
    "backend": "node backend/server.js",
    "dev": "concurrently \"npm run backend\" \"npm start\""
  },
  "dependencies": {
    // ... existentes
  },
  "devDependencies": {
    "concurrently": "^7.6.0"
  }
}
```

---

## Resumen de Cambios Necesarios

1. ✅ **Base de datos**: Crear tablas `user_layers` y `user_layer_features` en PostGIS
2. ✅ **Backend API**: Crear servidor Node.js/Express con endpoints CRUD
3. ✅ **GeoServer Integration**: Funciones para publicar/actualizar capas automáticamente
4. ✅ **Frontend**: Modificar `LayerManager.jsx` para usar API en lugar de localStorage
5. ✅ **Visualización**: Cambiar capas de usuario de VectorLayer a ImageWMS (desde GeoServer)

---

## Consideraciones Importantes

### Sincronización
- Cada modificación debe guardarse en PostGIS
- Después de guardar, llamar a `refreshGeoServerLayer()` para actualizar
- Las capas se visualizan como WMS desde GeoServer

### Rendimiento
- Usar transacciones para múltiples features
- Considerar debounce para actualizaciones frecuentes
- Índices espaciales ya están creados

### Seguridad
- Agregar autenticación al backend API
- Validar inputs antes de guardar
- Sanitizar nombres de capas

---

## Próximos Pasos

1. Ejecutar scripts SQL para crear tablas
2. Crear estructura de backend
3. Probar endpoints con Postman/curl
4. Modificar frontend gradualmente
5. Probar flujo completo: crear → dibujar → guardar → visualizar

¿Quieres que implemente alguna parte específica del código?

