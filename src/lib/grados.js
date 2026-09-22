// Grados militares. Viven en Firestore (colección "grados") y un Admin los
// administra desde Configuración; mientras esa colección esté vacía se usan
// estos predeterminados. `rango` mayor = jerarquía más alta.
//
// Cada grado pertenece a una categoría del Estado de Fuerza. Reclutas, Tropas
// y Cadetes son categorías "individuales": el grado es la categoría misma.
export const GRADOS_PREDETERMINADOS = [
  { nombre: "Recluta", categoria: "Reclutas", rango: 1 },
  { nombre: "Tropa", categoria: "Tropas", rango: 2 },
  { nombre: "Cadete", categoria: "Cadetes", rango: 3 },
  { nombre: "Cabo", categoria: "Clases", rango: 4 },
  { nombre: "Sargento 2do", categoria: "Clases", rango: 5 },
  { nombre: "Sargento 1ero", categoria: "Clases", rango: 6 },
  { nombre: "Sub Teniente", categoria: "Oficiales", rango: 7 },
  { nombre: "Teniente", categoria: "Oficiales", rango: 8 },
  { nombre: "Capitán 2do", categoria: "Oficiales", rango: 9 },
  { nombre: "Capitán 1ero", categoria: "Oficiales", rango: 10 },
  { nombre: "Mayor", categoria: "Jefes", rango: 11 },
  { nombre: "Teniente Coronel", categoria: "Jefes", rango: 12 },
  { nombre: "Coronel", categoria: "Jefes", rango: 13 },
];

// Orden en que se muestra el Estado de Fuerza (de mayor a menor jerarquía).
export const CATEGORIAS = ["Jefes", "Oficiales", "Clases", "Cadetes", "Tropas", "Reclutas"];

// Grados de mayor a menor jerarquía.
export function ordenarGrados(grados) {
  return [...grados].sort(
    (a, b) => (b.rango ?? 0) - (a.rango ?? 0) || a.nombre.localeCompare(b.nombre, "es")
  );
}

export function categoriaDeGrado(grados, nombre) {
  return grados.find((g) => g.nombre === nombre)?.categoria || "";
}

// Comparador para ordenar listas de elementos: primero Varonil y luego
// Femenino, dentro de cada grupo por jerarquía (el más alto primero, sin
// grado al final) y por último por nombre.
export function comparadorPorJerarquia(grados) {
  const rango = (nombre) => grados.find((g) => g.nombre === nombre)?.rango ?? -1;
  const ordenGrupo = (grupo) => (grupo === "Femenino" ? 1 : 0);
  return (a, b) =>
    ordenGrupo(a.grupo) - ordenGrupo(b.grupo) ||
    rango(b.gradoMilitar) - rango(a.gradoMilitar) ||
    (a.nombre || "").localeCompare(b.nombre || "", "es");
}

function conteoVacio() {
  return { ...Object.fromEntries(CATEGORIAS.map((c) => [c, 0])), sinGrado: 0, total: 0 };
}

// Cuenta a los elementos por grupo (Varonil / Femenino) y categoría. Los que
// no tienen un grado válido se cuentan aparte en `sinGrado`, para que el
// total siempre coincida con la lista.
export function estadoDeFuerza(elementos, grados) {
  const resultado = { Varonil: conteoVacio(), Femenino: conteoVacio(), totalGeneral: 0 };
  for (const el of elementos) {
    const grupo = el.grupo === "Femenino" ? "Femenino" : "Varonil";
    const categoria = categoriaDeGrado(grados, el.gradoMilitar);
    if (categoria) resultado[grupo][categoria] += 1;
    else resultado[grupo].sinGrado += 1;
    resultado[grupo].total += 1;
    resultado.totalGeneral += 1;
  }
  return resultado;
}
