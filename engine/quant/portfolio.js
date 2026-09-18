/* =========================================================================
   QuantEngine · cartera (retorno con aportes en el tiempo)
   -------------------------------------------------------------------------
   El problema: con dinero entrando en fechas distintas, (valor - coste)/coste
   NO es tu rentabilidad. El dolar de enero trabajo doce meses; el de diciembre,
   cero. Dividir por el coste total ignora eso y subestima el resultado.

   Ejemplo medido: DCA de 200/mes durante 12 meses en un activo que sube 10%.
     (valor - coste)/coste  ->   5.34%
     IRR anualizado         ->  10.00%
   Casi la mitad. Y el error empuja a abandonar una estrategia que funciona.

   QUE SE PUEDE CALCULAR Y QUE NO
   - MWR / IRR: EXACTO. Solo necesita flujos fechados y el valor final.
   - TWR verdadero: NO. Necesita el valor de la cartera en CADA fecha de flujo,
     y eso no se registra. Aqui no se aproxima ni se disfraza: se dice que falta.
   ========================================================================= */

import { Ok, Err, toNum, roundTo } from "./kernel.js";

const DIA = 86400000;

/* Fecha ISO -> milisegundos UTC. Sin reloj: la fecha "hoy" siempre se pasa. */
export function fechaMs(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : null;
}
export function aniosEntre(desdeISO, hastaISO) {
  const a = fechaMs(desdeISO), b = fechaMs(hastaISO);
  if (a === null || b === null) return null;
  return (b - a) / DIA / 365;
}

/* -------------------------------------------------------------------------
   Valor de una serie de flujos CAPITALIZADOS hasta la fecha de corte.
   Convencion: flujo NEGATIVO = dinero que sale de tu bolsillo (compra, aporte),
   POSITIVO = dinero que vuelve (venta, dividendo). El valor final de la cartera
   entra como un flujo positivo en la fecha de corte.

   El IRR es la tasa que hace esta suma cero: cada aporte crece a r hasta el
   final y, entre todos, tienen que dar exactamente el valor que tienes hoy.

     valor_final = SUMA( aporte_i * (1+r)^(anios desde aporte_i hasta hoy) )

   Ojo con el exponente: es MULTIPLICAR, no dividir. Dividir mide lo contrario
   —hace encoger los aportes en vez de crecerlos— y devuelve una tasa negativa
   para una cartera que va ganando. Es exactamente el error que tuve aqui.
   ------------------------------------------------------------------------- */
export function valorCapitalizado(flujos, tasa, hastaISO) {
  const r = toNum(tasa);
  if (r === null || r <= -1) return null;
  let v = 0;
  for (const f of flujos) {
    const t = aniosEntre(f.fecha, hastaISO);
    if (t === null) return null;
    v += f.monto * Math.pow(1 + r, t);
  }
  return v;
}
/* alias historico */
export const vpn = valorCapitalizado;

/* -------------------------------------------------------------------------
   IRR por biseccion. Newton converge mas rapido pero puede divergir con flujos
   irregulares, y aqui importa mas no mentir que terminar rapido: la biseccion
   converge SIEMPRE si hay un cambio de signo en el intervalo.
   ------------------------------------------------------------------------- */
export function irr(flujos, hastaISO, opciones) {
  const cfg = Object.assign({ min: -0.9999, max: 10, iteraciones: 200, tolerancia: 1e-7 }, opciones || {});
  const fs = (flujos || []).filter(f => f && toNum(f.monto) !== null && fechaMs(f.fecha) !== null);
  if (fs.length < 2) return Err("FLUJOS_INSUFICIENTES", "Hacen falta al menos dos flujos fechados.", { n: fs.length });

  const hayNeg = fs.some(f => f.monto < 0), hayPos = fs.some(f => f.monto > 0);
  if (!hayNeg || !hayPos) {
    return Err("SIN_CAMBIO_DE_SIGNO",
      "Todos los flujos van en la misma direccion: no existe una tasa de retorno que resolver.",
      { hayNeg, hayPos });
  }

  let a = cfg.min, b = cfg.max;
  const va = valorCapitalizado(fs, a, hastaISO), vb = valorCapitalizado(fs, b, hastaISO);
  if (va === null || vb === null) return Err("FECHAS_INVALIDAS", "Alguna fecha no se pudo interpretar.");
  if (va * vb > 0) {
    return Err("SIN_RAIZ_EN_RANGO",
      `El IRR queda fuera del rango [${roundTo(cfg.min * 100, 0)}%, ${roundTo(cfg.max * 100, 0)}%]. Suele significar que el valor final o alguna fecha estan mal.`,
      { valorMin: roundTo(va, 4), valorMax: roundTo(vb, 4) });
  }

  let mid = a;
  for (let i = 0; i < cfg.iteraciones; i++) {
    mid = (a + b) / 2;
    const v = valorCapitalizado(fs, mid, hastaISO);
    if (v === null) break;
    if (Math.abs(v) < cfg.tolerancia || (b - a) / 2 < cfg.tolerancia) break;
    if (v * va > 0) a = mid; else b = mid;
  }
  return Ok(roundTo(mid, 6));
}

