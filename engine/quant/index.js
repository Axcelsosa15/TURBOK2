/* =========================================================================
   QuantEngine · fachada publica
   -------------------------------------------------------------------------
   Capas, de abajo a arriba. Cada una solo depende de las anteriores:

     kernel      Result, guardas, dinero entero, PRNG, normal inversa
     contracts   rejilla de ticks y especificacion de cada futuro
     trade       valuacion exacta de una operacion y dimensionamiento
     stats       momentos, cuantiles, intervalos, bootstrap, muestra minima
     edge        esperanza, profit factor, Kelly, SQN, rachas
     curve       curva de capital, drawdown como maquina de estados
     survival    Monte Carlo de supervivencia de cuenta
     compliance  veredicto operativo

   Nada de esto toca el DOM, ni el reloj, ni el azar sin semilla.
   ========================================================================= */

export * from "./kernel.js";
export * from "./contracts.js";
export * from "./trade.js";
export * from "./stats.js";
export * from "./edge.js";
export * from "./curve.js";
export * from "./survival.js";
export * from "./compliance.js";

import { isOk, toNum, roundTo, sym } from "./kernel.js";
import { CONTRACTS, resolveContract, rootOf } from "./contracts.js";
import { valuarOperacion, dirOf } from "./trade.js";
import { analizarEdge } from "./edge.js";
import { construirCurva, metricasCurva, evaluarConsistencia, DD_TIPOS } from "./curve.js";
import { simularCuenta, barridoDeRiesgo, simularParametrico, probabilidadDeRacha } from "./survival.js";
import { evaluarCumplimiento } from "./compliance.js";

/* =========================================================================
   Adaptador para Cabina
   -------------------------------------------------------------------------
   La app guarda las operaciones con sus propios nombres de campo. En lugar de
   renombrar 5.000 lineas de render, la traduccion vive aqui, en un solo sitio,
   y es lo unico que hay que revisar si el modelo de datos cambia.
   ========================================================================= */

export function desdeTradeApp(t) {
  return {
    simbolo: t.instrument,
    direccion: t.direction,
    entrada: toNum(t.entry),
    salida: toNum(t.exit),
    stop: toNum(t.stop),
    objetivo: toNum(t.target),
    contratos: toNum(t.qty) || 1,
    comisionExtra: toNum(t.fees) || 0,
  };
}

/* Drop-in de tradeCalc: devuelve exactamente los campos derivados que los
   renders de la app ya leen, ni uno mas. */
export function calcularTradeApp(t, opciones) {
  const cfg = Object.assign({ incluirComisiones: false, overrides: null }, opciones || {});
  const r = valuarOperacion(desdeTradeApp(t), cfg);

  if (!isOk(r)) {
    /* Sin contrato no hay P&L en dolares, pero R SI existe: es un cociente de
       precios y el multiplicador se cancela. Perderlo aqui seria tirar la
       unica medida util que queda de una operacion con simbolo desconocido. */
    return {
      pnlEff: toNum(t.pnl),
      rReal: rRealApp(t),
      rPlanned: rPlanApp(t),
      riskUsd: null,
      multUnknown: r.error.code === "CONTRATO_DESCONOCIDO" && !!sym(t.instrument),
      calcError: r.error.message,
      avisos: [],
    };
  }
  const v = r.value;
  /* Un P&L escrito a mano siempre gana sobre el calculado: es un hecho
     reportado, no una estimacion. */
  const manual = toNum(t.pnl);
  return {
    pnlEff: manual !== null ? manual : v.pnlNeto,
    rReal: v.rBruto,
    rPlanned: v.rPlaneado,
    riskUsd: v.riesgoUSD,
    ticks: v.ticks,
    eficiencia: v.eficiencia,
    multUnknown: false,
    calcError: null,
    /* Los avisos viajan enteros, no solo su codigo: la interfaz necesita poder
       decir QUE precio esta mal y a que valor cae en la rejilla del contrato. */
    avisos: r.warnings.map(w => ({ code: w.code, mensaje: w.message, detalle: w.detail })),
  };
}

/* R planeado sin contrato: tambien es un cociente de precios. */
export function rPlanApp(t) {
  const e = toNum(t.entry), s = toNum(t.stop), o = toNum(t.target);
  if (e === null || s === null || o === null) return null;
  const riesgo = Math.abs(e - s);
  if (!riesgo) return null;
  return roundTo(Math.abs(o - e) / riesgo, 4);
}

/* R real de una operacion aunque el simbolo sea desconocido: es un cociente
   de precios, el multiplicador se cancela. */
export function rRealApp(t) {
  const dir = dirOf(t.direction);
  const e = toNum(t.entry), s = toNum(t.stop), x = toNum(t.exit);
  if (e === null || s === null || x === null) return null;
  const riesgo = Math.abs(e - s);
  if (!riesgo) return null;
  return roundTo(((x - e) * dir) / riesgo, 4);
}

/* -------------------------------------------------------------------------
   Radiografia completa de una cuenta en una sola llamada.
   trades: operaciones ya calculadas de la app [{date, pnlEff, rReal, qty,...}]
   cuenta: { size, dd, ddKind, limit, total, best, ledger }
   ------------------------------------------------------------------------- */
