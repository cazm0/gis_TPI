import React, { useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "./PrintTool.css";

export default function PrintTool({ map, layerManager, activeTool }) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSettings, setPrintSettings] = useState({
    format: "A4",
    orientation: "landscape", // landscape o portrait
    includeLegend: true,
    includeScale: true,
    includeTitle: true,
    title: "Mapa GIS TPI",
  });


  const getMapImage = async () => {
    if (!map) {
      throw new Error("Mapa no disponible");
    }

    const mapViewport = map.getViewport();
    if (!mapViewport) {
      throw new Error("Viewport del mapa no disponible");
    }

    // Ocultar controles durante la captura
    const controlsToHide = mapViewport.parentElement.querySelectorAll(
      '.ol-control, .tool-buttons, .zoom-controls, .search-bar, .map-type-control'
    );
    const originalStyles = [];
    controlsToHide.forEach(control => {
      originalStyles.push({
        element: control,
        display: control.style.display
      });
      control.style.display = 'none';
    });

    try {
      // Esperar un momento para asegurar que el mapa esté completamente renderizado
      await new Promise(resolve => setTimeout(resolve, 500));

      // Forzar un render completo del mapa antes de capturar
      map.renderSync();

      // Capturar el mapa con html2canvas
      // Configuraciones optimizadas para reducir operaciones de lectura
      const canvas = await html2canvas(mapViewport, {
        scale: 2, // Alta resolución
        useCORS: true,
        logging: false,
        backgroundColor: "#e5e3df", // Color de fondo del mapa
        removeContainer: false,
        allowTaint: false,
        imageTimeout: 0,
        // Optimizaciones para reducir operaciones getImageData
        onclone: (clonedDoc) => {
          // Asegurar que los canvas en el documento clonado tengan willReadFrequently
          const canvases = clonedDoc.querySelectorAll('canvas');
          canvases.forEach(canvas => {
            try {
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                // El contexto ya está optimizado
              }
            } catch (e) {
              // Ignorar si no se puede configurar
            }
          });
        }
      });

      return canvas;
    } finally {
      // Restaurar controles
      originalStyles.forEach(({ element, display }) => {
        element.style.display = display;
      });
    }
  };

  const getLegendImage = async () => {
    if (!printSettings.includeLegend) {
      return null;
    }

    // Buscar la leyenda en el DOM
    const legendElement = document.querySelector(".active-layers-legend");
    if (!legendElement) {
      return null;
    }

    // Asegurar que la leyenda esté expandida
    const wasCollapsed = legendElement.classList.contains("collapsed");
    if (wasCollapsed) {
      legendElement.classList.remove("collapsed");
      legendElement.classList.add("expanded");
      // Esperar a que se expanda
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const canvas = await html2canvas(legendElement, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: false,
        onclone: (clonedDoc) => {
          const canvases = clonedDoc.querySelectorAll('canvas');
          canvases.forEach(canvas => {
            try {
              canvas.getContext('2d', { willReadFrequently: true });
            } catch (e) {
              // Ignorar errores
            }
          });
        }
      });
      return canvas;
    } catch (error) {
      console.error("Error capturando leyenda:", error);
      return null;
    } finally {
      // Restaurar estado original si estaba colapsada
      if (wasCollapsed) {
        legendElement.classList.remove("expanded");
        legendElement.classList.add("collapsed");
      }
    }
  };

  const getScaleBarImage = async () => {
    if (!printSettings.includeScale) {
      return null;
    }

    // Buscar la escala en el DOM
    const scaleElement = document.querySelector(".scale-bar");
    if (!scaleElement) {
      return null;
    }

    try {
      const canvas = await html2canvas(scaleElement, {
        backgroundColor: "transparent",
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: false,
        onclone: (clonedDoc) => {
          const canvases = clonedDoc.querySelectorAll('canvas');
          canvases.forEach(canvas => {
            try {
              canvas.getContext('2d', { willReadFrequently: true });
            } catch (e) {
              // Ignorar errores
            }
          });
        }
      });
      return canvas;
    } catch (error) {
      console.error("Error capturando escala:", error);
      return null;
    }
  };

  const generatePDF = async () => {
    if (!map) {
      alert("Mapa no disponible");
      return;
    }

    setIsPrinting(true);

    try {
      // Obtener imágenes
      const mapCanvas = await getMapImage();
      const legendCanvas = await getLegendImage();
      const scaleCanvas = await getScaleBarImage();

      // Configurar PDF según formato
      const formats = {
        A4: { width: 210, height: 297 },
        A3: { width: 297, height: 420 },
        Letter: { width: 216, height: 279 },
      };

      const format = formats[printSettings.format] || formats.A4;
      const isLandscape = printSettings.orientation === "landscape";
      
      const pdfWidth = isLandscape ? format.height : format.width;
      const pdfHeight = isLandscape ? format.width : format.height;

      const pdf = new jsPDF({
        orientation: printSettings.orientation,
        unit: "mm",
        format: printSettings.format,
      });

      // Calcular dimensiones del mapa en el PDF
      const margin = 15; // Margen en mm
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);

      // Si hay leyenda, reservar espacio
      const legendWidth = legendCanvas ? 60 : 0; // 60mm para la leyenda
      const mapWidth = availableWidth - (legendWidth > 0 ? legendWidth + 5 : 0);
      const mapHeight = availableHeight - (printSettings.includeTitle ? 15 : 0) - (scaleCanvas ? 10 : 0);

      // Calcular escala para ajustar el mapa
      const mapAspectRatio = mapCanvas.width / mapCanvas.height;
      const pdfAspectRatio = mapWidth / mapHeight;

      let finalMapWidth, finalMapHeight;
      if (mapAspectRatio > pdfAspectRatio) {
        // El mapa es más ancho
        finalMapWidth = mapWidth;
        finalMapHeight = mapWidth / mapAspectRatio;
      } else {
        // El mapa es más alto
        finalMapHeight = mapHeight;
        finalMapWidth = mapHeight * mapAspectRatio;
      }

      let yPos = margin;

      // Título
      if (printSettings.includeTitle) {
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text(printSettings.title, margin, yPos + 5);
        yPos += 12;
      }

      // Mapa
      const mapX = margin;
      const mapY = yPos;
      pdf.addImage(
        mapCanvas.toDataURL("image/png"),
        "PNG",
        mapX,
        mapY,
        finalMapWidth,
        finalMapHeight
      );

      // Escala (debajo del mapa)
      if (scaleCanvas) {
        const scaleX = mapX;
        const scaleY = mapY + finalMapHeight + 2;
        const scaleWidth = 30; // Ancho fijo para la escala
        const scaleHeight = (scaleCanvas.height / scaleCanvas.width) * scaleWidth;
        pdf.addImage(
          scaleCanvas.toDataURL("image/png"),
          "PNG",
          scaleX,
          scaleY,
          scaleWidth,
          scaleHeight
        );
      }

      // Leyenda (a la derecha del mapa)
      if (legendCanvas) {
        const legendX = mapX + finalMapWidth + 5;
        const legendY = yPos;
        const legendMaxWidth = legendWidth;
        const legendMaxHeight = availableHeight - yPos + margin;
        const legendAspectRatio = legendCanvas.width / legendCanvas.height;
        
        let legendPdfWidth, legendPdfHeight;
        if (legendAspectRatio > (legendMaxWidth / legendMaxHeight)) {
          legendPdfWidth = legendMaxWidth;
          legendPdfHeight = legendMaxWidth / legendAspectRatio;
        } else {
          legendPdfHeight = legendMaxHeight;
          legendPdfWidth = legendMaxHeight * legendAspectRatio;
        }

        pdf.addImage(
          legendCanvas.toDataURL("image/png"),
          "PNG",
          legendX,
          legendY,
          legendPdfWidth,
          legendPdfHeight
        );
      }

      // Información adicional (fecha, escala numérica, etc.)
      const infoY = pdfHeight - margin;
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      
      const view = map.getView();
      const resolution = view.getResolution();
      const zoom = view.getZoom();
      
      // Calcular escala numérica aproximada (1:XXXXX)
      // En EPSG:3857, 1 unidad ≈ 111320 metros en el ecuador
      const metersPerUnit = 111320;
      const scaleDenominator = Math.round(resolution * metersPerUnit);
      
      const infoText = `Escala aproximada: 1:${scaleDenominator.toLocaleString()} | Zoom: ${zoom.toFixed(1)} | Fecha: ${new Date().toLocaleDateString()}`;
      pdf.text(infoText, margin, infoY);

      // Guardar PDF
      pdf.save(`mapa_${new Date().toISOString().split('T')[0]}.pdf`);

      setIsPrinting(false);
      alert("Mapa exportado exitosamente como PDF");
    } catch (error) {
      console.error("Error generando PDF:", error);
      setIsPrinting(false);
      alert("Error al generar el PDF: " + error.message);
    }
  };

  if (activeTool !== "print") {
    return null;
  }

  return (
    <div className="print-tool">
      <div className="print-tool-panel">
        <h3>Configuración de Impresión</h3>
        
        <div className="print-setting">
          <label>Formato:</label>
          <select
            value={printSettings.format}
            onChange={(e) =>
              setPrintSettings({ ...printSettings, format: e.target.value })
            }
          >
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="Letter">Letter</option>
          </select>
        </div>

        <div className="print-setting">
          <label>Orientación:</label>
          <select
            value={printSettings.orientation}
            onChange={(e) =>
              setPrintSettings({ ...printSettings, orientation: e.target.value })
            }
          >
            <option value="landscape">Horizontal</option>
            <option value="portrait">Vertical</option>
          </select>
        </div>

        <div className="print-setting">
          <label>
            <input
              type="checkbox"
              checked={printSettings.includeTitle}
              onChange={(e) =>
                setPrintSettings({
                  ...printSettings,
                  includeTitle: e.target.checked,
                })
              }
            />
            Incluir título
          </label>
        </div>

        {printSettings.includeTitle && (
          <div className="print-setting">
            <label>Título del mapa:</label>
            <input
              type="text"
              value={printSettings.title}
              onChange={(e) =>
                setPrintSettings({ ...printSettings, title: e.target.value })
              }
              placeholder="Título del mapa"
            />
          </div>
        )}

        <div className="print-setting">
          <label>
            <input
              type="checkbox"
              checked={printSettings.includeLegend}
              onChange={(e) =>
                setPrintSettings({
                  ...printSettings,
                  includeLegend: e.target.checked,
                })
              }
            />
            Incluir leyenda
          </label>
        </div>

        <div className="print-setting">
          <label>
            <input
              type="checkbox"
              checked={printSettings.includeScale}
              onChange={(e) =>
                setPrintSettings({
                  ...printSettings,
                  includeScale: e.target.checked,
                })
              }
            />
            Incluir escala gráfica
          </label>
        </div>

        <button
          className="print-button"
          onClick={generatePDF}
          disabled={isPrinting}
        >
          {isPrinting ? "Generando PDF..." : "🖨️ Generar PDF"}
        </button>

        {isPrinting && (
          <div className="print-loading">
            <div className="print-spinner"></div>
            <p>Capturando mapa y generando PDF...</p>
          </div>
        )}
      </div>
    </div>
  );
}

