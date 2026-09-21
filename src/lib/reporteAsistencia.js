import { ESTADOS, estaDeBaja, normalizarEstado } from "./asistencia";
import { comparadorPorJerarquia } from "./grados";

// Marcas del reporte: A (asistencia), F (falta), FJ (falta justificada), B (baja).
export const ABREVIATURA = Object.fromEntries(ESTADOS.map(([valor, , abr]) => [valor, abr]));
export const LEYENDA = ESTADOS.map(([, etiqueta, abr]) => `${abr} = ${etiqueta}`).join("   ");

// Cabeceras: Unidad, No. de orden, Grado, Nombre y un día por cada domingo.
export function cabecerasReporte(domingos) {
  return ["Unidad", "No. de orden", "Grado", "Nombre", ...domingos.map((d) => d.slice(8))];
}

// Filas del reporte de un mes: una por elemento, ordenadas por jerarquía. Las
// bajas de meses anteriores ya no forman parte de la lista. A partir de su
// fecha de baja, un elemento se marca con B.
// `asistencias` es { "2026-09-06": { elementoId: estado }, ... }
export function filasReporte({ elementos, asistencias, domingos, mes, grados }) {
  return elementos
    .filter((el) => !el.fechaBaja || el.fechaBaja >= `${mes}-01`)
    .slice()
    .sort(comparadorPorJerarquia(grados))
    .map((el) => ({
      unidad: el.unidad || "",
      numeroOrden: el.numeroOrden || "",
      grado: el.gradoMilitar || "",
      nombre: el.nombre,
      marcas: domingos.map((d) =>
        estaDeBaja(el, d) ? "B" : ABREVIATURA[normalizarEstado(asistencias[d]?.[el.id])] || ""
      ),
    }));
}

export function filaComoLista(fila) {
  return [fila.unidad, fila.numeroOrden, fila.grado, fila.nombre, ...fila.marcas];
}

// "2026-09" -> "septiembre de 2026"
export function etiquetaMesReporte(yyyyMm) {
  const [anio, mes] = yyyyMm.split("-").map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

// Genera y descarga el PDF de la lista. jsPDF se carga solo al pedir el PDF
// para no engordar la carga inicial de la app.
export async function descargarPdfAsistencia({ unidad, mes, domingos, filas }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const titulo = `Lista de asistencia — ${unidad}`;
  pdf.setFontSize(14);
  pdf.text(titulo, 40, 40);
  pdf.setFontSize(10);
  pdf.text(`Mes: ${etiquetaMesReporte(mes)}`, 40, 58);
  pdf.text(LEYENDA, 40, 72);

  autoTable(pdf, {
    startY: 84,
    head: [cabecerasReporte(domingos)],
    body: filas.map(filaComoLista),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59] },
    // Las columnas de domingos van centradas y angostas.
    columnStyles: Object.fromEntries(
      domingos.map((_, i) => [i + 4, { halign: "center", cellWidth: 34 }])
    ),
  });

  pdf.save(`asistencia-${unidad.replace(/\s+/g, "_")}-${mes}.pdf`);
}
