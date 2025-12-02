/**
 * Modal - Componente de modal/diálogo reutilizable
 * 
 * Muestra un diálogo modal con diferentes tipos (info, error, warning, success)
 * y opciones de confirmación/cancelación
 */

import React from "react";
import "./Modal.css";

/**
 * Componente Modal
 * @param {boolean} isOpen - Controla si el modal está visible
 * @param {function} onClose - Función callback cuando se cierra el modal
 * @param {string} title - Título del modal (opcional, se genera automáticamente según type)
 * @param {string} message - Mensaje a mostrar en el modal
 * @param {string} type - Tipo de modal: "info", "error", "warning", "success" (default: "info")
 * @param {boolean} showConfirm - Si true, muestra botones de confirmar/cancelar
 * @param {function} onConfirm - Función callback cuando se confirma
 * @param {string} confirmText - Texto del botón de confirmar (default: "Aceptar")
 * @param {string} cancelText - Texto del botón de cancelar (default: "Cancelar")
 */
export default function Modal({ isOpen, onClose, title, message, type = "info", showConfirm = false, onConfirm, confirmText = "Aceptar", cancelText = "Cancelar" }) {
  // Si el modal no está abierto, no renderizar nada
  if (!isOpen) return null;

  /**
   * Maneja el clic en el fondo del modal (backdrop)
   * Solo cierra si se hace clic directamente en el backdrop, no en el contenido
   */
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  /**
   * Maneja la confirmación del modal
   * Ejecuta el callback onConfirm si existe y luego cierra el modal
   */
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className={`modal-container modal-${type}`}>
        <div className="modal-header">
          <h3 className="modal-title">{title || getDefaultTitle(type)}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p className="modal-message">{message}</p>
        </div>
        <div className="modal-footer">
          {showConfirm ? (
            <>
              <button className="modal-button modal-button-cancel" onClick={onClose}>
                {cancelText}
              </button>
              <button className="modal-button modal-button-confirm" onClick={handleConfirm}>
                {confirmText}
              </button>
            </>
          ) : (
            <button className="modal-button modal-button-primary" onClick={onClose}>
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Obtiene el título por defecto según el tipo de modal
 * @param {string} type - Tipo de modal
 * @returns {string} Título por defecto
 */
function getDefaultTitle(type) {
  switch (type) {
    case "error":
      return "Error";
    case "warning":
      return "Advertencia";
    case "success":
      return "Éxito";
    default:
      return "Información";
  }
}