/* -------------------------------------------------------------------------
   analizarCartera(): las dos cifras, y la distancia entre ellas.

   ops: [{ fecha, tipo: "compra"|"aporte"|"venta"|"dividendo"|"costo", monto }]
        monto SIEMPRE en positivo; el tipo decide el signo (igual que el ledger
        de las cuentas, por la misma razon: un retiro en negativo sumaba).
   valorActual: valor de mercado de lo que aun tienes.
   hasta: fecha de corte (ISO). Se pasa: el motor no mira el reloj.
   ------------------------------------------------------------------------- */
const SALE = { compra: -1, aporte: -1, costo: -1 };
const ENTRA = { venta: 1, dividendo: 1, ingreso: 1 };

export function analizarCartera(entrada) {
  const e = entrada || {};
  const hasta = e.hasta;
  if (fechaMs(hasta) === null) return Err("SIN_FECHA_DE_CORTE", "Falta la fecha hasta la que medir.");
  const valor = toNum(e.valorActual);
  if (valor === null || valor < 0) return Err("SIN_VALOR", "Falta el valor actual de la cartera.");

  const flujos = [];
  let invertido = 0, recuperado = 0, primeraFecha = null;
  for (const o of (e.ops || [])) {
    const m = Math.abs(toNum(o && o.monto) ?? 0);
    const f = o && o.fecha;
    if (!m || fechaMs(f) === null) continue;
    const signo = SALE[o.tipo] !== undefined ? SALE[o.tipo] : (ENTRA[o.tipo] !== undefined ? ENTRA[o.tipo] : -1);
    flujos.push({ fecha: f, monto: signo * m, tipo: o.tipo });
    if (signo < 0) invertido += m; else recuperado += m;
    if (primeraFecha === null || fechaMs(f) < fechaMs(primeraFecha)) primeraFecha = f;
  }
  if (!flujos.length) return Err("SIN_OPERACIONES", "No hay aportes ni compras registrados.");

  /* El valor que aun tienes entra como flujo positivo en la fecha de corte. */
  const conFinal = flujos.concat([{ fecha: hasta, monto: valor, tipo: "valor_final" }]);
  const rIrr = irr(conFinal, hasta);

  const neto = recuperado + valor - invertido;
  /* La formula que usa la app hoy, para poder ensenar la diferencia. */
  const simple = invertido > 0 ? neto / invertido : null;
  const anios = aniosEntre(primeraFecha, hasta);

  const res = Ok({
    invertido: roundTo(invertido, 2),
    recuperado: roundTo(recuperado, 2),
    valorActual: roundTo(valor, 2),
    ganancia: roundTo(neto, 2),
    nFlujos: flujos.length,
    desde: primeraFecha, hasta,
    anios: anios === null ? null : roundTo(anios, 3),

    /* lo que hoy ensena la app */
    retornoSimple: simple === null ? null : roundTo(simple, 6),

    /* lo que de verdad le paso a tu dinero */
    irrAnual: rIrr.ok ? rIrr.value : null,
    irrError: rIrr.ok ? null : rIrr.error,

    /* TWR: se nombra y se explica por que no esta, en vez de aproximarlo */
    twr: null,
    twrRazon: "El TWR necesita el valor de la cartera en cada fecha de aporte, y eso no se registra. Aproximarlo aqui seria inventarlo.",
  });

  if (rIrr.ok && simple !== null && anios && anios > 0.08) {
    const brecha = rIrr.value - simple;
    res.value = Object.assign({}, res.value, {
      brecha: roundTo(brecha, 6),
      /* Con aportes repartidos, el retorno simple SIEMPRE queda por debajo del
         IRR (el dinero reciente no tuvo tiempo de trabajar). Cuanto mayor la
         brecha, mas te esta enganando la cifra simple. */
      brechaTexto: brecha > 0.005
        ? `El retorno simple te resta ${roundTo(brecha * 100, 2)} puntos porque divide por todo el dinero aportado, incluido el de la semana pasada.`
        : null,
    });
  }
  return res;
}

/* Retorno anualizado de UNA posicion con una sola compra. Exacto; para una
   posicion con varias compras hay que usar su propio IRR. */
export function cagr(valorInicial, valorFinal, anios) {
  const a = toNum(valorInicial), b = toNum(valorFinal), t = toNum(anios);
  if (a === null || b === null || t === null || a <= 0 || t <= 0) return null;
  if (b <= 0) return -1;
  return roundTo(Math.pow(b / a, 1 / t) - 1, 6);
}
