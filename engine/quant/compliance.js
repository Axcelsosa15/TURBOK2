/* =========================================================================
   QuantEngine · cumplimiento de reglas de cuenta
   -------------------------------------------------------------------------
   Traduce el estado numerico de la cuenta a la unica pregunta operativa:
   puedo abrir la siguiente operacion, y de que tamano.

   Escalera de prioridad (gana la mas grave):
     QUEMADA > BLOQUEADA > RESTRINGIDA > AVISO > LISTA

   Distincion deliberada: la consistencia NO impide operar, impide cobrar.
   Marcarla como "no puedes operar" es factualmente falso y ademas empuja al
   trader a dejar de registrar justo los dias que mas informacion tienen.
   ========================================================================= */

import { Ok, toNum, roundTo, clamp } from "./kernel.js";

export const ESTADOS = Object.freeze({
  QUEMADA: "quemada", BLOQUEADA: "bloqueada", RESTRINGIDA: "restringida",
  AVISO: "aviso", LISTA: "lista",
});
const ORDEN = [ESTADOS.QUEMADA, ESTADOS.BLOQUEADA, ESTADOS.RESTRINGIDA, ESTADOS.AVISO, ESTADOS.LISTA];

const NIVELES = [
  { hasta: 0.50, codigo: "seguro", etiqueta: "SEGURO", clase: "good" },
  { hasta: 0.75, codigo: "precaucion", etiqueta: "PRECAUCION", clase: "warn" },
  { hasta: 1.00, codigo: "peligro", etiqueta: "PELIGRO", clase: "bad" },
];

/* Cuanto queda del limite de perdida diaria. */
export function margenDePerdida(pnlHoy, maximo) {
  const max = Math.abs(toNum(maximo) ?? 0);
  const usado = Math.max(0, -(toNum(pnlHoy) ?? 0));
  if (!max) return { aplica: false, max: 0, usado, restante: null, pct: 0, codigo: "sin_regla", etiqueta: "SIN REGLA", clase: "dim", agotado: false };
  const pct = Math.min(1, usado / max);
  const nivel = pct >= 1 ? { codigo: "agotado", etiqueta: "BLOQUEADA", clase: "bad" } : NIVELES.find(x => pct < x.hasta);
  return { aplica: true, max, usado: roundTo(usado, 2), restante: roundTo(Math.max(0, max - usado), 2),
           pct: roundTo(pct, 4), codigo: nivel.codigo, etiqueta: nivel.etiqueta, clase: nivel.clase, agotado: pct >= 1 };
}

/* Cuanto se puede ganar hoy sin romper nada: manda el menor entre la regla
   dura y el tope que impone la consistencia. */
export function topeDeGanancia(consistencia, reglaMaxima) {
  const dura = toNum(reglaMaxima);
  const cons = consistencia && consistencia.aplica && consistencia.total > 0 ? toNum(consistencia.topeDiaHoy) : null;
  if (dura === null && cons === null) return { valor: null, porque: "falta la regla de tope de ganancia" };
  if (dura === null) return { valor: cons, porque: "lo marca la consistencia" };
  if (cons === null) return { valor: dura, porque: "tu regla dura" };
  return cons < dura ? { valor: cons, porque: "lo marca la consistencia" } : { valor: dura, porque: "tu regla dura" };
}

/* Margen de drawdown restante, expresado tambien en operaciones perdedoras:
   "te quedan 2.3 stops" comunica mucho mas que "colchon 92 USD". */
export function margenDeDrawdown(curva, riesgoPorOperacion) {
  const colchon = toNum(curva && curva.colchon);
  const max = toNum(curva && curva.ddMaximo);
  if (colchon === null || max === null || max <= 0) return { aplica: false };
  const riesgo = toNum(riesgoPorOperacion);
  const pct = clamp((max - colchon) / max, 0, 1);
  const nivel = pct >= 1 ? { codigo: "quemada", etiqueta: "QUEMADA", clase: "bad" } : NIVELES.find(x => pct < x.hasta);
  return {
    aplica: true, colchon: roundTo(colchon, 2), max, usado: roundTo(max - colchon, 2),
    pct: roundTo(pct, 4), codigo: nivel.codigo, etiqueta: nivel.etiqueta, clase: nivel.clase,
    quemada: colchon <= 0,
    stopsRestantes: riesgo && riesgo > 0 ? roundTo(colchon / riesgo, 2) : null,
    peorMomento: curva && curva.peorMomento ? curva.peorMomento : null,
  };
}

/* -------------------------------------------------------------------------
   evaluarCumplimiento(): un solo veredicto, con los motivos en claro.
   ------------------------------------------------------------------------- */
