/* =========================================================================
   QuantEngine · kernel
   -------------------------------------------------------------------------
   Tipo Result, guardas, dinero en enteros y PRNG determinista.
   Sin dependencias. Sin Date.now(). Sin Math.random().
   Todo aquí es puro: misma entrada -> misma salida, siempre.
   ========================================================================= */

export const QE_VERSION = "2.0.0";

/* ---------------------------------------------------------------- Result --
   Una sola forma de retorno en todo el motor. Nada de mezclar null, NaN,
   {ok,error} y excepciones segun el modulo. Si algo no se puede calcular,
   se dice por que; nunca se devuelve un numero inventado. */

export function Ok(value, warnings) {
  return { ok: true, value, warnings: warnings && warnings.length ? warnings.slice() : [], error: null };
}
export function Err(code, message, detail) {
  return { ok: false, value: null, warnings: [], error: { code, message, detail: detail === undefined ? null : detail } };
}
export function isOk(r) { return !!r && r.ok === true; }
export function addWarn(r, code, message, detail) {
  if (r && r.ok) r.warnings.push({ code, message, detail: detail === undefined ? null : detail });
  return r;
}
export function unwrapOr(r, fallback) { return isOk(r) ? r.value : fallback; }
/* Propaga el primer Err de una lista; si todos son Ok devuelve sus valores. */
export function allOk(results) {
  const out = [], warns = [];
  for (const r of results) {
    if (!isOk(r)) return r;
    out.push(r.value);
    for (const w of r.warnings) warns.push(w);
  }
  return Ok(out, warns);
}

/* ---------------------------------------------------------------- guardas -- */

export function isFiniteNum(v) {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "boolean") return false;
  if (typeof v === "string" && v.trim() === "") return false;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n);
}
export function toNum(v) { return isFiniteNum(v) ? Number(v) : null; }
export function toInt(v) { const n = toNum(v); return n === null ? null : Math.trunc(n); }
export function toPosInt(v) { const n = toInt(v); return n !== null && n > 0 ? n : null; }
export function clamp(v, lo, hi) {
  const n = toNum(v); if (n === null) return null;
  const a = toNum(lo), b = toNum(hi);
  let x = n; if (a !== null && x < a) x = a; if (b !== null && x > b) x = b;
  return x === 0 ? 0 : x;
}
export function sym(v) { return String(v === null || v === undefined ? "" : v).trim().toUpperCase(); }

/* ------------------------------------------------------------ redondeo -----
   Math.round redondea -0.5 hacia 0 y +0.5 hacia arriba: asimetrico.
   Aqui siempre es "half away from zero" sobre el valor absoluto, con una
   correccion del error binario (1.005*100 = 100.49999999999999). */

export function roundHalfAway(x) {
  const n = toNum(x); if (n === null) return null;
  const a = Math.abs(n);
  const eps = a * Number.EPSILON * 4;
  const r = Math.round(a + eps);
  const out = n < 0 ? -r : r;
  return out === 0 ? 0 : out;
}
export function roundTo(x, decimals) {
  const n = toNum(x); if (n === null) return null;
  const d = toInt(decimals); const p = Math.pow(10, d === null ? 2 : d);
  const out = roundHalfAway(n * p) / p;
  return out === 0 ? 0 : out;
}

/* -------------------------------------------------------------- dinero -----
   El dinero vive en centavos enteros dentro del motor. Los dolares float solo
   existen en la frontera de entrada y de salida. Esto elimina de raiz la
   deriva de 0.01 al sumar cientos de operaciones. */

export const CENTS = 100;
export function toCents(dollars) {
  const n = toNum(dollars); if (n === null) return null;
  return roundHalfAway(n * CENTS);
}
export function fromCents(cents) {
  const n = toInt(cents); if (n === null) return null;
  const out = n / CENTS;
  return out === 0 ? 0 : out;
}
export function sumCents(list) {
  let s = 0;
  for (const c of list) { const n = toInt(c); if (n === null) return null; s += n; }
  return s;
}

/* ----------------------------------------------------------------- PRNG ----
   mulberry32: 32 bits de estado, rapido, buena distribucion para Monte Carlo
   de este tamano. Sembrado = reproducible. Dos corridas con la misma semilla
   dan exactamente el mismo resultado, que es lo que hace auditable una
   simulacion. */

export function rng(seed) {
  let a = (toInt(seed) === null ? 0x9E3779B9 : toInt(seed)) >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* Entero en [0, n) a partir de un generador uniforme. */
export function randInt(next, n) { return Math.floor(next() * n) % n; }

/* Normal estandar por Box-Muller. Solo para ruido parametrico; el Monte Carlo
   principal remuestrea la distribucion empirica, que no asume normalidad. */
export function randNormal(next) {
  let u = 0, v = 0;
  while (u === 0) u = next();
  while (v === 0) v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* --------------------------------------------------------- normal inversa --
   Acklam: error relativo < 1.15e-9. Se usa para intervalos de confianza
   con cualquier nivel, no solo 95%. */
const A = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
const B = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
const C = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
const D = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
export function normalQuantile(p) {
  const x = toNum(p); if (x === null || x <= 0 || x >= 1) return null;
  const pl = 0.02425;
  let q, r;
  if (x < pl) {
    q = Math.sqrt(-2 * Math.log(x));
    return (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
           ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  if (x > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - x));
    return -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
            ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  q = x - 0.5; r = q * q;
  return (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q /
         (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}
export function zFor(confidence) {
  const c = toNum(confidence); if (c === null || c <= 0 || c >= 1) return 1.959963984540054;
  return Math.abs(normalQuantile((1 - c) / 2));
}
