import { etiquetaMes } from "./cuotas";

// Lógica pura de la Relación de pagos (sin Firebase): convierte pagos de
// uniformes y de mensualidades en filas comparables y arma los totales.

// Los abonos nuevos traen copiados el artículo y el saldo tras el abono, así
// no hace falta leer el pedido. Los antiguos no (devuelve null).
export function pedidoDeAbono(abono) {
  if (abono.articulo === undefined) return null;
  return {
    articulo: abono.articulo,
    productoNombre: abono.productoNombre,
    talla: abono.talla,
    color: abono.color,
    saldoPendiente: abono.saldoTras ?? 1,
  };
}

export function filaDeAbono(abono, pedido, elementoNombre) {
  return {
    // El ID de un abono solo es único dentro de su pedido: la fila usa la ruta.
    id: `abono-${abono.elementoId}/${abono.pedidoId}/${abono.id}`,
    tipo: "uniforme",
    pedidoId: abono.pedidoId,
    elementoId: abono.elementoId,
    elementoNombre: elementoNombre || "?",
    concepto: pedido ? pedido.articulo : "?",
    productoNombre: pedido ? pedido.productoNombre || pedido.articulo : "?",
    talla: pedido?.talla || "",
    color: pedido?.color || "",
    monto: Number(abono.monto) || 0,
    etiqueta: pedido && pedido.saldoPendiente <= 0 ? "Liquidado" : "Abono",
    horaLocal: abono.horaLocal || "",
    quienRecibio: abono.quienRecibio || "",
  };
}

export function filaDeCuota(cuota, elementoNombre) {
  const meses = cuota.meses || [];
  return {
    id: `cuota-${cuota.elementoId}/${cuota.id}`,
    tipo: "mensualidad",
    elementoId: cuota.elementoId,
    elementoNombre: elementoNombre || "?",
    concepto: `Mensualidad — ${meses.map(etiquetaMes).join(", ")}`,
    meses,
    cantidadMeses: meses.length,
    monto: Number(cuota.total) || 0,
    etiqueta: "Mensualidad",
    horaLocal: cuota.horaLocal || "",
    quienRecibio: cuota.quienRecibio || "",
  };
}

// Más recientes primero dentro del mismo día.
export function ordenarPorHora(filas) {
  return [...filas].sort((a, b) => (a.horaLocal < b.horaLocal ? 1 : a.horaLocal > b.horaLocal ? -1 : 0));
}

