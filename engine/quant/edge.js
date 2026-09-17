/* =========================================================================
   QuantEngine · medicion de ventaja
   -------------------------------------------------------------------------
   Esperanza, profit factor, Kelly, SQN, rachas y distribucion de R.
   Dos decisiones deliberadas:
   1) Profit factor sin perdidas NO es Infinito, es indefinido. Imprimir "∞"
      invita a creer en un sistema perfecto que solo tuvo pocas operaciones.
   2) Kelly completo sobre una ventaja estimada arruina cuentas. Se devuelve,
      y al lado se devuelve la fraccion que un adulto usaria.
   ========================================================================= */

import { Ok, Err, toNum, roundTo } from "./kernel.js";
import { momentos, cuantil, mediana, forma, ciMedia, ciProporcion, bootstrapCI,
         muestraMinima, significanciaMedia, veredicto, UMBRALES } from "./stats.js";

/* Entrada: lista de operaciones cerradas normalizadas
   { pnl: numero (USD neto), r: numero|null, fecha: "YYYY-MM-DD" } */
export function analizarEdge(operaciones, opciones) {
  const cfg = Object.assign({ confianza: 0.95, semilla: 20260917 }, opciones || {});
  const ops = (operaciones || []).filter(o => o && toNum(o.pnl) !== null);
  const n = ops.length;

  if (!n) return Ok({
    n: 0, veredicto: veredicto(0), pnlTotal: 0,
    ganadoras: 0, perdedoras: 0, planas: 0,
    tasaAcierto: null, profitFactor: null, esperanza: null, esperanzaR: null,
    kelly: null, sqn: null, rachas: null, distribucionR: null,
  });

  const pnls = ops.map(o => toNum(o.pnl));
  const rs = ops.map(o => toNum(o.r)).filter(x => x !== null);

  const gan = pnls.filter(x => x > 0);
  const per = pnls.filter(x => x < 0);
  const pla = pnls.filter(x => x === 0);
  const sumG = gan.reduce((s, x) => s + x, 0);
  const sumP = per.reduce((s, x) => s + x, 0);   // negativo
  const total = sumG + sumP;

  /* --- profit factor --- */
  let profitFactor = null, pfRazon = null;
  if (per.length === 0) { pfRazon = gan.length ? "sin operaciones perdedoras: el profit factor no esta definido" : "sin operaciones con resultado"; }
  else if (gan.length === 0) { profitFactor = 0; pfRazon = "sin operaciones ganadoras"; }
  else profitFactor = roundTo(sumG / Math.abs(sumP), 4);

  /* --- tasa de acierto (las planas no cuentan en el denominador) --- */
  const decisivas = gan.length + per.length;
  const wr = decisivas ? ciProporcion(gan.length, decisivas, cfg.confianza) : null;

  /* --- esperanza --- */
  const espUSD = ciMedia(pnls, cfg.confianza);
  const espR = rs.length >= 2 ? ciMedia(rs, cfg.confianza) : null;
  /* Sin pasar funcion: bootstrapCI usa su camino de media sin asignaciones.
     Ademas las repeticiones se escalan con n para que el trabajo total quede
     acotado: con n grande el intervalo ya es estrecho y 2.000 repeticiones solo
     compran decimales que nadie mira, a cambio de bloquear la interfaz. */
  const repsPara = k => k <= 400 ? 2000 : Math.max(500, Math.round(800000 / k));
  const bootR = rs.length >= 5 ? bootstrapCI(rs, null, { confianza: cfg.confianza, semilla: cfg.semilla, repeticiones: repsPara(rs.length) }) : null;
  const bootUSD = bootstrapCI(pnls, null, { confianza: cfg.confianza, semilla: cfg.semilla, repeticiones: repsPara(pnls.length) });

  const avgG = gan.length ? sumG / gan.length : null;
  const avgP = per.length ? Math.abs(sumP) / per.length : null;
  const payoff = avgG !== null && avgP ? roundTo(avgG / avgP, 4) : null;

  /* --- Kelly ---
     Riesgo f de la cuenta por operacion. Con ganancia media W y perdida media L
     expresadas en la misma unidad de riesgo:  f* = (p*W - q*L) / (W*L).
     Comprobacion: p=0.5, W=2, L=1  ->  f* = 0.25, que es el Kelly clasico 2:1. */
  let kelly = null, kellyRazon = null;
  const rG = rs.filter(x => x > 0), rP = rs.filter(x => x < 0).map(Math.abs);
  if (rG.length && rP.length) {
    const p = rG.length / (rG.length + rP.length), q = 1 - p;
    const W = rG.reduce((s, x) => s + x, 0) / rG.length;
    const L = rP.reduce((s, x) => s + x, 0) / rP.length;
    const f = (p * W - q * L) / (W * L);
    kelly = roundTo(f, 6);
    if (f <= 0) kellyRazon = "la ventaja medida es negativa o nula: la fraccion optima es no operar";
  } else kellyRazon = "hacen falta ganadoras y perdedoras con R para calcular Kelly";

  const vd = veredicto(n);
  const kellyRecomendado = kelly !== null && kelly > 0
    ? roundTo(kelly * (vd.nivel === "solido" ? 0.5 : 0.25), 6) : null;

  /* --- SQN --- */
  const mR = rs.length >= 2 ? momentos(rs) : null;
  const sqn = mR && mR.desv > 0 ? roundTo(Math.sqrt(Math.min(rs.length, 100)) * mR.media / mR.desv, 4) : null;

  /* --- rachas --- */
  let maxG = 0, maxP = 0, curG = 0, curP = 0, actual = 0;
  for (const x of pnls) {
    if (x > 0) { curG++; curP = 0; if (curG > maxG) maxG = curG; actual = curG; }
    else if (x < 0) { curP++; curG = 0; if (curP > maxP) maxP = curP; actual = -curP; }
    else { curG = 0; curP = 0; actual = 0; }
  }
  /* Racha perdedora esperada por azar en n intentos con tasa de acierto p:
     log(n) / -log(q). Sirve para no confundir mala suerte con sistema roto. */
  const q = wr ? 1 - wr.p : null;
  const rachaEsperada = q && q > 0 && q < 1 ? Math.round(Math.log(decisivas) / -Math.log(q)) : null;

  return Ok({
    n, veredicto: vd,
    pnlTotal: roundTo(total, 2),
    ganadoras: gan.length, perdedoras: per.length, planas: pla.length,

    tasaAcierto: wr ? { valor: roundTo(wr.p, 4), ic: [wr.bajo, wr.alto], n: decisivas } : null,

    profitFactor, profitFactorRazon: pfRazon,

    esperanza: { usd: roundTo(espUSD.media, 4), se: espUSD.se,
                 ic: [espUSD.bajo, espUSD.alto],
                 icBootstrap: bootUSD ? [bootUSD.bajo, bootUSD.alto] : null,
                 positiva: espUSD.bajo !== null ? espUSD.bajo > 0 : null },
    esperanzaR: espR ? { valor: roundTo(espR.media, 4), se: espR.se,
                         ic: [espR.bajo, espR.alto],
                         icBootstrap: bootR ? [bootR.bajo, bootR.alto] : null,
                         positiva: bootR ? bootR.bajo > 0 : espR.bajo > 0, n: rs.length } : null,

    gananciaMedia: avgG === null ? null : roundTo(avgG, 2),
    perdidaMedia: avgP === null ? null : roundTo(avgP, 2),
    payoff,

    kelly: { completo: kelly, recomendado: kellyRecomendado, razon: kellyRazon,
             nota: "Kelly completo asume que la ventaja medida es la real. Con esta muestra no lo es." },

    sqn, sqnEscala: sqn === null ? null : sqn < 1.6 ? "por debajo de operable" : sqn < 2 ? "promedio" : sqn < 3 ? "bueno" : sqn < 5 ? "excelente" : "revisar la muestra",

    rachas: { maxGanadoras: maxG, maxPerdedoras: maxP, actual,
              esperadaPorAzar: rachaEsperada,
              alarma: rachaEsperada !== null && maxP > rachaEsperada * 1.5 },

    distribucionR: rs.length >= 3 ? {
      n: rs.length,
      p05: roundTo(cuantil(rs, 0.05), 3), q1: roundTo(cuantil(rs, 0.25), 3),
      mediana: roundTo(mediana(rs), 3), q3: roundTo(cuantil(rs, 0.75), 3),
      p95: roundTo(cuantil(rs, 0.95), 3),
      peor: roundTo(Math.min(...rs), 3), mejor: roundTo(Math.max(...rs), 3),
      ...forma(rs),
      colaGorda: (() => { const f = forma(rs); return f.curtosis !== null && f.curtosis > 3; })(),
    } : null,

    muestra: rs.length >= 2 ? muestraMinima(rs) : muestraMinima(pnls),
    significancia: rs.length >= 2 ? significanciaMedia(rs) : significanciaMedia(pnls),

    /* La operacion mas grande sobre el total: si una sola operacion explica la
       mayor parte del resultado, no hay sistema, hubo un golpe de suerte. */
    concentracion: (() => {
      if (!gan.length || total <= 0) return null;
      const mayor = Math.max(...gan);
      return { mayorGanancia: roundTo(mayor, 2), pctDelTotal: roundTo(mayor / total, 4),
               dependeDeUna: mayor / total > 0.5 };
    })(),
  });
}
