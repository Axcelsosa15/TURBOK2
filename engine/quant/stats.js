/* =========================================================================
   QuantEngine · estadistica e inferencia
   -------------------------------------------------------------------------
   Regla de la casa: ningun estadistico se devuelve desnudo. Cada numero viaja
   con su n, su error estandar y un veredicto de fiabilidad. Un profit factor
   de 2.4 sobre 6 operaciones y uno sobre 600 se imprimen igual y no significan
   lo mismo; el motor esta obligado a decir cual es cual.
   ========================================================================= */

import { Ok, Err, toNum, toPosInt, roundTo, rng, randInt, zFor } from "./kernel.js";

export function limpiar(xs) {
  const out = [];
  for (const x of xs || []) { const n = toNum(x); if (n !== null) out.push(n); }
  return out;
}

/* Welford: una pasada, numericamente estable incluso con miles de valores
   de magnitudes muy distintas. La formula ingenua (sum(x^2) - n*media^2)
   pierde precision justo donde importa. */
export function momentos(xs) {
  const v = limpiar(xs);
  const n = v.length;
  if (!n) return { n: 0, media: null, varianza: null, desv: null, suma: 0, min: null, max: null };
  let media = 0, m2 = 0, suma = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = v[i]; suma += x;
    if (x < min) min = x; if (x > max) max = x;
    const d = x - media; media += d / (i + 1); m2 += d * (x - media);
  }
  const varianza = n > 1 ? m2 / (n - 1) : 0;
  return { n, media, varianza, desv: Math.sqrt(varianza), suma, min, max };
}

/* Cuantil tipo 7 (el de R y numpy por defecto), interpolacion lineal. */
export function cuantil(xs, p) {
  const v = limpiar(xs).sort((a, b) => a - b);
  const n = v.length; if (!n) return null;
  const q = toNum(p); if (q === null || q < 0 || q > 1) return null;
  if (n === 1) return v[0];
  const h = (n - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return v[lo] + (h - lo) * (v[hi] - v[lo]);
}
export const mediana = xs => cuantil(xs, 0.5);

export function forma(xs) {
  const v = limpiar(xs), n = v.length;
  if (n < 3) return { asimetria: null, curtosis: null };
  const m = v.reduce((s, x) => s + x, 0) / n;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const x of v) { const d = x - m, d2 = d * d; m2 += d2; m3 += d2 * d; m4 += d2 * d2; }
  m2 /= n; m3 /= n; m4 /= n;
  if (m2 === 0) return { asimetria: 0, curtosis: 0 };
  const g1 = m3 / Math.pow(m2, 1.5);
  const G1 = n > 2 ? g1 * Math.sqrt(n * (n - 1)) / (n - 2) : g1;
  return { asimetria: roundTo(G1, 4), curtosis: roundTo(m4 / (m2 * m2) - 3, 4) };
}

/* ------------------------------------------------------- proporciones -----
   Wilson, no la aproximacion normal. Con n pequena o tasas cerca de 0 o 1
   la normal produce intervalos que se salen de [0,1]: literalmente imposibles. */
export function ciProporcion(exitos, total, confianza) {
  const k = toNum(exitos), n = toNum(total);
  if (k === null || n === null || n <= 0 || k < 0 || k > n) return null;
  const z = zFor(confianza === undefined ? 0.95 : confianza);
  const p = k / n, z2 = z * z;
  const den = 1 + z2 / n;
  const centro = (p + z2 / (2 * n)) / den;
  const semi = (z / den) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
  return { p: roundTo(p, 6), bajo: roundTo(Math.max(0, centro - semi), 6), alto: roundTo(Math.min(1, centro + semi), 6), n };
}

/* --------------------------------------------------------- media + CI ----- */
export function ciMedia(xs, confianza) {
  const m = momentos(xs);
  if (m.n < 2) return { n: m.n, media: m.media, se: null, bajo: null, alto: null };
  const z = zFor(confianza === undefined ? 0.95 : confianza);
  const se = m.desv / Math.sqrt(m.n);
  return { n: m.n, media: roundTo(m.media, 6), se: roundTo(se, 6),
           bajo: roundTo(m.media - z * se, 6), alto: roundTo(m.media + z * se, 6) };
}

/* Bootstrap por percentiles. La distribucion de R multiples es asimetrica y
   de colas pesadas: el intervalo normal miente sistematicamente. Remuestrear
   no asume forma alguna. Sembrado => reproducible y auditable. */
