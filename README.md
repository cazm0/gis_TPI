# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Instalación Inicial

Sigue estos pasos para configurar el proyecto desde cero:

### 1. Clonar o Descargar el Repositorio

Si tienes el repositorio en Git:
```bash
git clone <url-del-repositorio>
cd gis_TPI
```

O simplemente navega al directorio del proyecto si ya lo tienes descargado.

### 2. Instalar Dependencias de Node.js

Instala todas las dependencias necesarias para la aplicación React:

```bash
npm install
```

Este comando instalará todas las dependencias listadas en `package.json` (React, OpenLayers, etc.). Puede tardar unos minutos la primera vez.

**Nota:** Si ves advertencias sobre paquetes deprecados o vulnerabilidades, puedes ignorarlas por ahora. Son comunes en proyectos con `react-scripts` y no afectan la funcionalidad.

### 3. Levantar los Servicios con Docker Compose

Antes de ejecutar la aplicación, necesitas tener los servicios de base de datos y GeoServer corriendo:

```bash
docker-compose -f docker/docker-compose.yml up -d
```

Esto levantará:
- **PostGIS** en el puerto `5433`
- **GeoServer** en el puerto `8081`
- **Aplicación Web** en el puerto `3000` (si usas Docker para la web)

Verifica que los contenedores estén corriendo:
```bash
docker-compose -f docker/docker-compose.yml ps
```

### 4. Ejecutar la Aplicación

Una vez instaladas las dependencias y levantados los servicios, puedes ejecutar la aplicación:

```bash
npm start
```

