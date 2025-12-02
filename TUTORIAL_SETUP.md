# Tutorial: Configuración Completa desde Cero

Este tutorial te guiará paso a paso para configurar todo el entorno desde cero, incluyendo Docker, PostGIS, importación de datos y configuración de GeoServer.

---

## Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

1. **Docker Desktop** instalado y corriendo
2. **Node.js y npm** instalados
3. **Python 3** instalado
4. **Herramientas de PostgreSQL** (psql, pg_restore) - vienen con PostgreSQL o QGIS
5. El archivo **GisTPI** (dump, SQL o GeoPackage) en el directorio raíz del proyecto

---

## Paso 1: Clonar/Descargar el proyecto

```bash
# Si tienes el repositorio en Git
git clone <url-del-repositorio>
cd gis_TPI

# O simplemente navega al directorio si ya lo tienes
cd gis_TPI
```

---

## Paso 2: Instalar dependencias de Node.js

```bash
npm install
```

Esto instalará todas las dependencias necesarias (React, OpenLayers, etc.). Puede tardar unos minutos.

---

## Paso 3: Levantar servicios con Docker Compose

```bash
# Navega al directorio docker (si no estás ahí)
cd docker

# Levanta los servicios en segundo plano
docker-compose up -d
```

O desde el directorio raíz:
```bash
docker-compose -f docker/docker-compose.yml up -d
```

Verifica que los contenedores estén corriendo:
```bash
docker-compose -f docker/docker-compose.yml ps
```

Deberías ver `postgis` y `geoserver` con estado `Up`.

---

## Paso 4: Verificar que PostGIS esté listo

Espera unos segundos para que PostGIS se inicialice completamente. Puedes verificar los logs:

```bash
docker-compose -f docker/docker-compose.yml logs postgis
```

Cuando veas mensajes como "database system is ready to accept connections", puedes continuar.

---

## Paso 5: Importar datos con import.py

### 5.1. Colocar el archivo GisTPI

Coloca el archivo `GisTPI` (puede ser un dump binario, SQL o GeoPackage) en el directorio raíz del proyecto, junto al archivo `import.py`.

### 5.2. Verificar configuración de import.py

El archivo `import.py` ya está configurado con:
- **Host**: `localhost`
- **Puerto**: `5433` (puerto mapeado en Docker)
- **Base de datos**: `geoserver`
- **Usuario**: `postgres`
- **Contraseña**: `postgres`

Si necesitas cambiar estos valores, edita las variables al inicio del archivo `import.py`.

### 5.3. Ejecutar el script de importación

```bash
# Desde el directorio raíz del proyecto
python import.py
```

El script:
1. Detecta automáticamente el tipo de archivo (dump binario, SQL, GeoPackage)
2. Activa la extensión PostGIS si es necesario
3. Importa los datos a la base de datos

**Nota**: Si no tienes las herramientas de PostgreSQL instaladas localmente, el script intentará guiarte para instalarlas.

---

## Paso 6: Configurar GeoServer

### 6.1. Acceder a GeoServer

1. Abre tu navegador y ve a: **http://localhost:8081/geoserver**
2. Inicia sesión con:
   - **Usuario**: `admin`
   - **Contraseña**: `geoserver`

### 6.2. Crear Workspace

1. En el menú lateral izquierdo, haz clic en **"Workspaces"**
2. Haz clic en **"Add new workspace"**
3. Configura:
   - **Name**: `gisTPI` (debe coincidir exactamente con el nombre en `src/config.js`)
   - **Namespace URI**: `http://gisTPI`
4. Haz clic en **"Submit"**

### 6.3. Crear Data Store de PostGIS

1. En el menú lateral, haz clic en **"Stores"**
2. Haz clic en **"Add new store"**
3. Selecciona **"PostGIS"** (PostGIS Database)
4. Configura el Data Store:

   **Basic Store Info:**
   - **Workspace**: `gisTPI`
   - **Data Source Name**: `postgis_gisTPI`

   **Connection Parameters:**
   - **host**: `postgis` (nombre del servicio en Docker, NO "localhost")
   - **port**: `5432` (puerto interno del contenedor, NO 5433)
   - **database**: `geoserver`
   - **schema**: `public`
   - **user**: `postgres`
   - **passwd**: `postgres`
   - **dbtype**: `postgis`

5. Haz clic en **"Save"**

### 6.4. Publicar capas

Después de guardar el Data Store, GeoServer te mostrará una lista de todas las tablas con geometrías disponibles.

