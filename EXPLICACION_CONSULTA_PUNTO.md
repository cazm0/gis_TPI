# Explicación: Método de Selección para Consulta por Punto

## Resumen del Flujo

Cuando el usuario hace **click izquierdo** en el mapa con la herramienta de consulta activa, el sistema busca el objeto más cercano en todas las capas visibles dentro de un radio de búsqueda dinámico.

---

## Paso 1: Detección del Click

### Event Listener
```601:606:src/components/herramientas/QueryTool.jsx
    // Manejar click izquierdo para consulta por punto
    const handleLeftClick = (event) => {
      if (isDrawingRef.current) return; // No hacer consulta si se está dibujando rectángulo
      const coordinate = event.coordinate;
      queryByPoint(coordinate);
    };
```

**¿Qué sucede?**
- Se registra un listener para el evento `singleclick` del mapa
- Cuando el usuario hace click, se captura la **coordenada del click** en el sistema de coordenadas del mapa (EPSG:3857)
- Se verifica que no se esté dibujando un rectángulo (click derecho)
- Se llama a la función `queryByPoint()` con la coordenada

---

## Paso 2: Preparación de la Consulta

### Validación y Configuración Inicial
```168:195:src/components/herramientas/QueryTool.jsx
  const queryByPoint = useCallback(async (coordinate) => {
    const visibleLayers = layerManager.getVisibleLayers();
    
    if (visibleLayers.length === 0) {
      setQueryResults({
        message: "No hay capas visibles para consultar",
        features: [],
      });
      return;
    }

    setIsLoading(true);
    setQueryResults(null);
    setSelectedFeature(null);

    // Convertir coordenada a EPSG:4326
    const lonLat = toLonLat(coordinate, "EPSG:3857");
    
    // Calcular el radio de búsqueda basado en la resolución actual del mapa
    // Esto asegura que busquemos en un área razonable alrededor del punto
    const view = map.getView();
    const resolution = view.getResolution();
    const searchRadiusPixels = 50; // 50 píxeles de radio de búsqueda
    const searchRadiusMeters = resolution * searchRadiusPixels;
    
    // Convertir metros a grados (aproximación: 1 grado ≈ 111km)
    const searchRadiusDegrees = searchRadiusMeters / 111000;
```

**¿Qué sucede?**
1. **Obtiene capas visibles**: Revisa qué capas están activas en el mapa
2. **Valida**: Si no hay capas visibles, muestra mensaje y termina
3. **Convierte coordenadas**: Transforma de EPSG:3857 (Web Mercator) a EPSG:4326 (lat/lon)
4. **Calcula radio de búsqueda dinámico**:
   - Obtiene la resolución actual del mapa (metros por píxel)
   - Define un radio de **50 píxeles**
   - Convierte a metros: `searchRadiusMeters = resolution * 50`
   - Convierte a grados: `searchRadiusDegrees = searchRadiusMeters / 111000`

**Ejemplo:**
- Si el zoom está en nivel 10, la resolución puede ser ~150 metros/píxel
- Radio = 150 m/píxel × 50 píxeles = **7,500 metros** (7.5 km)
- En grados: 7,500 m / 111,000 m/grado ≈ **0.067 grados**

---

## Paso 3: Separación de Capas

### Clasificación por Tipo
```196:206:src/components/herramientas/QueryTool.jsx
    // Separar capas de usuario de capas de GeoServer
    const userLayerIds = [];
    const geoserverLayers = [];
    
    visibleLayers.forEach(layerName => {
      if (layerName.startsWith('user:')) {
        userLayerIds.push(layerName);
      } else {
        geoserverLayers.push(layerName);
      }
    });
```

**¿Qué sucede?**
- Separa las capas en dos grupos:
  - **Capa de usuario**: Almacenadas en memoria (localStorage), identificadas por prefijo `user:`
  - **Capa de GeoServer**: Servidas por GeoServer mediante WFS

**Razón**: Cada tipo requiere un método de consulta diferente.

---

## Paso 4: Consulta en Capas de Usuario (Memoria)

