# Guía: Crear Capas en QGIS e Importar a PostGIS

## Método Simplificado: QGIS → PostGIS → GeoServer

Esta es la forma más sencilla de crear capas de usuario que se persistan en PostGIS y se publiquen en GeoServer.

---

## Paso 1: Conectar QGIS a PostGIS

### 1.1. Abrir QGIS

1. Abre QGIS en tu computadora
2. Asegúrate de que los servicios Docker estén corriendo:
   ```bash
   docker-compose -f docker/docker-compose.yml ps
   ```

### 1.2. Crear Conexión a PostGIS

1. En QGIS, ve a **Capa** → **Añadir capa** → **Añadir capa PostGIS...**
   - O desde el panel del navegador (izquierda), expande **PostGIS** y haz clic en el botón de conexión

2. Configura la conexión:
   - **Nombre:** `PostGIS Docker` (o cualquier nombre)
   - **Anfitrión o Servidor:** `localhost`
   - **Puerto:** `5433` ⚠️ (puerto del host, NO 5432)
   - **Base de datos:** `geoserver`
   - **Usuario:** `postgres`
   - **Contraseña:** `postgres`
   - Marca **"Guardar contraseña"** si quieres

3. Haz clic en **"Probar conexión"** para verificar
4. Haz clic en **"Aceptar"**

---

## Paso 2: Crear Nueva Capa en QGIS

### 2.1. Crear Capa Vacía

1. En QGIS, ve a **Capa** → **Crear capa** → **Nueva capa shapefile...**
   - O usa el atajo: **Capa** → **Crear capa** → **Nueva capa GeoPackage...**

2. **Opción A: Shapefile (temporal)**
   - Tipo de geometría: **Punto**, **Línea** o **Polígono**
   - Guarda en una ubicación temporal
   - Haz clic en **"Aceptar"**

3. **Opción B: GeoPackage (recomendado)**
   - Tipo de geometría: **Punto**, **Línea** o **Polígono**
   - Sistema de coordenadas: **EPSG:4326** (WGS 84)
   - Guarda como `.gpkg`
   - Haz clic en **"Aceptar"**

### 2.2. Agregar Campos (Atributos)

1. Con la capa seleccionada, haz clic derecho → **Abrir tabla de atributos**
2. Haz clic en el botón **"Añadir campo"** (icono de lápiz)
3. Agrega los campos que necesites:
   - **Nombre del campo:** ej. `nombre`, `descripcion`, `fecha`
   - **Tipo:** Texto, Número entero, Número decimal, Fecha, etc.
   - Haz clic en **"Aceptar"** para cada campo

### 2.3. Activar Edición y Dibujar

1. Haz clic derecho en la capa → **Activar edición**
2. Usa las herramientas de dibujo:
   - **Añadir entidad punto** (para puntos)
   - **Añadir entidad línea** (para líneas)
   - **Añadir entidad polígono** (para polígonos)
3. Dibuja las features que necesites
4. Completa los atributos en la tabla
5. **Guarda los cambios** (icono de disco) y **Desactiva edición**

---

## Paso 3: Importar Capa a PostGIS

### 3.1. Usar DB Manager (Método 1 - Recomendado)

1. En QGIS, ve a **Base de datos** → **DB Manager** → **DB Manager**
2. En el panel izquierdo, expande **PostGIS** → **PostGIS Docker**
3. Expande **Schemas** → **public**

4. **Importar capa:**
   - Haz clic en el botón **"Importar archivo/capa"** (icono de flecha hacia abajo)
   - O haz clic derecho en **public** → **Importar archivo/capa**

5. Configura la importación:
   - **Formato de entrada:** Shapefile o GeoPackage (según lo que creaste)
   - **Archivo:** Selecciona tu archivo `.shp` o `.gpkg`
   - **Tabla:** Nombre de la tabla en PostGIS (ej: `mi_capa_usuario`)
   - **Esquema:** `public`
   - **Sistema de coordenadas:** Debe detectar EPSG:4326 automáticamente
   - **Codificación:** UTF-8

6. **Opciones avanzadas:**
   - ✅ **Crear índice espacial** (recomendado)
   - ✅ **Convertir nombres de campo a minúsculas** (opcional)
   - ✅ **Crear clave primaria** (recomendado)

7. Haz clic en **"Aceptar"**
8. Espera a que termine la importación

### 3.2. Usar Plugin "QuickOSM" o "SPIT" (Método 2)

1. Instala el plugin **SPIT** (Shapefile to PostGIS Import Tool):
   - **Complementos** → **Administrar e instalar complementos**
   - Busca "SPIT" o "PostGIS"
   - Instala el plugin

2. Usa el plugin para importar tu capa

### 3.3. Usar ogr2ogr desde Terminal (Método 3)

Si prefieres usar línea de comandos:

```bash
# Para Shapefile
ogr2ogr -f "PostgreSQL" \
  PG:"host=localhost port=5433 dbname=geoserver user=postgres password=postgres" \
  tu_archivo.shp \
  -nln mi_capa_usuario \
  -nlt PROMOTE_TO_MULTI \
  -lco GEOMETRY_NAME=geometry \
  -lco FID=id

# Para GeoPackage
ogr2ogr -f "PostgreSQL" \
  PG:"host=localhost port=5433 dbname=geoserver user=postgres password=postgres" \
  tu_archivo.gpkg \
  -nln mi_capa_usuario \
  -lco GEOMETRY_NAME=geometry \
  -lco FID=id
```