**Opción A: Publicar múltiples capas a la vez**
1. Marca las casillas de las tablas que quieras publicar
2. Haz clic en **"Publish"** o **"Publish selected"**

**Opción B: Publicar una por una**
1. Haz clic en el nombre de cada tabla que quieras publicar
2. En la pestaña **"Data"**, configura:
   - **Name**: Debe coincidir con el nombre en `src/layers.js` (ej: `Actividades_Agropecuarias`)
   - **Title**: Título descriptivo de la capa
   - **Native SRS**: Sistema de coordenadas (ej: `EPSG:4326`)
   - **Declared SRS**: Igual que Native SRS
3. Verifica que el campo geométrico esté correctamente identificado
4. Haz clic en **"Save"**

### 6.5. Verificar capas publicadas

1. En el menú lateral, haz clic en **"Layers"**
2. Deberías ver todas las capas que publicaste
3. Haz clic en una capa → **"Layer Preview"** para verificar que se muestre correctamente

---

## Paso 7: Verificar nombres de capas

La aplicación React busca las capas con el formato `gisTPI:NombreCapa` según la configuración en `src/layers.js`.

Asegúrate de que:
- El **Workspace** en GeoServer sea exactamente `gisTPI`
- Los **nombres de las capas** en GeoServer coincidan con los nombres en `src/layers.js` (sin el prefijo `gisTPI:`)

**Ejemplo:**
- En `src/layers.js`: `{ id: "gisTPI:Actividades_Agropecuarias", ... }`
- En GeoServer: Workspace = `gisTPI`, Capa = `Actividades_Agropecuarias`

**Nota**: GeoServer a veces agrega un "0" al final del nombre de la capa (ej: `Actividades_Agropecuarias0`). El código maneja esto automáticamente, así que no te preocupes si ves esto.

---

## Paso 8: Ejecutar la aplicación React

```bash
# Desde el directorio raíz del proyecto
npm start
```

La aplicación se abrirá automáticamente en **http://localhost:3000**

---

## Resumen de comandos

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar servicios Docker
docker-compose -f docker/docker-compose.yml up -d

# 3. Verificar que estén corriendo
docker-compose -f docker/docker-compose.yml ps

# 4. Importar datos (después de colocar el archivo GisTPI)
python import.py

# 5. Ejecutar la aplicación
npm start
```

---

## Solución de problemas

### PostGIS no se conecta desde GeoServer
- Asegúrate de usar `postgis` como host (nombre del servicio en Docker), NO `localhost`
- El puerto interno es `5432`, NO `5433`

### Las capas no aparecen en la aplicación
- Verifica que el workspace sea exactamente `gisTPI`
- Verifica que los nombres de las capas coincidan con `src/layers.js`
- Revisa la consola del navegador para ver errores

### Error al importar datos
- Verifica que el archivo `GisTPI` esté en el directorio raíz
- Verifica que PostGIS esté corriendo: `docker-compose -f docker/docker-compose.yml logs postgis`
- Verifica los permisos del archivo

### GeoServer no carga
- Verifica que el contenedor esté corriendo: `docker-compose -f docker/docker-compose.yml ps`
- Revisa los logs: `docker-compose -f docker/docker-compose.yml logs geoserver`
- Espera unos segundos después de iniciar el contenedor

---

## Comandos útiles

```bash
# Ver logs de PostGIS
docker-compose -f docker/docker-compose.yml logs postgis

# Ver logs de GeoServer
docker-compose -f docker/docker-compose.yml logs geoserver

# Detener servicios
docker-compose -f docker/docker-compose.yml down

# Reiniciar servicios
docker-compose -f docker/docker-compose.yml restart

# Ver estado de contenedores
docker-compose -f docker/docker-compose.yml ps
```

---

## Notas importantes

1. **Puertos**:
   - PostGIS está mapeado al puerto `5433` en el host (para conexiones externas)
   - GeoServer está mapeado al puerto `8081` en el host
   - Dentro de Docker, PostGIS usa el puerto `5432` (para conexiones entre contenedores)

2. **Nombres de servicios**:
   - Dentro de Docker Compose, los servicios se comunican usando sus nombres (`postgis`, `geoserver`)
   - Desde fuera de Docker, usa `localhost` con los puertos mapeados

3. **Base de datos**:
   - La base de datos se llama `geoserver` (no `GIS` como en algunos ejemplos)
   - Las credenciales por defecto son `postgres/postgres`

---

¡Listo! Ahora deberías tener todo funcionando. Si encuentras algún problema, revisa la sección de "Solución de problemas" o los logs de los contenedores.

