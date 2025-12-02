export const layersConfig = [
  // Hidrografía
  { id: "gisTPI:Curso_de_Agua_Hid", title: "Curso de Agua", group: "Hidrografía", emoji: "💧", geometryType: "LineString" },
  { id: "gisTPI:Espejo_de_Agua_Hid", title: "Espejos de Agua", group: "Hidrografía", emoji: "💧", geometryType: "Polygon" },
  { id: "gisTPI:Infraestructura_Hidro", title: "Infraestructura Hidro", group: "Hidrografía", emoji: "💧", geometryType: "Point" },
  { id: "gisTPI:Muro_Embalse", title: "Muro Embalse", group: "Hidrografía", emoji: "💧", geometryType: "LineString" },
  { id: "gisTPI:veg_Hidrofila", title: "Vegetación Hidrófila", group: "Hidrografía", emoji: "💧", geometryType: "Polygon" },
  { id: "gisTPI:Sue_Hidromorfologico", title: "Suelo Hidromorfológico", group: "Hidrografía", emoji: "💧", geometryType: "Polygon" },
  
  // Topografía
  { id: "gisTPI:Curvas_de_Nivel", title: "Curvas de Nivel", group: "Topografía", emoji: "⛰️", geometryType: "LineString" },
  { id: "gisTPI:Puntos_de_Alturas_Topograficas", title: "Puntos de Alturas Topográficas", group: "Topografía", emoji: "⛰️", geometryType: "Point" },
  { id: "gisTPI:Puntos_del_Terreno", title: "Puntos del Terreno", group: "Topografía", emoji: "⛰️", geometryType: "Point" },
  
  // Actividades
  { id: "gisTPI:Actividades_Agropecuarias", title: "Actividades Agropecuarias", group: "Actividades", emoji: "🌾", geometryType: "Point" },
  { id: "gisTPI:Actividades_Economicas", title: "Actividades Económicas", group: "Actividades", emoji: "🌾", geometryType: "Point" },
  { id: "gisTPI:Complejo_de_Energia_Ene", title: "Complejo de Energía", group: "Actividades", emoji: "🌾", geometryType: "Point" },
  { id: "gisTPI:Veg_Cultivos", title: "Vegetación Cultivos", group: "Actividades", emoji: "🌾", geometryType: "Polygon" },
  
  // Edificios Públicos
  { id: "gisTPI:Edificio_Publico_IPS", title: "Edificio Público", group: "Edificios Públicos", emoji: "🏛️", geometryType: "Point" },
  { id: "gisTPI:Edificio_de_Salud_IPS", title: "Edificio de Salud", group: "Edificios Públicos", emoji: "🏛️", geometryType: "Point" },
  { id: "gisTPI:Edificio_de_Seguridad_IPS", title: "Edificio de Seguridad", group: "Edificios Públicos", emoji: "🏛️", geometryType: "Point" },
  { id: "gisTPI:Otras_Edificaciones", title: "Otras Edificaciones", group: "Edificios Públicos", emoji: "🏛️", geometryType: "Point" },
  
  // Edificios Especiales
  { id: "gisTPI:Edif_Construcciones_Turisticas", title: "Construcciones Turísticas", group: "Edificios Especiales", emoji: "🏗️", geometryType: "Point" },
  { id: "gisTPI:Edif_Depor_y_Esparcimiento", title: "Deporte y Esparcimiento", group: "Edificios Especiales", emoji: "🏗️", geometryType: "Point" },
  { id: "gisTPI:Edif_Educacion", title: "Educación", group: "Edificios Especiales", emoji: "🏗️", geometryType: "Point" },
  { id: "gisTPI:Edif_Religiosos", title: "Edificios Religiosos", group: "Edificios Especiales", emoji: "🏗️", geometryType: "Point" },
  { id: "gisTPI:Edificios_Ferroviarios", title: "Edificios Ferroviarios", group: "Edificios Especiales", emoji: "🏗️", geometryType: "Point" },
  
  // Infraestructura
  { id: "gisTPI:Infraestructura_Aeroportuaria_Punto", title: "Infraestructura Aeroportuaria", group: "Infraestructura", emoji: "✈️", geometryType: "Point" },
  { id: "gisTPI:Estructuras_portuarias", title: "Estructuras Portuarias", group: "Infraestructura", emoji: "✈️", geometryType: "Point" },
  { id: "gisTPI:Obra_Portuaria", title: "Obra Portuaria", group: "Infraestructura", emoji: "✈️", geometryType: "Point" },
  { id: "gisTPI:Obra_de_Comunicación", title: "Obra de Comunicación", group: "Infraestructura", emoji: "✈️", geometryType: "Point" },
  // Nota: GeoServer puede tener esta capa como "Obra_de_Comunicaci_n" (sin acentos)
  // El código automáticamente intentará ambas variantes
  
  // Red Vial
  { id: "gisTPI:Red_Vial", title: "Red Vial", group: "Red Vial", emoji: "🛣️", geometryType: "LineString" },
  { id: "gisTPI:Vias_Secundarias", title: "Vías Secundarias", group: "Red Vial", emoji: "🛣️", geometryType: "LineString" },
  { id: "gisTPI:Puente_Red_Vial_Puntos", title: "Puentes Red Vial", group: "Red Vial", emoji: "🛣️", geometryType: "Point" },
  { id: "gisTPI:Salvado_de_Obstaculo", title: "Salvado de Obstáculo", group: "Red Vial", emoji: "🛣️", geometryType: "Point" },
  { id: "gisTPI:Marcas_y_Señales", title: "Marcas y Señales", group: "Red Vial", emoji: "🛣️", geometryType: "Point" },
  { id: "gisTPI:Señalizaciones", title: "Señalizaciones", group: "Red Vial", emoji: "🛣️", geometryType: "Point" },
  
  // Ferroviaria
  { id: "gisTPI:Red_ferroviaria", title: "Red Ferroviaria", group: "Ferroviaria", emoji: "🚂", geometryType: "LineString" },
  { id: "gisTPI:Líneas_de_Conducción_Ene", title: "Líneas de Conducción", group: "Ferroviaria", emoji: "🚂", geometryType: "LineString" },
  
  // Nota: GeoServer puede tener esta capa como "L_neas_de_Conducci_n_Ene" (sin acentos)
  // El código automáticamente intentará ambas variantes
  
  // Territorio
  { id: "gisTPI:Ejido", title: "Ejido", group: "Territorio", emoji: "🗺️", geometryType: "Polygon" },
  { id: "gisTPI:Isla", title: "Isla", group: "Territorio", emoji: "🗺️", geometryType: "Polygon" },
  { id: "gisTPI:Localidades", title: "Localidades", group: "Territorio", emoji: "🗺️", geometryType: "Point" },
  { id: "gisTPI:Limite_Politico_Administrativo_Lim", title: "Límite Político Administrativo", group: "Territorio", emoji: "🗺️", geometryType: "LineString" },
  { id: "gisTPI:Provincias", title: "Provincias", group: "Territorio", emoji: "🗺️", geometryType: "Polygon" },
  { id: "gisTPI:Pais_Lim", title: "País Límite", group: "Territorio", emoji: "🗺️", geometryType: "Polygon" },
  
  // Suelos
  { id: "gisTPI:Sue_Costero", title: "Suelo Costero", group: "Suelos", emoji: "🌍", geometryType: "Polygon" },
  { id: "gisTPI:Sue_No_Consolidado", title: "Suelo No Consolidado", group: "Suelos", emoji: "🌍", geometryType: "Polygon" },
  { id: "gisTPI:Sue_congelado", title: "Suelo Congelado", group: "Suelos", emoji: "🌍", geometryType: "Polygon" },
  { id: "gisTPI:Sue_consolidado", title: "Suelo Consolidado", group: "Suelos", emoji: "🌍", geometryType: "Polygon" },
    
  // Vegetación
  { id: "gisTPI:Veg_Suelo_Desnudo", title: "Vegetación Suelo Desnudo", group: "Vegetación", emoji: "🌍", geometryType: "Polygon" },
  { id: "gisTPI:Veg_Arborea", title: "Vegetación Arbórea", group: "Vegetación", emoji: "🌳", geometryType: "Polygon" },
  { id: "gisTPI:Veg_Arbustiva", title: "Vegetación Arbustiva", group: "Vegetación", emoji: "🌳", geometryType: "Polygon" },
];

// Configuración de grupos con emojis
export const groupConfig = {
  "Hidrografía": "💧",
  "Topografía": "⛰️",
  "Actividades": "🌾",
  "Edificios Públicos": "🏛️",
  "Edificios Especiales": "🏗️",
  "Infraestructura": "✈️",
  "Red Vial": "🛣️",
  "Ferroviaria": "🚂",
  "Territorio": "🗺️",
  "Suelos": "🌍",
  "Vegetación": "🌳",
  "Usuario": "👤",
};

// Obtener grupos únicos
export const layerGroups = [...new Set(layersConfig.map(layer => layer.group))];
