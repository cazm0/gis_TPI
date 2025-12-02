/**
 * Punto de entrada principal de la aplicación React
 * Este archivo inicializa la aplicación y renderiza el componente raíz App
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Obtener el elemento raíz del DOM donde se montará la aplicación React
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderizar la aplicación dentro de React.StrictMode
// StrictMode ayuda a detectar problemas potenciales durante el desarrollo
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Iniciar el reporte de métricas de rendimiento web
// Si quieres medir el rendimiento de la app, puedes pasar una función
// para registrar resultados (por ejemplo: reportWebVitals(console.log))
// o enviarlos a un endpoint de analytics. Más info: https://bit.ly/CRA-vitals
reportWebVitals();