export function radiografiaCuenta(trades, cuenta, opciones) {
  const cfg = Object.assign({ hoy: null, reglas: {}, base: "cierre", semilla: 20260917, simular: false, caminos: 3000 }, opciones || {});
  const a = cuenta || {};

  const cerradas = (trades || []).filter(t => toNum(t.pnlEff) !== null);
  const ops = cerradas.map((t, i) => ({ fecha: t.date, orden: i, pnl: toNum(t.pnlEff) }));

  const movimientos = (a.ledger || []).map(m => ({
    fecha: m.date, monto: toNum(m.amount),
    tipo: m.kind === "deposit" ? "deposito" : m.kind === "payout" ? "retiro" : "costo",
  })).filter(m => m.monto !== null);

  const ddTipo = a.ddKind === "estatico" ? DD_TIPOS.ESTATICO
               : a.ddKind === "trailing" ? DD_TIPOS.TRAILING
               : DD_TIPOS.TRAILING_BLOQUEADO;

  /* La ganancia previa escrita a mano se inyecta como saldo de arranque para
     que pico, suelo y colchon la tengan en cuenta desde el primer dia. */
  const previa = toNum(a.total) || 0;
  const tamano = toNum(a.size) || 0;

  const curva = construirCurva(ops, {
    saldoInicial: tamano + previa,
    ddTipo, ddMaximo: toNum(a.dd), base: cfg.base, movimientos,
  }).value;
  /* El suelo se mide contra el tamano nominal de la cuenta, no contra el
     arranque inflado por la ganancia previa. */
  if (tamano > 0) {
    const curvaReal = construirCurva(ops, {
      saldoInicial: tamano, ddTipo, ddMaximo: toNum(a.dd), base: cfg.base,
      movimientos: movimientos.concat(previa ? [{ fecha: (ops[0] && ops[0].fecha) || "0000-00-00", monto: previa, tipo: "deposito" }] : []),
    }).value;
    curva.suelo = curvaReal.suelo; curva.colchon = curvaReal.colchon;
    curva.pico = curvaReal.pico; curva.peorMomento = curvaReal.peorMomento;
    curva.ddUsado = curvaReal.ddUsado; curva.bloqueado = curvaReal.bloqueado;
  }

  const diarios = curva.dias.map(d => ({ fecha: d.fecha, pnl: d.pnl }));
  const consist = evaluarConsistencia(diarios, toNum(a.limit), {
    gananciaPrevia: previa, mejorDiaPrevio: toNum(a.best) || 0,
  }).value;

  const edge = analizarEdge(cerradas.map(t => ({ pnl: toNum(t.pnlEff), r: toNum(t.rReal), fecha: t.date })), { semilla: cfg.semilla }).value;
  const met = metricasCurva(curva).value;

  const riesgos = cerradas.map(t => toNum(t.riskUsd)).filter(x => x !== null && x > 0);
  const riesgoTipico = riesgos.length ? roundTo(riesgos.reduce((s, x) => s + x, 0) / riesgos.length, 2) : null;

  const cumpl = evaluarCumplimiento({
    curva, consistencia: consist, hoy: cfg.hoy || { pnl: 0 },
    reglas: cfg.reglas, riesgoPorOperacion: riesgoTipico,
  }).value;

  let simulacion = null;
  if (cfg.simular && riesgoTipico) {
    const rs = cerradas.map(t => toNum(t.rReal)).filter(x => x !== null);
    const opsPorDia = curva.nDias ? cerradas.length / curva.nDias : 3;
    const sim = simularCuenta({
      rMultiples: rs, riesgoPorOperacion: riesgoTipico, operacionesPorDia: opsPorDia,
      saldoInicial: tamano || 25000, ddTipo, ddMaximo: toNum(a.dd),
      objetivoGanancia: toNum(a.target) || toNum(cfg.objetivo),
      perdidaDiariaMax: toNum(cfg.reglas && cfg.reglas.perdidaDiariaMax),
      limiteConsistencia: toNum(a.limit), diasMax: 120, caminos: cfg.caminos, semilla: cfg.semilla,
    });
    simulacion = sim.ok ? sim.value : { error: sim.error };
  }

  return {
    curva, metricas: met, consistencia: consist, edge, cumplimiento: cumpl,
    riesgoTipico, simulacion,
    balance: curva.equity, pico: curva.pico, suelo: curva.suelo, colchon: curva.colchon,
  };
}

export const QuantEngine = {
  /* contratos */ CONTRACTS, resolveContract, rootOf,
  /* operacion */ valuarOperacion, dirOf,
  /* ventaja   */ analizarEdge,
  /* curva     */ construirCurva, metricasCurva, evaluarConsistencia, DD_TIPOS,
  /* riesgo    */ simularCuenta, barridoDeRiesgo, simularParametrico, probabilidadDeRacha,
  /* reglas    */ evaluarCumplimiento,
  /* app       */ calcularTradeApp, rRealApp, rPlanApp, radiografiaCuenta, desdeTradeApp,
};
export default QuantEngine;
