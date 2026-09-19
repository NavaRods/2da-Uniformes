// Helpers de formato compartidos por lib/ y las páginas, para no repetir
// la misma lógica de fecha/hora/moneda en cada archivo.

export function fechaHoraActual() {
  const ahora = new Date();
  return {
    fecha: ahora.toLocaleDateString("es-MX"),
    hora: ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function fechaLocalISO(fecha = new Date()) {
  // Fecha del reloj local. toISOString usaría UTC y de noche daría el día siguiente.
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function horaLocalHHMM(fecha = new Date()) {
  return fecha.toTimeString().slice(0, 5);
}

export function formatoMoneda(monto) {
  const numero = Number(monto) || 0;
  return `$${numero.toLocaleString("es-MX")}`;
}