### Búsqueda Local
```213:255:src/components/herramientas/QueryTool.jsx
      // Consultar capas de usuario (en memoria)
      userLayerIds.forEach(layerId => {
        const foundFeatures = queryUserLayer(layerId, coordinate, null, true);
        if (foundFeatures.length > 0) {
          // Encontrar la feature más cercana
          let closestFeature = null;
          let minDistance = Infinity;

          foundFeatures.forEach((feature) => {
            const geometry = feature.getGeometry();
            const closestPoint = geometry.getClosestPoint(coordinate);
            const dx = coordinate[0] - closestPoint[0];
            const dy = coordinate[1] - closestPoint[1];
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
              minDistance = distance;
              closestFeature = feature;
            }
          });

          if (closestFeature) {
            const displayName = getLayerDisplayName(layerId);
            const latRad = (lonLat[1] * Math.PI) / 180;
            const metersPerUnit = Math.cos(latRad) * 111320;
            const distanceInMeters = minDistance * metersPerUnit;
            
            allFeatures.push({
              feature: closestFeature,
              layerName: layerId,
              layerDisplayName: displayName,
              distance: distanceInMeters / 1000,
              distancePixels: minDistance,
              properties: closestFeature.getProperties(),
            });
            layerResults[displayName] = 1;
          } else {
            layerResults[getLayerDisplayName(layerId)] = 0;
          }
        } else {
          layerResults[getLayerDisplayName(layerId)] = 0;
        }
      });
```

### Función Auxiliar `queryUserLayer`
```122:164:src/components/herramientas/QueryTool.jsx
  const queryUserLayer = (layerId, coordinate, extent, isPointQuery) => {
    const userLayers = layerManager.getUserLayers();
    const userLayer = userLayers[layerId];
    
    if (!userLayer || !userLayer.getVisible()) {
      return [];
    }

    const source = userLayer.getSource();
    const features = source.getFeatures();
    const foundFeatures = [];

    features.forEach((feature) => {
      const geometry = feature.getGeometry();
      if (!geometry) return;

      let isInRange = false;

      if (isPointQuery) {
        // Para consulta por punto: verificar si está dentro del radio
        const closestPoint = geometry.getClosestPoint(coordinate);
        const dx = coordinate[0] - closestPoint[0];
        const dy = coordinate[1] - closestPoint[1];
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Radio de búsqueda en coordenadas del mapa (aproximadamente 50 píxeles)
        const view = map.getView();
        const resolution = view.getResolution();
        const searchRadiusPixels = 50;
        const searchRadius = resolution * searchRadiusPixels;
        
        isInRange = distance <= searchRadius;
      } else {
        // Para consulta por rectángulo: verificar si intersecta
        isInRange = geometry.intersectsExtent(extent);
      }

      if (isInRange) {
        foundFeatures.push(feature);
      }
    });

    return foundFeatures;
  };
```

**¿Qué sucede?**
1. **Obtiene todas las features** de la capa de usuario desde memoria
2. **Para cada feature**:
   - Calcula el punto más cercano de la geometría al click
   - Calcula distancia euclidiana: `√(dx² + dy²)`
   - Compara con el radio de búsqueda (50 píxeles convertidos a unidades del mapa)
   - Si está dentro del radio, la agrega a candidatos
3. **Encuentra la más cercana**: De todas las features dentro del radio, selecciona la que tiene menor distancia
4. **Convierte distancia a kilómetros**: Usa corrección por latitud para convertir unidades del mapa a metros/kilómetros
5. **Agrega a resultados**: Guarda la feature más cercana con su información

---

## Paso 5: Consulta en Capas de GeoServer (WFS)

### Construcción del Bounding Box
```257:264:src/components/herramientas/QueryTool.jsx
      // Consultar capas de GeoServer con WFS
      if (geoserverLayers.length > 0) {
        const bbox = [
          lonLat[0] - searchRadiusDegrees,
          lonLat[1] - searchRadiusDegrees,
          lonLat[0] + searchRadiusDegrees,
          lonLat[1] + searchRadiusDegrees,
        ].join(",");
```

**¿Qué sucede?**
- Construye un **bounding box (bbox)** alrededor del punto clickeado
- El bbox es un rectángulo que abarca el radio de búsqueda
- Formato: `[minLon, minLat, maxLon, maxLat]`

**Ejemplo:**
- Click en: `lon=-60, lat=-32`
- Radio: `0.067 grados`
- Bbox: `[-60.067, -32.067, -59.933, -31.933]`

### Petición WFS GetFeature
```266:280:src/components/herramientas/QueryTool.jsx
        const queries = geoserverLayers.map(async (layerName) => {
        try {
          // Construir URL de WFS GetFeature con parámetros codificados
          const params = new URLSearchParams({
            service: 'WFS',
            version: '1.1.0',
            request: 'GetFeature',
            typeName: layerName,
            outputFormat: 'application/json',
            bbox: `${bbox},EPSG:4326`,
            // Sin límite de maxFeatures para obtener todos los elementos
          });
          
          const wfsUrl = `${URL_WFS}?${params.toString()}`;
          console.log('Consultando WFS:', wfsUrl);

          const response = await fetch(wfsUrl);
```

