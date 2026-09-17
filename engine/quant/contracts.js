/* =========================================================================
   QuantEngine · contratos
   -------------------------------------------------------------------------
   Un futuro no se opera en "puntos": se opera en ticks. El precio vive en una
   rejilla discreta y el P&L es SIEMPRE un multiplo entero del valor del tick.
   Por eso aqui el dato primario es (tickSize, tickValue) y el multiplicador
   es derivado, no al reves. El invariante multiplier = tickValue / tickSize
   se verifica al cargar el modulo: un spec mal escrito revienta de inmediato
   en vez de producir P&L plausible pero falso durante meses.
   ========================================================================= */

import { Ok, Err, sym, toNum, roundTo } from "./kernel.js";

function spec(symbol, nombre, tickSize, tickValueUSD, commissionRT, clase) {
  const multiplier = tickValueUSD / tickSize;
  return Object.freeze({
    symbol, nombre, clase,
    tickSize,
    tickValue: tickValueUSD,
    multiplier: roundTo(multiplier, 8),
    commissionPerContract: commissionRT,
    currency: "USD",
    /* Cuantos decimales tiene sentido mostrar en un precio de este contrato. */
    priceDecimals: Math.max(0, String(tickSize).includes(".") ? String(tickSize).split(".")[1].length : 0),
  });
}

export const CONTRACTS = Object.freeze({
  /*          sym    nombre                        tick     $tick   comis  clase   */
  MNQ: spec("MNQ", "Micro E-mini Nasdaq-100",     0.25,     0.50,   1.5,  "indice"),
  NQ:  spec("NQ",  "E-mini Nasdaq-100",           0.25,     5.00,   4.0,  "indice"),
  MES: spec("MES", "Micro E-mini S&P 500",        0.25,     1.25,   1.5,  "indice"),
  ES:  spec("ES",  "E-mini S&P 500",              0.25,    12.50,   4.0,  "indice"),
  MYM: spec("MYM", "Micro E-mini Dow",            1,        0.50,   1.5,  "indice"),
  YM:  spec("YM",  "E-mini Dow",                  1,        5.00,   4.0,  "indice"),
  M2K: spec("M2K", "Micro E-mini Russell 2000",   0.1,      0.50,   1.5,  "indice"),
  RTY: spec("RTY", "E-mini Russell 2000",         0.1,      5.00,   4.0,  "indice"),
  MGC: spec("MGC", "Micro Oro (10 oz)",           0.1,      1.00,   1.5,  "metal"),
  GC:  spec("GC",  "Oro (100 oz)",                0.1,     10.00,   4.0,  "metal"),
  SIL: spec("SIL", "Micro Plata (1.000 oz)",      0.005,    5.00,   1.5,  "metal"),
  SI:  spec("SI",  "Plata (5.000 oz)",            0.005,   25.00,   4.0,  "metal"),
  MCL: spec("MCL", "Micro Crudo WTI (100 bbl)",   0.01,     1.00,   1.5,  "energia"),
  CL:  spec("CL",  "Crudo WTI (1.000 bbl)",       0.01,    10.00,   4.0,  "energia"),
  M6E: spec("M6E", "Micro EUR/USD",               0.0001,   1.25,   1.5,  "divisa"),
  "6E":spec("6E",  "EUR/USD",                     0.00005,  6.25,   4.0,  "divisa"),
  MBT: spec("MBT", "Micro Bitcoin (0,1 BTC)",     5,        0.50,   2.5,  "cripto"),
  BTC: spec("BTC", "CME Bitcoin (5 BTC)",         5,       25.00,  10.0,  "cripto"),
});

/* El invariante se comprueba al cargar, no en cada llamada. */
(function assertInvariants() {
  for (const k of Object.keys(CONTRACTS)) {
    const c = CONTRACTS[k];
    const d = Math.abs(c.multiplier * c.tickSize - c.tickValue);
    if (d > 1e-9) throw new Error(`QuantEngine: spec incoherente en ${k}: multiplier*tickSize=${c.multiplier * c.tickSize} != tickValue=${c.tickValue}`);
    if (!(c.tickSize > 0) || !(c.tickValue > 0)) throw new Error(`QuantEngine: tick invalido en ${k}`);
  }
})();

/* Alias de contratos por mes/anio: MNQZ5, ESH6, NQ M25... se reducen a la raiz. */
const MONTH_CODES = "FGHJKMNQUVXZ";
export function rootOf(rawSymbol) {
  let s = sym(rawSymbol);
  if (!s) return "";
  if (CONTRACTS[s]) return s;
  s = s.replace(/^\//, "").replace(/[\s_-]/g, "");
  if (CONTRACTS[s]) return s;
  // sufijo mes+anio: 1 letra de mes + 1 o 2 digitos
  const m = s.match(/^([A-Z0-9]{1,4})([FGHJKMNQUVXZ])(\d{1,2})$/);
  if (m && MONTH_CODES.includes(m[2]) && CONTRACTS[m[1]]) return m[1];
  return s;
}

/* -------------------------------------------------------------------------
   Resolver un contrato NUNCA adivina. Si el simbolo no esta y no hay override
   explicito, devuelve Err. Un multiplicador supuesto produce un P&L falso que
   luego alimenta balance, drawdown y consistencia: el dano se propaga a todo.
   ------------------------------------------------------------------------- */
export function resolveContract(rawSymbol, overrides) {
  const raw = sym(rawSymbol);
  if (!raw) return Err("SIMBOLO_VACIO", "Falta el simbolo del contrato.");
  const root = rootOf(raw);

  const ov = overrides && typeof overrides === "object" ? (overrides[root] || overrides[raw]) : null;
  const base = CONTRACTS[root] || null;

  if (!base && !ov) {
    return Err("CONTRATO_DESCONOCIDO",
      `Sin especificacion para «${raw}». El motor no adivina el valor del tick.`,
      { symbol: raw, root });
  }

  const tickSize = toNum(ov && ov.tickSize) ?? (base ? base.tickSize : null);
  let tickValue  = toNum(ov && ov.tickValue) ?? (base ? base.tickValue : null);
  const multOv   = toNum(ov && ov.multiplier);

  /* Un override puede venir expresado como multiplicador (mas familiar).
     Se traduce a tickValue para que el resto del motor hable un solo idioma. */
  if (tickValue === null && multOv !== null && tickSize !== null) tickValue = multOv * tickSize;
  if (tickValue !== null && multOv !== null && tickSize !== null) {
    const implied = multOv * tickSize;
    if (Math.abs(implied - tickValue) > 1e-9) tickValue = implied;
  }

  if (tickSize === null || tickValue === null || !(tickSize > 0) || !(tickValue > 0)) {
    return Err("CONTRATO_INCOMPLETO",
      `La especificacion de «${raw}» no define un tick valido.`, { symbol: raw, root });
  }

  const commission = toNum(ov && ov.commissionPerContract);
  return Ok(Object.freeze({
    symbol: root,
    entrada: raw,
    nombre: (ov && ov.nombre) || (base ? base.nombre : root),
    clase: (base ? base.clase : "otro"),
    tickSize,
    tickValue,
    multiplier: roundTo(tickValue / tickSize, 8),
    commissionPerContract: commission !== null ? commission : (base ? base.commissionPerContract : 0),
    currency: "USD",
    priceDecimals: base ? base.priceDecimals : (String(tickSize).includes(".") ? String(tickSize).split(".")[1].length : 0),
    sintetico: !base,
  }));
}

export function listContracts() {
  return Object.keys(CONTRACTS).map(k => CONTRACTS[k]);
}