export function evaluarCumplimiento(entrada) {
  const e = entrada || {};
  const curva = e.curva || null;
  const cons = e.consistencia || null;
  const hoy = e.hoy || { pnl: 0, operaciones: [], perdidasSeguidas: 0, contratosMax: 0 };
  const reglas = e.reglas || {};

  const bloqueos = [], avisos = [], notas = [];
  const riesgo = toNum(e.riesgoPorOperacion);

  const dd = margenDeDrawdown(curva, riesgo);
  const perdida = margenDePerdida(hoy.pnl, reglas.perdidaDiariaMax);
  const tope = topeDeGanancia(cons, reglas.gananciaDiariaMax);

  let estado = ESTADOS.LISTA;
  const subir = s => { if (ORDEN.indexOf(s) < ORDEN.indexOf(estado)) estado = s; };

  if (dd.aplica && dd.quemada) {
    subir(ESTADOS.QUEMADA);
    bloqueos.push({ codigo: "DRAWDOWN_TOCADO", texto: `La cuenta toco el suelo de ${roundTo(curva.suelo, 2)}.` });
  } else if (dd.aplica && dd.pct >= 0.75) {
    subir(ESTADOS.AVISO);
    avisos.push({ codigo: "DRAWDOWN_CERCA", texto: `Queda ${roundTo(dd.colchon, 2)} de colchon${dd.stopsRestantes !== null ? ` (${dd.stopsRestantes} stops)` : ""}.` });
  }

  if (perdida.aplica && perdida.agotado) {
    subir(ESTADOS.BLOQUEADA);
    bloqueos.push({ codigo: "PERDIDA_DIARIA", texto: `Perdida maxima diaria alcanzada (${roundTo(perdida.usado, 2)} de ${perdida.max}).` });
  } else if (perdida.aplica && perdida.pct >= 0.75) {
    subir(ESTADOS.AVISO);
    avisos.push({ codigo: "PERDIDA_DIARIA_CERCA", texto: `Quedan ${perdida.restante} antes del bloqueo diario.` });
  }

  const maxSeg = toNum(reglas.maxPerdidasSeguidas);
  if (maxSeg && (toNum(hoy.perdidasSeguidas) ?? 0) >= maxSeg) {
    subir(ESTADOS.BLOQUEADA);
    bloqueos.push({ codigo: "RACHA_PERDEDORA", texto: `${hoy.perdidasSeguidas} perdidas seguidas: tu regla corta en ${maxSeg}.` });
  }

  const maxC = toNum(reglas.maxContratos);
  if (maxC && (toNum(hoy.contratosMax) ?? 0) > maxC) {
    subir(ESTADOS.AVISO);
    avisos.push({ codigo: "CONTRATOS", texto: `Se opero con ${hoy.contratosMax} contratos y el tope es ${maxC}.` });
  }

  if (cons && cons.aplica && cons.sinGanancia) {
    /* Estar en rojo NO es incumplir la consistencia: es otro problema, peor y
       distinto. Marcarlo como violacion de regla esconde el de verdad. */
    notas.push({ codigo: "SIN_GANANCIA", texto: `Sin ganancia acumulada (${roundTo(cons.total, 2)}). La consistencia todavia no aplica: no hay nada que repartir. El problema no es la regla, es el resultado.` });
  } else if (cons && cons.aplica && cons.cumple === false) {
    subir(ESTADOS.RESTRINGIDA);
    notas.push({ codigo: "CONSISTENCIA", texto: `Consistencia ${roundTo(cons.ratio * 100, 2)}% sobre un limite de ${roundTo(cons.limite * 100, 0)}%: faltan ${cons.falta} de ganancia acumulada para poder cobrar. Operar sigue permitido.` });
  } else if (cons && cons.aplica && cons.cerca) {
    subir(ESTADOS.AVISO);
    notas.push({ codigo: "CONSISTENCIA_CERCA", texto: `La consistencia va al ${roundTo(cons.ratio * 100, 2)}%; el dia mas grande que aun cumple es ${cons.topeDiaHoy}.` });
  }

  /* Solo lo que realmente impide abrir la siguiente operacion. */
  const puedeOperar = estado !== ESTADOS.QUEMADA && estado !== ESTADOS.BLOQUEADA;

  return Ok({
    estado, puedeOperar,
    bloqueos, avisos, notas,
    drawdown: dd, perdidaDiaria: perdida, topeGanancia: tope,
    consistencia: cons,
    resumen: estado === ESTADOS.QUEMADA ? "Cuenta quemada."
           : estado === ESTADOS.BLOQUEADA ? "Bloqueada por hoy."
           : estado === ESTADOS.RESTRINGIDA ? "Puedes operar; no puedes cobrar todavia."
           : estado === ESTADOS.AVISO ? "Puedes operar, pero con poco margen."
           : "Lista para operar.",
  });
}