---

## Paso 4: Verificar en PostGIS

### 4.1. Desde QGIS

1. En **DB Manager**, expande **PostGIS Docker** → **Schemas** → **public**
2. Deberías ver tu nueva tabla
3. Haz clic derecho en la tabla → **Añadir al lienzo** para visualizarla

### 4.2. Desde pgAdmin o psql

```sql
-- Conectarse
psql -h localhost -p 5433 -U postgres -d geoserver

-- Ver tablas
\dt

-- Ver estructura de tu tabla
\d mi_capa_usuario

-- Ver datos
SELECT * FROM mi_capa_usuario LIMIT 10;

-- Verificar geometría
SELECT ST_AsText(geometry) FROM mi_capa_usuario LIMIT 1;
```

---

## Paso 5: Publicar en GeoServer

### 5.1. Método Automático (si el DataStore ya está configurado)

Si ya tienes el DataStore `postgis_gisTPI` configurado en GeoServer:

1. Accede a GeoServer: http://localhost:8081/geoserver
2. Inicia sesión: `admin` / `geoserver`
3. Ve a **Stores** → **postgis_gisTPI**
4. Haz clic en **"Layer Preview"** o **"Add a resource from this data store"**
5. GeoServer debería detectar automáticamente tu nueva tabla
6. Haz clic en el nombre de tu tabla para publicarla

### 5.2. Método Manual

1. En GeoServer, ve a **Layers** → **Add a new layer**
2. Selecciona el DataStore: **postgis_gisTPI**
3. Selecciona tu tabla: **mi_capa_usuario**
4. Configura la capa:
   - **Name:** `mi_capa_usuario` (o el nombre que quieras)
   - **Title:** Título descriptivo
   - **Native SRS:** `EPSG:4326`
   - **Declared SRS:** `EPSG:4326`
5. En la pestaña **"Data"**, verifica:
   - Campo de geometría detectado correctamente
   - Bounding boxes calculados
6. Haz clic en **"Save"**

### 5.3. Verificar Publicación

1. Ve a **Layers** → Tu capa → **Layer Preview**
2. Selecciona formato: **OpenLayers** o **GML**
3. Deberías ver tu capa en el mapa

---

## Paso 6: Agregar Capa a la Aplicación React

### 6.1. Actualizar `src/layers.js`

Agrega tu nueva capa a la configuración:

```javascript
export const layersConfig = [
  // ... capas existentes ...
  
  // Capa de Usuario
  { 
    id: "gisTPI:mi_capa_usuario", 
    title: "Mi Capa Usuario", 
    group: "Usuario", 
    emoji: "👤" 
  },
];
```

### 6.2. Verificar que Funcione

1. Ejecuta la aplicación: `npm start`
2. La capa debería aparecer en el panel de capas
3. Actívala y deberías verla en el mapa

---

## Paso 7: Editar Capa desde QGIS (Opcional)

Si quieres editar la capa después:

1. En QGIS, **DB Manager** → **PostGIS Docker** → **public** → Tu tabla
2. Haz clic derecho → **Añadir al lienzo**
3. Haz clic derecho en la capa → **Activar edición**
4. Edita las features (agregar, modificar, eliminar)
5. **Guarda los cambios**
6. En GeoServer, **recarga la capa** o espera a que se actualice automáticamente

---

## Flujo Completo Resumido

```
1. QGIS: Crear capa → Dibujar features → Guardar
    ↓
2. QGIS DB Manager: Importar a PostGIS
    ↓
3. PostGIS: Tabla creada con geometrías
    ↓
4. GeoServer: Detectar/Publicar tabla
    ↓
5. React App: Agregar a layers.js → Visualizar
```

---

## Ventajas de este Método

✅ **Simple**: No requiere backend API  
✅ **Visual**: Creas y editas en QGIS (herramienta profesional)  
✅ **Persistente**: Datos en PostGIS (base de datos)  
✅ **Automático**: GeoServer detecta nuevas tablas  
✅ **Editable**: Puedes editar desde QGIS cuando quieras  

---

## Consejos

1. **Nombres de tablas**: Usa nombres sin espacios ni caracteres especiales (ej: `mi_capa`, `capa_usuario_1`)

2. **Sistema de coordenadas**: Siempre usa **EPSG:4326** (WGS 84) para compatibilidad

3. **Índices espaciales**: QGIS los crea automáticamente, pero verifica:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'mi_capa_usuario';
   ```

4. **Permisos**: Asegúrate de que el usuario `postgres` tenga permisos:
   ```sql
   GRANT ALL ON TABLE mi_capa_usuario TO postgres;
   ```

5. **Actualización en GeoServer**: Si modificas la capa en QGIS, en GeoServer:
   - Ve a **Layers** → Tu capa → **Reload**
   - O simplemente recarga la página del mapa

---

## Solución de Problemas

### La tabla no aparece en GeoServer
- Verifica que el DataStore esté configurado correctamente
- Verifica que la tabla tenga una columna `geometry` de tipo PostGIS
- Verifica permisos del usuario en PostGIS

### La capa no se ve en el mapa
- Verifica que el nombre en `layers.js` coincida con el de GeoServer
- Verifica que el workspace sea `gisTPI`
- Revisa la consola del navegador para errores

### Error al importar
- Verifica que PostGIS esté corriendo
- Verifica credenciales de conexión
- Verifica que el archivo no esté corrupto

---

¿Necesitas ayuda con algún paso específico?

