// Búsqueda tolerante para nombres: ignora mayúsculas, acentos y el orden de
// las palabras, y perdona errores de ortografía y de tecleo.

// Quita acentos y unifica letras que suenan igual en español
// (b/v, c/s/z, qu/k, h muda, ll/y) para que "Vazquez" encuentre "Básquez".
export function normalizar(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fonetica(palabra) {
  return palabra
    .replace(/h/g, "")
    .replace(/ll/g, "y")
    .replace(/qu/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/[zx]/g, "s")
    .replace(/v/g, "b")
    .replace(/w/g, "u")
    .replace(/(.)\1+/g, "$1");
}

// Distancia de Damerau-Levenshtein: ediciones y letras intercambiadas
// ("mraía" ~ "maría") cuentan como 1.
export function distancia(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return Math.max(m, n);
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function toleranciaPara(longitud) {
  if (longitud <= 2) return 0;
  if (longitud <= 5) return 1;
  return 2;
}

// Mejor puntaje (menor es mejor) de una palabra buscada contra las palabras
// del nombre, o null si no se parece a ninguna.
function puntajePalabra(buscada, palabrasNombre) {
  let mejor = null;
  const fb = fonetica(buscada);
  for (const palabra of palabrasNombre) {
    let p = null;
    if (palabra === buscada) p = 0;
    else if (palabra.startsWith(buscada)) p = 1;
    else if (buscada.length >= 3 && palabra.includes(buscada)) p = 2;
    else {
      const fp = fonetica(palabra);
      if (fp === fb) p = 2;
      else if (fp.startsWith(fb) && fb.length >= 3) p = 3;
      else {
        const tol = toleranciaPara(fb.length);
        // También se compara contra el inicio de la palabra, para que un
        // nombre a medio escribir con una falta ("mrai") siga funcionando.
        const d = Math.min(
          distancia(fb, fp),
          distancia(fb, fp.slice(0, fb.length))
        );
        if (tol > 0 && d <= tol) p = 3 + d;
      }
    }
    if (p !== null && (mejor === null || p < mejor)) mejor = p;
  }
  return mejor;
}

// Puntaje de un texto contra la búsqueda; null si no coincide. Todas las
// palabras buscadas deben aparecer, en cualquier orden.
export function puntaje(texto, busqueda) {
  const buscadas = normalizar(busqueda).split(" ").filter(Boolean);
  if (!buscadas.length) return 0;
  const palabras = normalizar(texto).split(" ").filter(Boolean);
  let total = 0;
  for (const buscada of buscadas) {
    const p = puntajePalabra(buscada, palabras);
    if (p === null) return null;
    total += p;
  }
  return total;
}

// Filtra y ordena por parecido (a igual parecido se conserva el orden original).
export function buscar(items, busqueda, obtenerTexto = (x) => x) {
  if (!normalizar(busqueda)) return items;
  return items
    .map((item, i) => ({ item, i, p: puntaje(obtenerTexto(item), busqueda) }))
    .filter((r) => r.p !== null)
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((r) => r.item);
}