export function bootstrapCI(xs, estadistico, opciones) {
  const v = limpiar(xs), n = v.length;
  const cfg = Object.assign({ repeticiones: 2000, confianza: 0.95, semilla: 20260917 }, opciones || {});
  if (n < 5) return null;
  const f = typeof estadistico === "function" ? estadistico : null;
  const next = rng(cfg.semilla);
  const reps = toPosInt(cfg.repeticiones) ?? 2000;
  const muestras = new Array(reps);
  /* El coste del bootstrap es reps x n. La version anterior llamaba a
     momentos(buf) en cada repeticion, y momentos hace limpiar(), que ASIGNA UN
     ARRAY NUEVO: 2.000 arrays de n elementos por llamada. Con n=1500 eso son
     3 millones de elementos copiados para calcular 2.000 medias.
     Cuando el estadistico es la media (el caso por defecto) se acumula en linea,
     sin buffer y sin asignar nada. Misma secuencia del PRNG, mismo resultado
     bit a bit: esto no cambia ni un decimal, solo deja de tirar memoria. */
  const buf = f ? new Array(n) : null;
  for (let b = 0; b < reps; b++) {
    if (f) {
      for (let i = 0; i < n; i++) buf[i] = v[randInt(next, n)];
      muestras[b] = f(buf);
    } else {
      let s = 0;
      for (let i = 0; i < n; i++) s += v[randInt(next, n)];
      muestras[b] = s / n;
    }
  }
  const alfa = (1 - cfg.confianza) / 2;
  return {
    n, repeticiones: reps,
    punto: roundTo(f ? f(v) : momentos(v).media, 6),
    bajo: roundTo(cuantil(muestras, alfa), 6),
    alto: roundTo(cuantil(muestras, 1 - alfa), 6),
    metodo: "bootstrap percentil",
  };
}

/* ------------------------------------------------- tamano de muestra ------
   La pregunta que casi nadie se hace: cuantas operaciones hacen falta para
   que esta ventaja sea distinguible de la suerte. Se responde despejando n
   de |media| >= (z_alfa + z_beta) * desv / sqrt(n). */
export function muestraMinima(xs, opciones) {
  const cfg = Object.assign({ confianza: 0.95, potencia: 0.80 }, opciones || {});
  const m = momentos(xs);
  if (m.n < 2 || m.desv === 0) return null;
  if (m.media === 0) return { n: m.n, requerido: Infinity, razon: "la media medida es exactamente cero" };
  const za = zFor(cfg.confianza);
  const zb = Math.abs(zFor(2 * cfg.potencia - 1));
  const requerido = Math.ceil(Math.pow((za + zb) * m.desv / Math.abs(m.media), 2));
  return {
    n: m.n, requerido,
    suficiente: m.n >= requerido,
    faltan: Math.max(0, requerido - m.n),
    ruidoRelativo: roundTo(m.desv / Math.abs(m.media), 3),
  };
}

/* Significancia de que la media sea distinta de cero (aprox. normal; con
   n>=30 es adecuada y por debajo de 30 el motor ya marca no fiable). */
export function significanciaMedia(xs) {
  const m = momentos(xs);
  if (m.n < 2 || m.desv === 0) return null;
  const t = m.media / (m.desv / Math.sqrt(m.n));
  const p = 2 * (1 - normalCDF(Math.abs(t)));
  return { t: roundTo(t, 4), p: roundTo(p, 6), significativo: p < 0.05, n: m.n };
}

export function normalCDF(x) {
  /* Abramowitz-Stegun 7.1.26 sobre erf; error < 1.5e-7. */
  const s = x < 0 ? -1 : 1, z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + s * y);
}

/* --------------------------------------------------------- fiabilidad -----
   Un solo lugar decide si un numero se puede usar para tomar decisiones.
   Los umbrales son convencion, pero al menos son explicitos y unicos. */
export const UMBRALES = Object.freeze({ tendencia: 20, fiable: 30, solido: 100, diarioFiable: 60 });

export function veredicto(n, umbral) {
  const k = toPosInt(n) ?? 0;
  const u = toPosInt(umbral) ?? UMBRALES.fiable;
  if (k === 0) return { nivel: "sin_datos", fiable: false, razon: "no hay operaciones cerradas" };
  if (k < UMBRALES.tendencia) return { nivel: "anecdota", fiable: false, razon: `n=${k}: por debajo de ${UMBRALES.tendencia} esto es ruido, no una medicion` };
  if (k < u) return { nivel: "indicio", fiable: false, razon: `n=${k}: hace falta n>=${u} para tratarlo como medicion` };
  if (k < UMBRALES.solido) return { nivel: "medicion", fiable: true, razon: `n=${k}: utilizable, todavia con error amplio` };
  return { nivel: "solido", fiable: true, razon: `n=${k}: muestra suficiente` };
}