**¿Qué sucede?**
- Construye una **petición WFS GetFeature** para cada capa
- Parámetros:
  - `service: 'WFS'`: Servicio Web Feature Service
  - `version: '1.1.0'`: Versión del protocolo
  - `request: 'GetFeature'`: Tipo de operación
  - `typeName: layerName`: Nombre de la capa (ej: `gisTPI:Actividades_Agropecuarias`)
  - `outputFormat: 'application/json'`: Formato de respuesta (GeoJSON)
  - `bbox: ...`: Área de búsqueda
- Hace la petición HTTP con `fetch()`

**URL ejemplo:**
```
http://localhost:8081/geoserver/gisTPI/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=gisTPI:Actividades_Agropecuarias&outputFormat=application/json&bbox=-60.067,-32.067,-59.933,-31.933,EPSG:4326
```

### Procesamiento de Respuesta
```301:358:src/components/herramientas/QueryTool.jsx
          if (data.features && data.features.length > 0) {
            const format = new GeoJSON();
            let features;
            try {
              features = format.readFeatures(data, {
                featureProjection: "EPSG:3857",
                dataProjection: "EPSG:4326",
              });
              console.log('Features parseadas exitosamente:', features.length);
            } catch (parseError) {
              console.error('Error parseando features GeoJSON:', parseError);
              throw parseError;
            }

            // Calcular distancia euclidiana a cada feature y encontrar la más cercana
            let closestFeature = null;
            let minDistance = Infinity;

            features.forEach((feature) => {
              const geometry = feature.getGeometry();
              let distance = Infinity;

              if (geometry instanceof Point) {
                // Para puntos: distancia euclidiana en coordenadas del mapa
                const geomCoord = geometry.getCoordinates();
                const dx = coordinate[0] - geomCoord[0];
                const dy = coordinate[1] - geomCoord[1];
                distance = Math.sqrt(dx * dx + dy * dy);
              } else {
                // Para polígonos y líneas: distancia al punto más cercano en coordenadas del mapa
                const closestPoint = geometry.getClosestPoint(coordinate);
                const dx = coordinate[0] - closestPoint[0];
                const dy = coordinate[1] - closestPoint[1];
                distance = Math.sqrt(dx * dx + dy * dy);
              }

              if (distance < minDistance) {
                minDistance = distance;
                // Convertir distancia a metros para mostrar
                // En EPSG:3857, las coordenadas están en metros en el ecuador
                // Aproximamos multiplicando por el coseno de la latitud para mejor precisión
                const center = map.getView().getCenter();
                const centerLonLat = toLonLat(center, "EPSG:3857");
                const latRad = (centerLonLat[1] * Math.PI) / 180;
                const metersPerUnit = Math.cos(latRad) * 111320; // metros por unidad en esta latitud
                const distanceInMeters = distance * metersPerUnit;
                
                const displayName = getLayerDisplayName(layerName);
                closestFeature = { 
                  feature, 
                  layerName,
                  layerDisplayName: displayName,
                  distance: distanceInMeters / 1000, // En km para mostrar
                  distancePixels: distance, // Distancia en unidades del mapa (para comparación)
                  properties: feature.getProperties() 
                };
              }
            });
```

**¿Qué sucede?**
1. **Parsea GeoJSON**: Convierte la respuesta JSON a objetos OpenLayers
2. **Proyecta coordenadas**: De EPSG:4326 (WGS84) a EPSG:3857 (Web Mercator)
3. **Para cada feature recibida**:
   - **Si es un punto**: Calcula distancia directa al click
   - **Si es línea/polígono**: Encuentra el punto más cercano de la geometría al click
   - Calcula distancia euclidiana: `√(dx² + dy²)`
   - Compara con la distancia mínima encontrada hasta ahora
4. **Selecciona la más cercana**: Guarda la feature con menor distancia
5. **Convierte a kilómetros**: Aplica corrección por latitud

**Nota importante**: El bbox de WFS puede traer features que están cerca pero no son las más cercanas. Por eso se calcula la distancia exacta a cada una y se selecciona la mínima.

---

## Paso 6: Consolidación de Resultados

### Ordenamiento y Visualización
```375:396:src/components/herramientas/QueryTool.jsx
        await Promise.all(queries);
      }

      // Ordenar por distancia y tomar el más cercano de cada capa
      allFeatures.sort((a, b) => a.distance - b.distance);

      // Mostrar features en el mapa
      if (highlightLayerRef.current && allFeatures.length > 0) {
        const source = highlightLayerRef.current.getSource();
        source.clear();
        allFeatures.forEach(({ feature }) => {
          source.addFeature(feature);
        });
      }

      setQueryResults({
        message: allFeatures.length > 0
          ? `Se encontraron ${allFeatures.length} elemento(s) más cercano(s) en ${Object.keys(layerResults).filter(k => layerResults[k] === 1).length} capa(s)`
          : "No se encontraron elementos cerca del punto seleccionado",
        features: allFeatures,
        layerResults,
      });
```