export function resumenDia(filas) {
  const uniformes = filas.filter((f) => f.tipo === "uniforme");
  const mensualidades = filas.filter((f) => f.tipo === "mensualidad");
  const suma = (lista) => lista.reduce((s, f) => s + f.monto, 0);

  // Relación General: piezas por producto/talla/color. Una pieza es un pedido,
  // así que dos abonos al mismo pedido el mismo día cuentan una sola pieza,
  // aunque sí suman su dinero.
  const porPieza = {};
  for (const f of uniformes) {
    const clave = [f.productoNombre, f.talla, f.color].filter(Boolean).join(" — ");
    porPieza[clave] ??= {
      pieza: clave,
      productoNombre: f.productoNombre,
      talla: f.talla,
      color: f.color,
      pedidos: new Set(),
      total: 0,
    };
    porPieza[clave].pedidos.add(f.pedidoId ?? f.id);
    porPieza[clave].total += f.monto;
  }
  const general = Object.values(porPieza)
    .map(({ pedidos, ...resto }) => ({ ...resto, cantidad: pedidos.size }))
    .sort((a, b) => b.total - a.total);

  // Mensualidades: una entrada por elemento (si pagó varias veces el mismo
  // día se juntan), con sus meses en orden cronológico.
  const porElemento = {};
  for (const f of mensualidades) {
    porElemento[f.elementoId] ??= { nombre: f.elementoNombre, monto: 0, meses: new Set() };
    porElemento[f.elementoId].monto += f.monto;
    f.meses.forEach((m) => porElemento[f.elementoId].meses.add(m));
  }
  const detalleMensualidades = Object.values(porElemento)
    .map((e) => ({
      nombre: e.nombre,
      monto: e.monto,
      meses: [...e.meses].sort().map(etiquetaMes),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return {
    total: suma(filas),
    movimientos: filas.length,
    totalUniformes: suma(uniformes),
    totalMensualidades: suma(mensualidades),
    mesesCobrados: mensualidades.reduce((s, f) => s + f.cantidadMeses, 0),
    general,
    mensualidades: detalleMensualidades,
  };
}

// Suma o resta días a una fecha yyyy-mm-dd (en hora local, sin saltos por UTC).
export function moverDia(yyyyMmDd, dias) {
  const [a, m, d] = yyyyMmDd.split("-").map(Number);
  const fecha = new Date(a, m - 1, d + dias);
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

export function etiquetaDia(yyyyMmDd) {
  const [a, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// --- Pedidos: pendientes y relación por elemento ---
// Todo sale de los pedidos de la Unidad (ya en la caché del dispositivo): lo
// pagado de cada pedido es precio - saldo, sin leer sus abonos.

const milis = (t) => (typeof t?.toMillis === "function" ? t.toMillis() : 0);

export function filaDePedido(pedido) {
  const precio = Number(pedido.precioTotal) || 0;
  const saldoCrudo = Number(pedido.saldoPendiente) || 0;
  const liquidado = saldoCrudo <= 0;
  // Si el saldo se pasó de 0 (pago de más), lo abonado no supera el precio.
  const pagado = liquidado ? precio : Math.max(precio - saldoCrudo, 0);
  const entregado = !!pedido.entregado;
  return {
    id: `${pedido.elementoId}/${pedido.id}`,
    elementoId: pedido.elementoId,
    pedidoId: pedido.id,
    elementoNombre: pedido.elementoNombre || "",
    articulo: pedido.articulo || "?",
    productoNombre: pedido.productoNombre || pedido.articulo || "?",
    talla: pedido.talla || "",
    color: pedido.color || "",
    cantidad: Number(pedido.cantidad) || 1,
    precioTotal: precio,
    pagado,
    saldoPendiente: liquidado ? 0 : saldoCrudo,
    liquidado,
    entregado,
    fechaEntrega: pedido.fechaEntrega || null,
    quienEntrego: pedido.quienEntrego || "",
    cambioPendiente: !!pedido.cambioPendiente,
    motivoCambio: pedido.motivoCambio || "",
    creadoMs: milis(pedido.creadoEn),
    debeDinero: !liquidado,
    faltaEntregar: !entregado,
    pendiente: !liquidado || !entregado,
    unidad: pedido.unidad || "",
  };
}

// Identifica una variante (producto, talla y color): enlaza lo que se debe con
// lo que hay en "Uniforme recibido" (lib/inventario.js).
export const claveVariante = ({ productoNombre, talla, color }) =>
  `${productoNombre || ""}|${talla || ""}|${color || ""}`;

// Porcentaje del precio ya pagado (0 a 100).
export const porcentajePagado = (f) =>
  f.precioTotal > 0 ? Math.min(100, Math.round((f.pagado / f.precioTotal) * 100)) : 100;

// Uniformidad por entregar: las piezas que faltan por entregar, sumadas por
// producto, talla y color (sin datos de elementos). Sirve para saber qué hay
// que conseguir o entregar; la entrega se marca en cada pedido.
const porTalla = (a, b) =>
  (a.talla || "").localeCompare(b.talla || "", "es", { numeric: true }) ||
  (a.color || "").localeCompare(b.color || "", "es");

//
// Con `existencias` (Map claveVariante → piezas en "Uniforme recibido", ver
// lib/inventario.js) cada variante dice cuántas ya se recibieron
// (`recibido`, hasta lo que se debe) y cuántas faltan por recibir.
export function uniformidadPorEntregar(filas, existencias = new Map()) {
  const productos = new Map();
  for (const f of filas) {
    if (!f.faltaEntregar) continue;
    const nombre = f.productoNombre || f.articulo;
    if (!productos.has(nombre)) {
      productos.set(nombre, { producto: nombre, piezas: 0, pagadas: 0, conSaldo: 0, variantes: new Map() });
    }
    const prod = productos.get(nombre);
    const clave = `${f.talla}|${f.color}`;
    if (!prod.variantes.has(clave)) {
      prod.variantes.set(clave, { talla: f.talla, color: f.color, piezas: 0, pagadas: 0, conSaldo: 0 });
    }
    const variante = prod.variantes.get(clave);
    for (const grupo of [prod, variante]) {
      grupo.piezas += f.cantidad;
      if (f.liquidado) grupo.pagadas += f.cantidad;
      else grupo.conSaldo += f.cantidad;
    }
  }
  return [...productos.values()]
    .map((prod) => {
      const variantes = [...prod.variantes.values()].sort(porTalla).map((v) => {
        const enExistencia = existencias.get(claveVariante({ productoNombre: prod.producto, ...v })) || 0;
        const recibido = Math.min(enExistencia, v.piezas);
        return { ...v, recibido, faltaRecibir: v.piezas - recibido };
      });
      const recibido = variantes.reduce((s, v) => s + v.recibido, 0);
      return { ...prod, variantes, recibido, faltaRecibir: prod.piezas - recibido };
    })
    .sort((a, b) => a.producto.localeCompare(b.producto, "es"));
}

export function resumenUniformidad(productos) {
  const suma = (f) => productos.reduce((s, x) => s + f(x), 0);
  return {
    piezas: suma((p) => p.piezas),
    pagadas: suma((p) => p.pagadas),
    conSaldo: suma((p) => p.conSaldo),
    recibido: suma((p) => p.recibido || 0),
    faltaRecibir: suma((p) => p.faltaRecibir ?? p.piezas),
    productos: productos.length,
  };
}

// Estado de un elemento respecto a sus uniformes, del más urgente al menos.
export const ESTADOS_UNIFORME = {
  debe: "Debe",
  "sin-entregar": "Falta entregar",
  "al-corriente": "Al corriente",
  "sin-pedidos": "Sin uniformes",
};

function estadoDe(g) {
  if (g.porCobrar > 0) return "debe";
  if (g.sinEntregar > 0) return "sin-entregar";
  if (g.piezas > 0) return "al-corriente";
  return "sin-pedidos";
}

// Relación pagos ↔ pedidos por elemento: cada elemento con todos sus pedidos
// (pagado, saldo, entregado) y sus totales. Incluye a los elementos sin
// pedidos (aún no compran uniforme) y a los dados de baja solo si tienen
// pedidos. Un pedido cuyo elemento no está en la lista (p. ej. se cambió de
// Unidad) aparece igual, con el nombre que traiga. Orden alfabético.
export function relacionPorElemento(elementos, filas) {
  const grupos = new Map();
  const nuevo = (id, el) => ({
    elementoId: id,
    elementoNombre: el?.nombre || "",
    gradoMilitar: el?.gradoMilitar || "",
    baja: !!el?.fechaBaja,
    pedidos: [],
    piezas: 0,
    valorTotal: 0,
    pagado: 0,
    porCobrar: 0,
    sinEntregar: 0,
    cambios: 0,
  });
  for (const el of elementos) grupos.set(el.id, nuevo(el.id, el));
  for (const f of filas) {
    if (!grupos.has(f.elementoId)) grupos.set(f.elementoId, nuevo(f.elementoId, null));
    const g = grupos.get(f.elementoId);
    if (!g.elementoNombre && f.elementoNombre) g.elementoNombre = f.elementoNombre;
    g.pedidos.push(f);
    g.piezas += 1;
    g.valorTotal += f.precioTotal;
    g.pagado += f.pagado;
    g.porCobrar += f.saldoPendiente;
    if (f.faltaEntregar) g.sinEntregar += 1;
    if (f.cambioPendiente) g.cambios += 1;
  }
  return [...grupos.values()]
    .filter((g) => !(g.baja && g.piezas === 0))
    .map((g) => ({
      ...g,
      estado: estadoDe(g),
      pedidos: g.pedidos.sort((a, b) => b.creadoMs - a.creadoMs),
    }))
    .sort((a, b) => (a.elementoNombre || "").localeCompare(b.elementoNombre || "", "es"));
}

export function resumenRelacion(grupos) {
  const cuenta = (estado) => grupos.filter((g) => g.estado === estado).length;
  const suma = (f) => grupos.reduce((s, g) => s + f(g), 0);
  return {
    elementos: grupos.length,
    deben: cuenta("debe"),
    faltaEntregar: grupos.filter((g) => g.sinEntregar > 0).length,
    alCorriente: cuenta("al-corriente"),
    sinPedidos: cuenta("sin-pedidos"),
    porCobrar: suma((g) => g.porCobrar),
    pagado: suma((g) => g.pagado),
    valorTotal: suma((g) => g.valorTotal),
    piezasSinEntregar: suma((g) => g.sinEntregar),
  };
}
