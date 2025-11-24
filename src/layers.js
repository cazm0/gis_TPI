export const layersConfig = [
  // Hidrografía
  { id: "gisTPI:Curso_de_Agua_Hid", title: "Curso de Agua", group: "Hidrografía", emoji: "💧" },
  { id: "gisTPI:Espejo_de_Agua_Hid", title: "Espejos de Agua", group: "Hidrografía", emoji: "💧" },
  
  // Topografía
  { id: "gisTPI:Curvas_de_Nivel", title: "Curvas de Nivel", group: "Topografía", emoji: "⛰️" },
  
  // Actividades
  { id: "gisTPI:Actividades_Agropecuarias", title: "Actividades Agropecuarias", group: "Actividades", emoji: "🌾" },
  { id: "gisTPI:Actividades_Economicas", title: "Actividades Económicas", group: "Actividades", emoji: "🌾" },
  { id: "gisTPI:Complejo_de_Energia_Ene", title: "Complejo de Energía", group: "Actividades", emoji: "🌾" },
  
  // Edificios Públicos
  { id: "gisTPI:Edificio_Publico_IPS", title: "Edificio Público", group: "Edificios Públicos", emoji: "🏛️" },
  { id: "gisTPI:Edificio_de_Salud_IPS", title: "Edificio de Salud", group: "Edificios Públicos", emoji: "🏛️" },
  { id: "gisTPI:Edificio_de_Seguridad_IPS", title: "Edificio de Seguridad", group: "Edificios Públicos", emoji: "🏛️" },
  
  // Edificios Especiales
  { id: "gisTPI:Edif_Construcciones_Turisticas", title: "Construcciones Turísticas", group: "Edificios Especiales", emoji: "🏗️" },
  { id: "gisTPI:Edif_Depor_y_Esparcimiento", title: "Deporte y Esparcimiento", group: "Edificios Especiales", emoji: "🏗️" },
  { id: "gisTPI:Edif_Educacion", title: "Educación", group: "Edificios Especiales", emoji: "🏗️" },
  { id: "gisTPI:Edif_Religiosos", title: "Edificios Religiosos", group: "Edificios Especiales", emoji: "🏗️" },
  { id: "gisTPI:Edificios_Ferroviarios", title: "Edificios Ferroviarios", group: "Edificios Especiales", emoji: "🏗️" },
  
  // Territorio
  { id: "gisTPI:Ejido", title: "Ejido", group: "Territorio", emoji: "🗺️" },
];

// Configuración de grupos con emojis
export const groupConfig = {
  "Hidrografía": "💧",
  "Topografía": "⛰️",
  "Actividades": "🌾",
  "Edificios Públicos": "🏛️",
  "Edificios Especiales": "🏗️",
  "Territorio": "🗺️",
};

// Obtener grupos únicos
export const layerGroups = [...new Set(layersConfig.map(layer => layer.group))];