La aplicación se abrirá automáticamente en [http://localhost:3000](http://localhost:3000)

### Resumen de Comandos

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar servicios Docker
docker-compose -f docker/docker-compose.yml up -d

# 3. Ejecutar la aplicación
npm start
```

### Notas Importantes

- Asegúrate de tener **Node.js** (versión 14 o superior) y **npm** instalados
- Asegúrate de tener **Docker** y **Docker Compose** instalados y corriendo
- La configuración de GeoServer en `src/config.js` ya está configurada para usar el puerto `8081`
- Si ejecutas `npm start` sin tener Docker corriendo, la aplicación se iniciará pero no podrá cargar las capas desde GeoServer

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Docker Compose Setup

Este proyecto incluye una configuración de Docker Compose para levantar todos los servicios necesarios de forma sencilla.

### Requisitos Previos

- [Docker](https://www.docker.com/get-started) instalado en tu sistema
- [Docker Compose](https://docs.docker.com/compose/install/) instalado (generalmente viene incluido con Docker Desktop)

### Levantar los Servicios

1. **Navega al directorio del proyecto:**
   ```bash
   cd gis_TPI
   ```

2. **Levanta todos los servicios con Docker Compose:**
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```

   El flag `-d` ejecuta los contenedores en modo detached (en segundo plano).

3. **Verifica que los contenedores estén corriendo:**
   ```bash
   docker-compose -f docker/docker-compose.yml ps
   ```

### Servicios Disponibles

Una vez levantados los servicios, tendrás acceso a:

- **PostGIS (Base de datos):**
  - Puerto: `5433` (host) → `5432` (contenedor)
  - Usuario: `postgres`
  - Contraseña: `postgres`
  - Base de datos: `geoserver`
  - Conexión desde el host: `localhost:5433`

- **GeoServer:**
  - URL: [http://localhost:8081/geoserver](http://localhost:8081/geoserver)
  - Usuario por defecto: `admin`
  - Contraseña por defecto: `geoserver`

- **Aplicación Web (React):**
  - URL: [http://localhost:3000](http://localhost:3000)
  - Se ejecuta en modo desarrollo con hot-reload

### Comandos Útiles

**Detener los servicios:**
```bash
docker-compose -f docker/docker-compose.yml down
```

**Ver los logs:**
```bash
docker-compose -f docker/docker-compose.yml logs -f
```

**Ver logs de un servicio específico:**
```bash
docker-compose -f docker/docker-compose.yml logs -f web
docker-compose -f docker/docker-compose.yml logs -f geoserver
docker-compose -f docker/docker-compose.yml logs -f postgis
```

**Reconstruir los contenedores:**
```bash
docker-compose -f docker/docker-compose.yml up -d --build
```

**Detener y eliminar volúmenes (⚠️ esto eliminará los datos de PostGIS):**
```bash
docker-compose -f docker/docker-compose.yml down -v
```

### Notas Importantes

- Los datos de PostGIS se persisten en un volumen de Docker llamado `postgis_data`.
- Los datos de GeoServer se guardan en la carpeta `docker/geoserver_data` del proyecto.
- Los logs de GeoServer se guardan en la carpeta `docker/geoserver_logs` del proyecto.
- Si ya tienes PostgreSQL corriendo en el puerto 5432, el docker-compose.yml está configurado para usar el puerto 5433 en el host.


## Instalación de QGIS

QGIS es una aplicación de escritorio para trabajar con datos geoespaciales. Aunque no está incluido en Docker Compose, puedes instalarlo localmente en tu máquina para conectarte a PostGIS y trabajar con los datos.

### Descarga e Instalación

1. **Descarga QGIS:**
   - Visita: [https://qgis.org/es/site/forusers/download.html](https://qgis.org/es/site/forusers/download.html)
   - Selecciona la versión para Windows
   - Descarga el instalador recomendado (QGIS Standalone Installer)

2. **Instala QGIS:**
   - Ejecuta el instalador descargado
   - Sigue las instrucciones del asistente de instalación
   - Acepta la configuración por defecto o personaliza según tus necesidades

### Conectar QGIS a PostGIS

Una vez que tengas QGIS instalado y los servicios de Docker Compose corriendo, puedes conectarte a la base de datos PostGIS:

1. **Abre QGIS**

2. **Agrega una conexión PostGIS:**
   - Ve a `Capa` → `Añadir capa` → `Añadir capa PostGIS...`
   - O desde el panel del navegador, expande `PostGIS` y haz clic en el botón de conexión

3. **Configura la conexión:**
   - **Nombre:** `PostGIS Docker` (o cualquier nombre descriptivo)
   - **Anfitrión o Servidor:** `localhost`
   - **Puerto:** `5433`
   - **Base de datos:** `geoserver`
   - **Usuario:** `postgres`
   - **Contraseña:** `postgres`
   - Marca la casilla "Guardar contraseña" si lo deseas

4. **Conecta:**
   - Haz clic en `Probar conexión` para verificar que funciona
   - Luego haz clic en `Aceptar`

5. **Explora las capas:**
   - Una vez conectado, podrás ver todas las tablas espaciales disponibles en la base de datos
   - Selecciona las capas que quieras cargar en tu proyecto QGIS

### Notas

- Asegúrate de que los contenedores de Docker estén corriendo antes de intentar conectarte desde QGIS
- El puerto `5433` es el puerto mapeado en el host; internamente PostGIS usa el puerto `5432`
- Si cambias las credenciales en el `docker-compose.yml`, actualiza también la conexión en QGIS

## Instalación y Uso de pgAdmin

pgAdmin es una herramienta gráfica para administrar bases de datos PostgreSQL/PostGIS.

### Instalación de pgAdmin

1. **Descarga pgAdmin:**
   - Visita: [https://www.pgadmin.org/download/](https://www.pgadmin.org/download/)
   - Selecciona la versión para Windows
   - Descarga el instalador (pgAdmin 4)

2. **Instala pgAdmin:**
   - Ejecuta el instalador descargado
   - Sigue las instrucciones del asistente de instalación
   - Durante la instalación, se te pedirá establecer una contraseña maestra para pgAdmin (guárdala, la necesitarás para abrir pgAdmin)

3. **Abre pgAdmin:**
   - Busca "pgAdmin 4" en el menú de inicio de Windows
   - Ingresa la contraseña maestra que estableciste durante la instalación

### Requisitos para Conectar

- pgAdmin instalado en tu sistema
- Los servicios de Docker Compose deben estar corriendo

### Conectar pgAdmin a PostGIS

1. **Verifica que Docker esté corriendo:**
   ```bash
   docker-compose -f docker/docker-compose.yml ps
   ```

   Si los contenedores no están corriendo, levántalos:
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```

2. **Abre pgAdmin**

3. **Registra un nuevo servidor:**
   - Haz clic derecho en "Servers" en el panel izquierdo
   - Selecciona "Register" → "Server..."

4. **Configura la conexión:**
   
   **Pestaña "General":**
   - **Name:** `PostGIS Docker` (o cualquier nombre descriptivo)
   
   **Pestaña "Connection":**
   - **Host name/address:** `localhost`
   - **Port:** `5433` ⚠️ (Importante: es 5433, no 5432)
   - **Maintenance database:** `geoserver`
   - **Username:** `postgres`
   - **Password:** `postgres`
   - Marca la casilla "Save password" si lo deseas

5. **Guarda la conexión:**
   - Haz clic en "Save"

### Datos de Conexión Resumidos

```
Host: localhost
Puerto: 5433
Base de datos: geoserver
Usuario: postgres
Contraseña: postgres
```

### Notas Importantes

- El puerto es **5433** (no 5432) porque Docker mapea el puerto interno 5432 del contenedor al puerto 5433 del host
- PostGIS ya está incluido en la imagen de Docker, por lo que tendrás acceso a todas las funciones espaciales
- No necesitas instalar PostgreSQL localmente; todo corre en Docker
- Si cambias las credenciales en el `docker-compose.yml`, actualiza también la conexión en pgAdmin

## Importar Datos con import.py

El script `import.py` permite importar archivos de datos geoespaciales (dump de PostgreSQL, SQL, GeoPackage, etc.) a la base de datos PostGIS.

### Requisitos

- Python 3 instalado en tu sistema
- Herramientas de PostgreSQL/PostGIS en el PATH o instaladas localmente:
  - `psql` (para scripts SQL)
  - `pg_restore` (para dumps binarios)
  - `ogr2ogr` (para GeoPackage y otros formatos)
  
  Estas herramientas suelen venir con:
  - PostgreSQL instalado localmente
  - QGIS (incluye ogr2ogr)
  - OSGeo4W

### Configuración

El script `import.py` ya está configurado para conectarse a PostGIS en Docker con los siguientes parámetros:

```python
DB_HOST = "localhost"
DB_PORT = "5433"
DB_NAME = "geoserver"
DB_USER = "postgres"
DB_PASSWORD = "postgres"
```

Si necesitas cambiar estos valores, edita las variables al inicio del archivo `import.py`.

### Uso del Script

1. **Asegúrate de que Docker esté corriendo:**
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```

2. **Coloca el archivo a importar en el directorio del proyecto:**
   - El script busca un archivo llamado `GisTPI` en el mismo directorio donde está `import.py`
   - Puedes cambiar el nombre del archivo editando la variable `INPUT_FILENAME` en `import.py`

3. **Ejecuta el script:**
   ```bash
   python import.py
   ```

   O desde PowerShell:
   ```powershell
   python import.py
   ```

### Formatos Soportados

El script detecta automáticamente el tipo de archivo y usa la herramienta apropiada:

- **Dump binario de PostgreSQL** (`.dump`, `.backup`): Usa `pg_restore`
- **Script SQL** (`.sql`): Usa `psql`
- **GeoPackage** (`.gpkg`): Usa `ogr2ogr`

### Proceso de Importación

1. El script detecta automáticamente el tipo de archivo
2. Activa las extensiones PostGIS necesarias en la base de datos
3. Importa los datos según el formato detectado
4. Muestra mensajes de progreso y posibles advertencias

### Notas Importantes

- El script activa automáticamente las extensiones PostGIS (`postgis` y `postgis_topology`) si no están activas
- Si falta PostGIS en el sistema, el script intentará guiarte para instalarlo
- Los errores menores o advertencias sobre tablas existentes pueden ignorarse si la importación fue exitosa
- Si cambias las credenciales en el `docker-compose.yml`, actualiza también la configuración en `import.py`

## Publicar Capas de PostGIS en GeoServer

Una vez que tengas los datos importados en PostGIS, necesitas publicarlos en GeoServer para que la aplicación React pueda acceder a ellos mediante WMS.

### Requisitos Previos

- Los datos deben estar importados en PostGIS (usando `import.py` o cualquier otro método)
- Los servicios de Docker Compose deben estar corriendo
- GeoServer debe estar accesible en [http://localhost:8081/geoserver](http://localhost:8081/geoserver)

### Opción 1: Publicar desde el Data Store (Recomendado para múltiples capas)

Esta es la forma más sencilla y permite publicar múltiples capas a la vez.

#### 1. Acceder a GeoServer

1. Abre tu navegador y ve a: **http://localhost:8081/geoserver**
2. Inicia sesión con:
   - Usuario: `admin`
   - Contraseña: `geoserver`

#### 2. Crear un Workspace

1. En el menú lateral izquierdo, ve a **"Workspaces"**
2. Haz clic en **"Add new workspace"**
3. Completa:
   - **Name:** `gisTPI` ⚠️ (debe coincidir exactamente con el usado en `src/config.js`)
   - **Namespace URI:** `http://gisTPI` (o cualquier URI válida)
4. Haz clic en **"Submit"**

#### 3. Crear un Data Store de PostGIS

1. En el menú lateral, ve a **"Stores"**
2. Haz clic en **"Add new store"**
3. Selecciona **"PostGIS"** (PostGIS Database)
4. Completa la configuración:

   **Basic Store Info:**
   - **Workspace:** `gisTPI` (selecciona el que acabas de crear)
   - **Data Source Name:** `postgis_gisTPI` (o cualquier nombre descriptivo)

   **Connection Parameters:**
   - **host:** `postgis` ⚠️ (nombre del servicio en Docker, NO "localhost")
   - **port:** `5432` ⚠️ (puerto interno del contenedor, NO 5433)
   - **database:** `geoserver`
   - **schema:** `public` (o el schema donde están tus tablas)
   - **user:** `postgres`
   - **passwd:** `postgres`
   - **dbtype:** `postgis`

5. Haz clic en **"Save"**

#### 4. Publicar Múltiples Capas a la Vez

1. Después de guardar el Data Store, GeoServer mostrará automáticamente la lista de todas las tablas con geometrías detectadas
2. En esta lista, verás todas las tablas disponibles
3. **Para publicar todas las capas:**
   - Marca las casillas de las tablas que quieras publicar
   - Haz clic en **"Publish"** o **"Publish selected"** para publicarlas todas a la vez
4. **Para publicar una por una:**
   - Haz clic en el nombre de cada tabla
   - Configura la capa:
     - **Name:** debe coincidir con el nombre en `src/layers.js` (ej: `Actividades_Agropecuarias`)
     - **Title:** título descriptivo
     - **Native SRS:** selecciona el sistema de coordenadas de tus datos (ej: `EPSG:4326` o `EPSG:3857`)
     - **Declared SRS:** igual que Native SRS
   - En la pestaña **"Data"**, verifica que el campo geométrico esté detectado correctamente
   - Haz clic en **"Save"**

#### 5. Verificar las Capas Publicadas

1. Ve a **"Layers"** en el menú lateral
2. Deberías ver todas las capas publicadas
3. Haz clic en una capa y luego en **"Layer Preview"** para verificar que se muestre correctamente

### Opción 2: Usar la Extensión Importer

GeoServer incluye una extensión de importación que puede facilitar el proceso. Esta extensión ya está instalada según tu configuración de Docker.

#### 1. Acceder a la Herramienta de Importación

1. Accede a GeoServer: **http://localhost:8081/geoserver**
2. Inicia sesión con usuario `admin` y contraseña `geoserver`
3. En el menú lateral, busca y haz clic en **"Import Data"** o **"Import"**

#### 2. Configurar la Importación

1. Selecciona **"PostGIS"** como fuente de datos
2. Completa la configuración de conexión:
   - **Host:** `postgis` (nombre del servicio en Docker)
   - **Port:** `5432` (puerto interno)
   - **Database:** `geoserver`
   - **Schema:** `public`
   - **User:** `postgres`
   - **Password:** `postgres`

3. **Seleccionar tablas:**
   - La herramienta mostrará todas las tablas disponibles
   - Puedes seleccionar múltiples tablas a la vez
   - Marca las casillas de las tablas que quieras importar

4. **Configurar el workspace:**
   - Selecciona o crea el workspace `gisTPI`
   - Configura los nombres de las capas para que coincidan con `src/layers.js`

5. **Ejecutar la importación:**
   - Haz clic en **"Import"** o **"Next"** para continuar
   - GeoServer importará y publicará las capas automáticamente

#### 3. Verificar la Importación

1. Ve a **"Layers"** para verificar que todas las capas fueron publicadas
2. Verifica que los nombres coincidan con los de `src/layers.js`

### Notas Importantes sobre la Conexión

⚠️ **IMPORTANTE:** Como GeoServer y PostGIS están en la misma red Docker:

- **Host:** Usa `postgis` (nombre del servicio), **NO** `localhost`
- **Puerto:** Usa `5432` (puerto interno del contenedor), **NO** `5433`

Si GeoServer estuviera corriendo fuera de Docker, usarías `localhost:5433`.

### Verificar que las Capas Coincidan con la Aplicación

La aplicación React busca capas con el formato `gisTPI:NombreCapa` en `src/layers.js`. Asegúrate de que:

1. El workspace se llame exactamente `gisTPI`
2. Los nombres de las capas en GeoServer coincidan con los nombres en `src/layers.js` (sin el prefijo `gisTPI:`)

Ejemplo:
- En `src/layers.js`: `{ id: "gisTPI:Actividades_Agropecuarias", ... }`
- En GeoServer: Workspace = `gisTPI`, Capa = `Actividades_Agropecuarias`

### Solución de Problemas

- **No se ven las tablas:** Verifica que las tablas tengan una columna geométrica (tipo `geometry` o `geography`)
- **Error de conexión:** Verifica que ambos contenedores estén corriendo y que uses `postgis` como host
- **Las capas no aparecen en la app:** Verifica que los nombres coincidan exactamente con `src/layers.js`

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
