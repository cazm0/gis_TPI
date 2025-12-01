export const layersConfig = [
  // Hidrografía
  { id: "gisTPI:Curso_de_Agua_Hid", title: "Curso de Agua", group: "Hidrografía", emoji: "💧" },
  { id: "gisTPI:Espejo_de_Agua_Hid", title: "Espejos de Agua", group: "Hidrografía", emoji: "💧" },
  { id: "gisTPI:Infraestructura_Hidro", title: "Infraestructura Hidro", group: "Hidrografía", emoji: "💧" },
  { id: "gisTPI:Muro_Embalse", title: "Muro Embalse", group: "Hidrografía", emoji: "💧" },
  { id: "gisTPI:veg_Hidrofila", title: "Vegetación Hidrófila", group: "Hidrografía", emoji: "💧" },
  { id: "gisTPI:Sue_Hidromorfologico", title: "Suelo Hidromorfológico", group: "Hidrografía", emoji: "💧" },
  
  // Topografía
  { id: "gisTPI:Curvas_de_Nivel", title: "Curvas de Nivel", group: "Topografía", emoji: "⛰️" },
  { id: "gisTPI:Puntos_de_Alturas_Topograficas", title: "Puntos de Alturas Topográficas", group: "Topografía", emoji: "⛰️" },
  { id: "gisTPI:Puntos_del_Terreno", title: "Puntos del Terreno", group: "Topografía", emoji: "⛰️" },
  
  // Actividades
  { id: "gisTPI:Actividades_Agropecuarias", title: "Actividades Agropecuarias", group: "Actividades", emoji: "🌾" },
  { id: "gisTPI:Actividades_Economicas", title: "Actividades Económicas", group: "Actividades", emoji: "🌾" },
  { id: "gisTPI:Complejo_de_Energia_Ene", title: "Complejo de Energía", group: "Actividades", emoji: "🌾" },
  { id: "gisTPI:Veg_Cultivos", title: "Vegetación Cultivos", group: "Actividades", emoji: "🌾" },
  
  // Edificios Públicos
  { id: "gisTPI:Edificio_Publico_IPS", title: "Edificio Público", group: "Edificios Públicos", emoji: "🏛️" },
  { id: "gisTPI:Edificio_de_Salud_IPS", title: "Edificio de Salud", group: "Edificios Públicos", emoji: "🏛️" },
  { id: "gisTPI:Edificio_de_Seguridad_IPS", title: "Edificio de Seguridad", group: "Edificios Públicos", emoji: "🏛️" },
  { id: "gisTPI:Otras_Edificaciones", title: "Otras Edificaciones", group: "Edificios Públicos", emoji: "🏛️" },
  
  // Edificios Especiales
  { id: "gisTPI:Edif_Construcciones_Turisticas", title: "Construcciones Turísticas", group: "Edificios Especiales", emoji: "🏗️" },
  { id: "gisTPI:Edif_Depor_y_Esparcimiento", title: "Deporte y Esparcimiento", group: "Edificios Especiales", emoji: "🏗️" },
  { id: "gisTPI:Edif_Educacion", title: "Educación", group: "Edificios Especiales", emoji: "🏗️" },
  { id: "gisTPI:Edif_Religiosos", title: "Edificios Religiosos", group: "Edificios Especiales", emoji: "🏗️" },
  { id: "gisTPI:Edificios_Ferroviarios", title: "Edificios Ferroviarios", group: "Edificios Especiales", emoji: "🏗️" },
  
  // Infraestructura
  { id: "gisTPI:Infraestructura_Aeroportuaria_Punto", title: "Infraestructura Aeroportuaria", group: "Infraestructura", emoji: "✈️" },
  { id: "gisTPI:Estructuras_portuarias", title: "Estructuras Portuarias", group: "Infraestructura", emoji: "✈️" },
  { id: "gisTPI:Obra_Portuaria", title: "Obra Portuaria", group: "Infraestructura", emoji: "✈️" },
  { id: "gisTPI:Obra_de_Comunicación", title: "Obra de Comunicación", group: "Infraestructura", emoji: "✈️" },
  // Nota: GeoServer puede tener esta capa como "Obra_de_Comunicaci_n" (sin acentos)
  // El código automáticamente intentará ambas variantes
  
  // Red Vial
  { id: "gisTPI:Red_Vial", title: "Red Vial", group: "Red Vial", emoji: "🛣️" },
  { id: "gisTPI:Vias_Secundarias", title: "Vías Secundarias", group: "Red Vial", emoji: "🛣️" },
  { id: "gisTPI:Puente_Red_Vial_Puntos", title: "Puentes Red Vial", group: "Red Vial", emoji: "🛣️" },
  { id: "gisTPI:Salvado_de_Obstaculo", title: "Salvado de Obstáculo", group: "Red Vial", emoji: "🛣️" },
  { id: "gisTPI:Marcas_y_Señales", title: "Marcas y Señales", group: "Red Vial", emoji: "🛣️" },
  { id: "gisTPI:Señalizaciones", title: "Señalizaciones", group: "Red Vial", emoji: "🛣️" },
  
  // Ferroviaria
  { id: "gisTPI:Red_ferroviaria", title: "Red Ferroviaria", group: "Ferroviaria", emoji: "🚂" },
  { id: "gisTPI:Líneas_de_Conducción_Ene", title: "Líneas de Conducción", group: "Ferroviaria", emoji: "🚂" },
  
  // Nota: GeoServer puede tener esta capa como "L_neas_de_Conducci_n_Ene" (sin acentos)
  // El código automáticamente intentará ambas variantes
  
  // Territorio
  { id: "gisTPI:Ejido", title: "Ejido", group: "Territorio", emoji: "🗺️" },
  { id: "gisTPI:Isla", title: "Isla", group: "Territorio", emoji: "🗺️" },
  { id: "gisTPI:Localidades", title: "Localidades", group: "Territorio", emoji: "🗺️" },
  { id: "gisTPI:Limite_Politico_Administrativo_Lim", title: "Límite Político Administrativo", group: "Territorio", emoji: "🗺️" },
  { id: "gisTPI:Provincias", title: "Provincias", group: "Territorio", emoji: "🗺️" },
  { id: "gisTPI:Pais_Lim", title: "País Límite", group: "Territorio", emoji: "🗺️" },
  
  // Suelos
  { id: "gisTPI:Sue_Costero", title: "Suelo Costero", group: "Suelos", emoji: "🌍" },
  { id: "gisTPI:Sue_No_Consolidado", title: "Suelo No Consolidado", group: "Suelos", emoji: "🌍" },
  { id: "gisTPI:Sue_congelado", title: "Suelo Congelado", group: "Suelos", emoji: "🌍" },
  { id: "gisTPI:Sue_consolidado", title: "Suelo Consolidado", group: "Suelos", emoji: "🌍" },
  { id: "gisTPI:Veg_Suelo_Desnudo", title: "Vegetación Suelo Desnudo", group: "Suelos", emoji: "🌍" },
  
  // Vegetación
  { id: "gisTPI:Veg_Arborea", title: "Vegetación Arbórea", group: "Vegetación", emoji: "🌳" },
  { id: "gisTPI:Veg_Arbustiva", title: "Vegetación Arbustiva", group: "Vegetación", emoji: "🌳" },
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
