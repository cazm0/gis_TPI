# Análisis del Proyecto GIS TPI

## Resumen General

Este proyecto implementa un **Sistema de Información Geográfica (SIG)** web utilizando tecnologías modernas. La aplicación permite visualizar, consultar y editar datos geoespaciales almacenados en PostGIS y servidos a través de GeoServer, con una interfaz web desarrollada en React y OpenLayers.

### Arquitectura del Sistema

El proyecto sigue una arquitectura de tres capas:

1. **Capa de Datos**: PostGIS (PostgreSQL con extensiones espaciales) en Docker
2. **Capa de Servicios**: GeoServer (servidor de mapas OGC) en Docker
3. **Capa de Presentación**: Aplicación React con OpenLayers (cliente web)

---

## Tecnologías Utilizadas

### Frontend
- **React 19.2.0**: Framework de JavaScript para la interfaz de usuario
- **OpenLayers 10.7.0**: Biblioteca para visualización de mapas interactivos
- **CSS3**: Estilos personalizados para componentes
- **localStorage**: Persistencia de capas de usuario en el navegador

### Backend/Servicios
- **GeoServer 2.24.x**: Servidor de mapas que publica datos geoespaciales mediante estándares OGC (WMS, WFS)
- **PostGIS 17**: Extensión espacial de PostgreSQL para almacenamiento de datos geoespaciales
- **Docker & Docker Compose**: Contenedorización de servicios

### Herramientas de Desarrollo
- **Node.js & npm**: Gestión de dependencias y ejecución
- **Python 3**: Script de importación de datos (`import.py`)
- **psql, pg_restore, ogr2ogr**: Herramientas de PostgreSQL/PostGIS para importación

### Estándares OGC Implementados
- **WMS (Web Map Service)**: Para visualización de mapas como imágenes
- **WFS (Web Feature Service)**: Para consulta y edición de features geoespaciales

---

## Funcionalidades Implementadas y Consignas Cumplidas

### 1. Visualización de Capas Geoespaciales ✅

**Implementación:**
- Sistema de gestión de capas (`LayerManager.jsx`) que carga capas desde GeoServer mediante WMS
- Panel de capas (`LayerPanel.jsx`) con agrupación por categorías (Hidrografía, Topografía, Actividades, etc.)
- Soporte para más de 50 capas predefinidas organizadas en 11 grupos temáticos
- Sistema de búsqueda y filtrado de capas
- Control de visibilidad individual por capa

**Archivos clave:**
- `src/components/LayerManager.jsx`: Gestión de capas WMS
- `src/components/layout/LayerPanel.jsx`: Interfaz de usuario para capas
- `src/layers.js`: Configuración de todas las capas disponibles

### 2. Consulta Espacial (Query Tool) ✅

**Implementación:**
- Herramienta de consulta que permite buscar features en capas visibles
- **Consulta por punto**: Click izquierdo para encontrar el objeto más cercano
- **Consulta por rectángulo**: Click derecho + arrastrar para consultar área
- Visualización de resultados con resaltado en el mapa
- Panel de resultados con detalles de atributos
- Soporte para consultas en capas de GeoServer (WFS) y capas de usuario (memoria)

**Funcionalidades avanzadas:**
- Cálculo de distancia para consultas por punto
- Filtrado de features que realmente intersectan con el área seleccionada
- Resumen por capa con conteo de elementos encontrados
- Eliminación de features desde el panel de resultados (solo capas de usuario)

**Archivos clave:**
- `src/components/herramientas/QueryTool.jsx`: Implementación completa de consultas

### 3. Herramienta de Dibujo (Draw Tool) ✅

**Implementación:**
- Herramienta para dibujar geometrías (Punto, Línea, Polígono)
- Guardado en capas nuevas o existentes
- Soporte para capas de usuario (en memoria) y capas de GeoServer (WFS Transaction)
- Sistema de atributos personalizados para features
- Validación de tipos de geometría al seleccionar capa destino

**Funcionalidades:**
- Creación de nuevas capas de usuario con esquema de atributos definible
- Agregado de features a capas existentes (usuario o GeoServer)
- Formulario dinámico para definir atributos (texto, número, booleano, fecha)
- Persistencia de capas de usuario en localStorage

**Archivos clave:**
- `src/components/herramientas/DrawTool.jsx`: Implementación de dibujo y guardado

### 4. Gestión de Capas de Usuario ✅

**Implementación:**
- Sistema completo de capas de usuario almacenadas en memoria (localStorage)
- Creación, edición y eliminación de capas de usuario
- Exportación a GeoJSON
- Control de opacidad y estilos personalizados
- Gestión de orden de capas (z-index)

**Funcionalidades:**
- Persistencia automática en localStorage
- Estilos personalizables por tipo de geometría
- Exportación de capas a archivos GeoJSON
- Eliminación de features individuales desde consultas

**Archivos clave:**
- `src/components/LayerManager.jsx`: Métodos para gestión de capas de usuario (líneas 330-617)

### 5. Controles de Mapa ✅

**Implementación:**
- Controles de zoom personalizados
- Barra de escala
- Búsqueda de ubicaciones (SearchBar)
- Selector de tipo de mapa base (MapTypeControl)
- Leyenda de capas activas (ActiveLayersLegend)

**Archivos clave:**
- `src/components/mapa/ZoomControls.jsx`
- `src/components/mapa/ScaleBar.jsx`
- `src/components/layout/SearchBar.jsx`
- `src/components/herramientas/MapTypeControl.jsx`
- `src/components/layout/ActiveLayersLegend.jsx`