**¿Qué sucede?**
1. **Espera todas las consultas**: `Promise.all()` espera que terminen todas las peticiones WFS
2. **Ordena por distancia**: Ordena todas las features encontradas de menor a mayor distancia
3. **Resalta en el mapa**: Agrega todas las features encontradas a una capa de resaltado (roja)
4. **Actualiza UI**: Muestra panel de resultados con:
   - Mensaje con cantidad de elementos encontrados
   - Lista de features con sus distancias
   - Resumen por capa

---

## Características Clave del Método

### 1. Radio de Búsqueda Dinámico
- **Adaptativo al zoom**: El radio se ajusta según el nivel de zoom
- **50 píxeles fijos**: Siempre busca en un área equivalente a 50 píxeles
- **Escala automática**: A mayor zoom, menor área física; a menor zoom, mayor área física

### 2. Búsqueda del Más Cercano
- **No solo intersección**: No busca solo features que contengan el punto
- **Distancia mínima**: Encuentra el objeto más cercano aunque esté fuera del punto exacto
- **Soporta todos los tipos**: Puntos, líneas y polígonos

### 3. Consulta Híbrida
- **Capa de usuario**: Búsqueda en memoria (rápida)
- **Capa de GeoServer**: Búsqueda mediante WFS (red)
- **Resultados unificados**: Combina resultados de ambos tipos

### 4. Cálculo de Distancia Preciso
- **Euclidiana en plano**: Calcula distancia en el sistema de coordenadas del mapa
- **Corrección por latitud**: Convierte a metros/kilómetros considerando la distorsión de Web Mercator
- **Visualización clara**: Muestra distancia en kilómetros para el usuario

---

## Diagrama de Flujo

```
Usuario hace click
    ↓
handleLeftClick() captura coordenada
    ↓
queryByPoint(coordinate)
    ↓
├─ Calcula radio de búsqueda (50 píxeles)
├─ Convierte coordenada a EPSG:4326
└─ Separa capas (usuario vs GeoServer)
    ↓
    ├─ Capas de Usuario ──────────────┐
    │   ↓                              │
    │   queryUserLayer()               │
    │   ↓                              │
    │   Filtra por radio               │
    │   ↓                              │
    │   Encuentra más cercana         │
    │   ↓                              │
    │   Calcula distancia             │
    │                                  │
    └─ Capas de GeoServer ─────────────┤
        ↓                              │
        Construye bbox                 │
        ↓                              │
        Petición WFS GetFeature        │
        ↓                              │
        Recibe GeoJSON                 │
        ↓                              │
        Parsea features                │
        ↓                              │
        Calcula distancia a cada una   │
        ↓                              │
        Encuentra más cercana          │
        ↓                              │
        Calcula distancia             │
        ↓                              │
    ┌──────────────────────────────────┘
    ↓
Consolida resultados
    ↓
Ordena por distancia
    ↓
Resalta en mapa
    ↓
Muestra panel de resultados
```

---

## Ejemplo Práctico

**Escenario:**
- Usuario hace click en coordenada `(-60.0, -32.0)` con zoom nivel 10
- Capas visibles: `Actividades_Agropecuarias` (GeoServer) y `Mi_Capa` (usuario)

**Proceso:**
1. Radio calculado: ~7.5 km (0.067 grados)
2. **Capa usuario**: Busca en memoria, encuentra 3 features dentro del radio, selecciona la más cercana a 2.3 km
3. **Capa GeoServer**: 
   - Envía WFS con bbox `[-60.067, -32.067, -59.933, -31.933]`
   - Recibe 15 features
   - Calcula distancia a cada una
   - Selecciona la más cercana a 1.8 km
4. **Resultado**: Muestra ambas features, ordenadas por distancia (1.8 km y 2.3 km)

---

## Ventajas del Método

✅ **Intuitivo**: Un solo click para consultar
✅ **Eficiente**: Radio dinámico evita consultas excesivamente amplias
✅ **Preciso**: Encuentra el objeto más cercano, no solo el que contiene el punto
✅ **Flexible**: Funciona con cualquier tipo de geometría
✅ **Rápido**: Consultas en paralelo para múltiples capas
✅ **Informativo**: Muestra distancia y detalles de cada resultado

