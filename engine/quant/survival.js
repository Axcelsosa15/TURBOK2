/* =========================================================================
   QuantEngine · supervivencia de cuenta
   -------------------------------------------------------------------------
   La unica pregunta que de verdad importa en una cuenta de fondeo:
   con MI ventaja medida y MI tamano de posicion, que probabilidad tengo de
   pasarla antes de quemarla.

   Por que Monte Carlo y no la formula clasica de riesgo de ruina:
   la formula de Ralph Vince asume ganancia y perdida de tamano fijo y ruina
   en cero. Ninguna de las tres cosas es cierta aqui: la distribucion de R
   tiene colas, el suelo es movil (trailing) y encima hay limite de perdida
   diaria y regla de consistencia que interactuan entre si. Remuestrear las
   operaciones reales del trader respeta la forma real de su distribucion,
   colas incluidas, sin asumir normalidad.

   Sembrado: dos corridas con la misma semilla dan el mismo resultado.
   Una simulacion que no se puede reproducir no es evidencia.
   ========================================================================= */

import { Ok, Err, toNum, toPosInt, roundTo, rng, randInt } from "./kernel.js";
import { cuantil, momentos } from "./stats.js";
import { DD_TIPOS, sueloPara } from "./curve.js";

export const RESULTADO = Object.freeze({ PASADA: "pasada", QUEMADA: "quemada", SIN_RESOLVER: "sin_resolver" });

