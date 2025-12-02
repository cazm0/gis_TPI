import React from "react";
import "./Modal.css";

export default function Modal({ isOpen, onClose, title, message, type = "info", showConfirm = false, onConfirm, confirmText = "Aceptar", cancelText = "Cancelar" }) {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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