### 6. Integración con GeoServer y PostGIS ✅

**Implementación:**
- Configuración completa de Docker Compose con PostGIS y GeoServer
- Script de importación automática de datos (`import.py`)
- Detección automática de formato de archivo (dump binario, SQL, GeoPackage)
- Manejo inteligente de variantes de nombres de capas (GeoServer a veces agrega sufijos)
- Conexión WMS para visualización
- Conexión WFS para consultas y transacciones

**Archivos clave:**
- `docker/docker-compose.yml`: Configuración de servicios
- `import.py`: Script de importación de datos
- `src/config.js`: Configuración de URLs de GeoServer

### 7. Interfaz de Usuario Moderna ✅

**Implementación:**
- Diseño responsive con panel lateral colapsable
- Búsqueda de capas en tiempo real
- Agrupación expandible/colapsable por categorías
- Indicadores visuales (emojis) por grupo de capas
- Feedback visual durante operaciones (loading, resultados)
- Diálogos modales para operaciones complejas

**Archivos clave:**
- `src/components/layout/LayerPanel.jsx`: Panel principal de capas
- Múltiples archivos CSS para estilos

---

## Estructura del Código

```
gis_TPI/
├── src/
│   ├── components/
│   │   ├── herramientas/        # Herramientas de mapa (Query, Draw, etc.)
│   │   ├── layout/              # Componentes de UI (Panel, SearchBar, etc.)
│   │   └── mapa/                # Componentes del mapa (MapContainer, Zoom, etc.)
│   ├── config.js                # Configuración de URLs de GeoServer
│   ├── layers.js                # Configuración de todas las capas
│   └── App.js                   # Componente principal
├── docker/
│   └── docker-compose.yml       # Configuración de servicios Docker
├── import.py                    # Script de importación de datos
└── package.json                 # Dependencias del proyecto
```

---

## Flujo de Datos

1. **Carga de Capas:**
   - React → LayerManager → GeoServer (WMS) → PostGIS → Datos

2. **Consulta Espacial:**
   - Usuario → QueryTool → GeoServer (WFS) → PostGIS → Resultados → Visualización

3. **Dibujo y Guardado:**
   - Usuario → DrawTool → (Capa Usuario: localStorage) o (GeoServer: WFS Transaction → PostGIS)

4. **Persistencia:**
   - Capas de usuario: localStorage del navegador
   - Capas de GeoServer: Base de datos PostGIS

---

## Características Técnicas Destacadas

### 1. Manejo Inteligente de Variantes de Nombres
El sistema detecta automáticamente variantes de nombres de capas (GeoServer a veces agrega "0", "1", etc. o codifica caracteres especiales) y prueba múltiples variantes hasta encontrar la correcta.

### 2. Sistema de Capas Híbrido
Soporta tanto capas servidas por GeoServer (WMS/WFS) como capas de usuario almacenadas en memoria (localStorage), con una interfaz unificada.

### 3. Consultas Optimizadas
- Consultas por punto calculan distancia y encuentran el objeto más cercano
- Consultas por rectángulo filtran features que realmente intersectan
- Soporte para consultas en múltiples capas simultáneamente

### 4. Gestión de Atributos Dinámicos
Sistema flexible para definir esquemas de atributos personalizados al crear capas de usuario, con soporte para múltiples tipos de datos.

### 5. Persistencia y Exportación
- Capas de usuario se guardan automáticamente en localStorage
- Exportación a GeoJSON para compartir datos
- Carga automática de capas guardadas al iniciar la aplicación

---

## Configuración y Despliegue

### Requisitos
- Node.js 14+
- Docker y Docker Compose
- Python 3 (para script de importación)
- Herramientas PostgreSQL (psql, pg_restore) o QGIS (incluye ogr2ogr)

### Proceso de Setup
1. Instalar dependencias: `npm install`
2. Levantar servicios: `docker-compose -f docker/docker-compose.yml up -d`
3. Importar datos: `python import.py`
4. Configurar GeoServer (crear workspace y publicar capas)
5. Ejecutar aplicación: `npm start`

---

## Conclusiones

El proyecto implementa un **SIG web completo y funcional** que cumple con los estándares OGC y proporciona una experiencia de usuario moderna. Las principales fortalezas son:

1. ✅ **Arquitectura bien estructurada** con separación de responsabilidades
2. ✅ **Integración completa** con PostGIS y GeoServer
3. ✅ **Funcionalidades avanzadas** de consulta y edición espacial
4. ✅ **Sistema híbrido** de capas (servidor + usuario)
5. ✅ **Interfaz intuitiva** con controles modernos
6. ✅ **Documentación completa** en README y tutoriales
7. ✅ **Manejo robusto de errores** y variantes de nombres
8. ✅ **Persistencia local** para capas de usuario

El código demuestra un buen entendimiento de:
- Estándares OGC (WMS, WFS)
- Arquitectura de aplicaciones web modernas
- Gestión de datos geoespaciales
- Docker y contenedorización
- React y gestión de estado

---

## Notas Adicionales

- El proyecto incluye manejo automático de problemas comunes (variantes de nombres, caracteres especiales)
- La documentación es extensa y detallada (README.md, TUTORIAL_SETUP.md)
- El código está bien organizado y comentado
- Se implementan buenas prácticas de React (hooks, componentes funcionales)
- El sistema es extensible y fácil de mantener