export function simularCuenta(opciones) {
  const cfg = Object.assign({
    rMultiples: [],
    riesgoPorOperacion: null,      // USD que vale 1R
    operacionesPorDia: 3,
    variabilidadOpsDia: true,      // el numero de trades del dia varia
    saldoInicial: 25000,
    ddTipo: DD_TIPOS.TRAILING_BLOQUEADO,
    ddMaximo: 1000,
    baseTrailing: "cierre",
    objetivoGanancia: null,        // USD de ganancia para pasar
    perdidaDiariaMax: null,        // USD; al tocarlo se corta el dia
    limiteConsistencia: null,      // 0..100; debe cumplirse para pasar
    diasMinimos: 0,                // dias minimos exigidos por la prop
    diasMax: 120,
    caminos: 5000,
    semilla: 20260917,
  }, opciones || {});

  const rs = (cfg.rMultiples || []).map(toNum).filter(x => x !== null);
  if (rs.length < 5) return Err("MUESTRA_INSUFICIENTE",
    `Hacen falta al menos 5 operaciones con R para simular; hay ${rs.length}. Sin distribucion propia, la simulacion seria una opinion disfrazada de numero.`,
    { n: rs.length });

  const riesgo = toNum(cfg.riesgoPorOperacion);
  if (riesgo === null || riesgo <= 0) return Err("SIN_RIESGO", "Falta el valor en USD de 1R.");

  const inicial = toNum(cfg.saldoInicial) ?? 0;
  const ddMax = toNum(cfg.ddMaximo);
  const objetivo = toNum(cfg.objetivoGanancia);
  const perdidaDia = toNum(cfg.perdidaDiariaMax);
  const Lc = toNum(cfg.limiteConsistencia);
  const L = Lc === null ? null : Math.min(Math.max(Lc, 1), 99) / 100;
  const opsDiaMedia = Math.max(1, toNum(cfg.operacionesPorDia) ?? 3);
  const diasMax = toPosInt(cfg.diasMax) ?? 120;
  const caminos = toPosInt(cfg.caminos) ?? 5000;
  const diasMin = toPosInt(cfg.diasMinimos) ?? 0;
  const intradia = cfg.baseTrailing === "intradia";

  const next = rng(cfg.semilla);
  const nR = rs.length;

  let pasadas = 0, quemadas = 0, sinResolver = 0;
  const diasHastaPasar = [];
  const diasHastaQuemar = [];
  const finales = [];
  const maxCaidas = [];
  let bloqueadosPorConsistencia = 0;

  for (let p = 0; p < caminos; p++) {
    let equity = inicial, pico = inicial;
    let mejorDia = 0, totalGanancia = 0;
    let peorColchon = Infinity;
    let estado = RESULTADO.SIN_RESOLVER, dia = 0;
    let frenadoPorConsistencia = false;

    for (dia = 1; dia <= diasMax; dia++) {
      /* Numero de operaciones del dia: Poisson aproximada por conteo simple
         alrededor de la media, para no fingir un ritmo perfectamente regular. */
      let k = Math.round(opsDiaMedia);
      if (cfg.variabilidadOpsDia) {
        k = 0; const lambda = opsDiaMedia, limite = Math.exp(-lambda);
        let prod = next();
        while (prod > limite && k < 50) { k++; prod *= next(); }
        if (k < 1) k = 1;
      }

      let pnlDia = 0;
      for (let i = 0; i < k; i++) {
        const r = rs[randInt(next, nR)];
        const pnl = r * riesgo;
        pnlDia += pnl; equity += pnl;
        if (intradia) {
          if (equity > pico) pico = equity;
          const suelo = sueloPara(cfg.ddTipo, inicial, pico, ddMax);
          if (suelo !== null) { const col = equity - suelo; if (col < peorColchon) peorColchon = col;
            if (col <= 0) { estado = RESULTADO.QUEMADA; break; } }
        }
        if (perdidaDia !== null && pnlDia <= -Math.abs(perdidaDia)) break;  // se corta el dia
      }
      if (estado === RESULTADO.QUEMADA) break;

      if (!intradia) {
        if (equity > pico) pico = equity;
        const suelo = sueloPara(cfg.ddTipo, inicial, pico, ddMax);
        if (suelo !== null) { const col = equity - suelo; if (col < peorColchon) peorColchon = col;
          if (col <= 0) { estado = RESULTADO.QUEMADA; break; } }
      }

      if (pnlDia > 0) { if (pnlDia > mejorDia) mejorDia = pnlDia; }
      totalGanancia = equity - inicial;

      /* Pasar exige las tres cosas a la vez: objetivo, dias minimos y
         consistencia. Un dia enorme puede RETRASAR el aprobado aunque el
         objetivo ya este cubierto; esa interaccion es el motivo de simular. */
      if (objetivo !== null && totalGanancia >= objetivo && dia >= diasMin) {
        const ratio = totalGanancia > 0 ? mejorDia / totalGanancia : 1;
        if (L === null || ratio <= L) { estado = RESULTADO.PASADA; break; }
        frenadoPorConsistencia = true;
      }
    }

    if (estado === RESULTADO.PASADA) { pasadas++; diasHastaPasar.push(dia); }
    else if (estado === RESULTADO.QUEMADA) { quemadas++; diasHastaQuemar.push(dia); }
    else { sinResolver++; if (frenadoPorConsistencia) bloqueadosPorConsistencia++; }

    finales.push(equity);
    maxCaidas.push(peorColchon === Infinity ? null : peorColchon);
  }

  const pP = roundTo(pasadas / caminos, 4);
  const pQ = roundTo(quemadas / caminos, 4);
  const mF = momentos(finales);
  const colchones = maxCaidas.filter(x => x !== null);

  return Ok({
    caminos, semilla: cfg.semilla,
    muestraR: nR,
    supuestos: {
      riesgoPorOperacion: roundTo(riesgo, 2),
      operacionesPorDia: roundTo(opsDiaMedia, 2),
      saldoInicial: inicial, ddTipo: cfg.ddTipo, ddMaximo: ddMax,
      objetivoGanancia: objetivo, perdidaDiariaMax: perdidaDia,
      limiteConsistencia: L, diasMax, diasMinimos: diasMin,
      baseTrailing: cfg.baseTrailing,
    },

    /* Las tres se redondean de forma coherente: si cada una se redondea por su
       cuenta, la suma puede dar 100.01% y un panel que muestra probabilidades
       que no suman 1 destruye la confianza en todo lo demas. La tercera se
       deriva de las otras dos. */
    pPasar: pP,
    pQuemar: pQ,
    pSinResolver: roundTo(1 - pP - pQ, 4),
    pFrenadaPorConsistencia: roundTo(bloqueadosPorConsistencia / caminos, 4),

    diasPasarMediana: diasHastaPasar.length ? Math.round(cuantil(diasHastaPasar, 0.5)) : null,
    diasPasarP90: diasHastaPasar.length ? Math.round(cuantil(diasHastaPasar, 0.9)) : null,
    diasQuemarMediana: diasHastaQuemar.length ? Math.round(cuantil(diasHastaQuemar, 0.5)) : null,

    equityFinal: {
      media: roundTo(mF.media, 2),
      mediana: roundTo(cuantil(finales, 0.5), 2),
      p05: roundTo(cuantil(finales, 0.05), 2),
      p95: roundTo(cuantil(finales, 0.95), 2),
    },
    colchonMinimo: colchones.length ? {
      mediana: roundTo(cuantil(colchones, 0.5), 2),
      p05: roundTo(cuantil(colchones, 0.05), 2),
    } : null,

    /* Riesgo de ruina con este tamano de posicion, sin objetivo ni horizonte:
       es pQuemar dentro de diasMax. Se nombra asi para no confundirlo con la
       ruina asintotica, que para un suelo movil siempre tiende a 1. */
    riesgoDeRuina: pQ,

    /* Error estandar de Monte Carlo: sqrt(p(1-p)/N). Con 2.000 caminos la
       resolucion es 0.05%, asi que imprimir "100.0%" afirma una certeza que
       el metodo no puede entregar. Quien consume esto debe redondear hacia
       ">99%" / "<1%" en los extremos. */
    errorEstandar: {
      pasar: roundTo(Math.sqrt(pP * (1 - pP) / caminos), 5),
      quemar: roundTo(Math.sqrt(pQ * (1 - pQ) / caminos), 5),
    },
    resolucion: roundTo(1 / caminos, 6),
    nota: "Probabilidades condicionadas a que la ventaja futura sea igual a la medida. No lo es: la muestra tiene error y el mercado cambia.",
  });
}

/* -------------------------------------------------------------------------
   riesgoPorTamano(): barre varios tamanos de posicion y devuelve la curva
   completa. Sirve para ver donde esta el punto en que subir contratos deja
   de aumentar la probabilidad de pasar y solo aumenta la de quemar.
   ------------------------------------------------------------------------- */
export function barridoDeRiesgo(opciones, tamanos) {
  const lista = (tamanos && tamanos.length ? tamanos : [0.25, 0.5, 0.75, 1, 1.5, 2, 3]);
  const baseRiesgo = toNum(opciones && opciones.riesgoPorOperacion);
  if (baseRiesgo === null || baseRiesgo <= 0) return Err("SIN_RIESGO", "Falta el valor en USD de 1R.");
  const filas = [];
  for (const mult of lista) {
    const r = simularCuenta(Object.assign({}, opciones, { riesgoPorOperacion: baseRiesgo * mult }));
    if (!r.ok) return r;
    filas.push({ multiplicador: mult, riesgo: roundTo(baseRiesgo * mult, 2),
                 pPasar: r.value.pPasar, pQuemar: r.value.pQuemar,
                 diasPasarMediana: r.value.diasPasarMediana });
  }
  let optimo = null;
  for (const f of filas) if (!optimo || f.pPasar > optimo.pPasar) optimo = f;
  return Ok({ filas, optimo });
}
