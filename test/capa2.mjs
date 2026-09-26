/* Guardián de arquitectura. No abre el navegador: lee el archivo.

   El README afirma cosas —«una sola definición de cada cálculo», «nadie
   recalcula el P&L a mano»— y una afirmación que nadie comprueba deja de ser
   cierta en cuanto alguien tiene prisa. Esto la comprueba en 40 ms.

   Lo que vigila no es el estilo: es que no vuelva a existir una SEGUNDA
   implementación de un número. Esta sesión ya borró una tabla MULT duplicada,
   un segundo umbral de riesgo, un segundo generador aleatorio y un segundo
   Monte Carlo. Volverían solos. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
/* Sin comentarios. La primera versión de este guardián marcaba como duplicado un
   comentario que dice «nunca calcules el P&L así»: buscaba nombres en el texto,
   no implementaciones. Un guardián que falla siempre acaba ignorado, que es peor
   que no tenerlo. */
const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const fallos = [];
const ok = (cond, etiqueta, detalle) => {
  console.log(`  ${cond ? '✅' : '❌'} ${etiqueta}${detalle != null ? '   ' + detalle : ''}`);
  if (!cond) fallos.push(etiqueta);
};
const defs = n => (src.match(new RegExp('^  function ' + n + '\\(', 'gm')) || []).length;
// llamadas, sin contar la línea que la define
const llamadas = n => (codigo.match(new RegExp('[^A-Za-z.$_]' + n + '\\(', 'g')) || []).length - defs(n);
// el cuerpo de una función declarada en el primer nivel del IIFE
const cuerpoDe = n => (codigo.match(new RegExp('^  function ' + n + '\\([\\s\\S]*?\\n  \\}$', 'm')) || [''])[0];

console.log('\n═══ 1 · UNA definición por cálculo ═══');
for (const f of ['tradeCalc', 'acctAgg', 'acctAggCrudo', 'consistency', 'futStats', 'futStatsCrudo',
                 'tradesOf', 'tradesDe', 'futFiltered', 'dayRuleCheck', 'evaluateAccountRules',
                 'ddEngine', 'consEngine', 'riskEngine', 'acctToday', 'posLotes', 'investStats']) {
  const n = defs(f);
  ok(n === 1, f.padEnd(22), n === 1 ? '' : `${n} definiciones`);
}

console.log('\n═══ 2 · nadie se salta la memoria ═══');
/* Los *Crudo son el cálculo caro. Sólo su envoltorio memorizado debe llamarlos:
   una llamada directa recalcula la curva entera de una cuenta sin necesidad. */
for (const crudo of ['acctAggCrudo', 'futStatsCrudo']) {
  const n = llamadas(crudo);
  ok(n === 1, `${crudo} se llama sólo desde su memoria`, `${n} llamada(s)`);
}

console.log('\n═══ 3 · la puerta única existe entera ═══');
const FUNCIONES = ['calculateAccountStats', 'calculateTradeStats', 'calculateDailyStats', 'calculateDrawdown',
  'calculateConsistency', 'calculateExpectancy', 'calculateProfitFactor', 'calculateWinRate', 'calculateStreaks',
  'calculateEquityCurve', 'calculateRiskState', 'calculateConcentration', 'calculateProtocolCompliance',
  'calculateSQN', 'calculateRMultipleStats', 'evaluateRules', 'setSelectedAccount', 'selectedAccountId',
  'setFilters', 'createTrade', 'updateTrade', 'deleteTrade', 'createAccount', 'updateAccount', 'deleteAccount', 'updateRule'];
const faltan = FUNCIONES.filter(f => !new RegExp('^    ' + f + '\\(', 'm').test(src));
ok(faltan.length === 0, `las ${FUNCIONES.length} funciones de FUT`, faltan.length ? 'faltan: ' + faltan.join(', ') : '');

console.log('\n═══ 4 · ningún número con DOS implementaciones ═══');
/* La pregunta no es «¿existe este nombre?» sino «¿hace este nombre la cuenta por
   su cuenta?». MULT existe y está bien: es una vista de sólo lectura derivada de
   QE.CONTRACTS. riskThreshold existe y está bien: delega en QE.sueloPara. Lo que
   no puede volver es que CALCULEN. */
const DELEGAN = [
  ['MULT', /const\s+MULT\s*=\s*Object\.freeze\([\s\S]{0,120}QE\.CONTRACTS/, 'derivarse de QE.CONTRACTS'],
  ['riskThreshold', /QE\.sueloPara/, 'llamar a QE.sueloPara'],
  ['streakProb', /QE\.probabilidadDeRacha/, 'llamar a QE.probabilidadDeRacha'],
  ['tradeCalc', /QE\.calcularTradeApp/, 'llamar a QE.calcularTradeApp'],
];
for (const [nombre, re, debe] of DELEGAN) {
  const cuerpo = nombre === 'MULT' ? (codigo.match(/const\s+MULT\s*=.*/) || [''])[0] : cuerpoDe(nombre);
  ok(cuerpo !== '' && re.test(cuerpo), `${nombre} sigue delegando`, cuerpo === '' ? 'no existe' : re.test(cuerpo) ? '' : 'ya no ' + debe);
}
/* El suelo de la cuenta y el P&L de una operación son los dos números que más
   veces se han duplicado aquí. Que nadie los escriba a mano otra vez. */
const AMANO = [
  ['P&L a mano con multiplicador', /\(\s*(?:exit|salida)\s*-\s*(?:entry|entrada)\s*\)\s*\*/],
  ['suelo a mano fuera de acctAgg/riskThreshold', /(?:peak|pico)\s*-\s*(?:dd|ddMaximo)\b/g],
  ['dataset separado para Cabina', /cabinaTrades|cabinaAccounts|CabinaTrade/],
  ['dataset separado para Futuros', /futuresTrades|futuresAccounts|FuturesTrade/],
];
for (const [nombre, re] of AMANO) {
  if (nombre.startsWith('suelo')) {
    /* acctAggCrudo lo usa como reserva cuando el motor no puede dar suelo (sin
       drawdown configurado), y riskThreshold igual. Fuera de esos dos, no. */
    const permitidos = cuerpoDe('acctAggCrudo') + cuerpoDe('riskThreshold');
    const total = (codigo.match(re) || []).length;
    const dentro = (permitidos.match(re) || []).length;
    ok(total === dentro, `sin ${nombre}`, `${total} usos, ${dentro} en los dos sitios permitidos`);
  } else ok(!re.test(codigo), `sin ${nombre}`);
}

console.log('\n═══ 5 · las memorias llevan en la clave todo lo que leen ═══');
/* Una clave incompleta es un número rancio con fecha de caducidad desconocida.
   Se comprueba que cada memoria mencione la revisión de la colección. */
for (const [nombre, re] of [
  ['tradesOf', /_tradesMemo[\s\S]{0,400}?c\.rev/],
  ['tradesDe', /function tradesDe[\s\S]{0,400}?coll\("trades"\)\.rev/],
  ['acctAgg', /function acctAgg\([\s\S]{0,500}?coll\("trades"\)\.rev/],
  ['futFiltered', /function futFiltered\([\s\S]{0,500}?coll\("trades"\)\.rev/],
]) ok(re.test(src), `la memoria de ${nombre} depende de coll("trades").rev`);
/* La huella de la cuenta debe incluir TODO campo que acctAggCrudo lee de ella. */
const cuerpo = cuerpoDe('acctAggCrudo').replace(/curva\./g, 'CURVA.');
const leidos = [...new Set([...cuerpo.matchAll(/\ba\.([a-zA-Z]+)/g)].map(m => m[1]))].filter(x => x !== 'id');
const huella = (codigo.match(/JSON\.stringify\(\[a\.[^\]]*\]\)/) || [''])[0];
const fuera = leidos.filter(f => !huella.includes('a.' + f));
ok(fuera.length === 0, 'la huella cubre todo lo que acctAgg lee de la cuenta',
   fuera.length ? 'fuera de la huella: ' + fuera.join(', ') : leidos.join(', '));

console.log('\n═══ 6 · inversiones: un rendimiento, una fuente ═══');
/* Esta sección existe porque el guardián no la tenía y el defecto salió en una
   captura de pantalla, dos veces. La misma SCHD aparecía al 6,0% en la tabla y
   al 2,0% en el gráfico de al lado; la tarjeta «Realizado» enseñaba $400 donde
   había $508.57; y la tarjeta del IRR ponía un retorno simple junto a una
   brecha medida contra OTRO retorno simple.

   Todos son el mismo error: un número con dos implementaciones. Lo que sigue
   comprueba que cada vista del rendimiento pase por la misma puerta. */
ok(defs('posPerf') === 1, 'posPerf'.padEnd(22), defs('posPerf') === 1 ? '' : defs('posPerf') + ' definiciones');

for (const [quien, que] of [
  ['tablaPosiciones', 'la fila de cada posición'],
  ['renderIvPerf',    'el gráfico de rendimiento por posición'],
]) {
  const c = cuerpoDe(quien);
  ok(c !== '' && /posPerf\(/.test(c), `${quien} mide con posPerf`,
     c === '' ? 'no existe' : /posPerf\(/.test(c) ? '' : `${que} calcula por su cuenta`);
}

const iv = cuerpoDe('investStats');
ok(/cartera\s*&&\s*cartera\.retornoSimple/.test(iv),
   'el retorno simple de la cartera es el del motor',
   /retornoSimple/.test(iv) ? '' : 'investStats volvió a calcular el suyo');
ok(/tipo:\s*"dividendo",\s*monto:\s*\(Number\(t\.pnl\)/.test(iv),
   'los dividendos entran en los flujos con su importe (t.pnl)',
   /t\.pnl/.test(iv) ? '' : 'un dividendo sin qty ni price da monto 0 y se pierde');
ok(/tipo:\s*"venta",\s*monto:\s*bruto\s*-\s*fe/.test(iv),
   'la comisión de una venta resta, no suma');
ok(/l\.ops\.forEach\(t => contadas\.add/.test(iv),
   'la cartera marca lo que ya contó una posición derivada',
   'sin esa marca, una venta se cuenta dos veces');

const INVF = ['positions', 'position', 'transactions', 'markets', 'createTransaction', 'updateTransaction',
  'deleteTransaction', 'createPosition', 'updatePosition', 'deletePosition', 'performance', 'portfolio'];
const sinInv = INVF.filter(f => !new RegExp('^    ' + f + '\\(|^    ' + f + ':', 'm').test(src));
ok(sinInv.length === 0, `las ${INVF.length} funciones de INV`, sinInv.length ? 'faltan: ' + sinInv.join(', ') : '');

console.log('\n═══ 7 · tesis: se escribe el precio, se deriva el resto ═══');
/* La plantilla original pide a mano capital, riesgo $, tamaño, R:R y la R del
   cierre. Cabina calcula las cinco, y un campo para escribirlas volvería a
   crear dos fuentes para una cifra. Esto vigila que no vuelvan. */
ok(defs('tesisCalc') === 1, 'tesisCalc'.padEnd(22), defs('tesisCalc') === 1 ? '' : defs('tesisCalc') + ' definiciones');

for (const quien of ['tsDerivHtml', 'renderTesis', 'tsAbrirOperacion']) {
  const c = cuerpoDe(quien);
  ok(c !== '' && /tesisCalc\(/.test(c), `${quien} mide con tesisCalc`,
     c === '' ? 'no existe' : /tesisCalc\(/.test(c) ? '' : 'calcula por su cuenta');
}

const secs = cuerpoDe('tsSecciones');
for (const prohibido of ['rr', 'riesgoUsd', 'tamano', 'tamaño', 'distancia', 'rFinal'])
  ok(!new RegExp('f\\("' + prohibido + '"').test(secs),
     `sin campo para escribir «${prohibido}» a mano`);
ok(/f\("capital"/.test(secs) && /f\("riesgoPct"/.test(secs),
   'sí se escriben capital y riesgo %, que son decisiones, no cálculos');

const tc = cuerpoDe('tesisCalc');
/* El motor YA dimensiona futuros, y mejor: en la rejilla de ticks, en céntimos
   enteros, truncando contratos y diciendo cuánto riesgo queda sin usar. Yo
   había escrito riesgo / (puntos × multiplicador), que es una segunda
   implementación del mismo número y encima ignora el tick. */
ok(/QE\.dimensionar\(/.test(tc), 'un futuro se dimensiona con QE.dimensionar, no a mano',
   /QE\.dimensionar/.test(tc) ? '' : 'tesisCalc volvió a dimensionar por su cuenta');
ok(/QE\.rootOf\(/.test(tc), 'y el símbolo se resuelve con QE.rootOf (códigos de mes incluidos)');
ok(!/MULT\[act\]/.test(tc), 'sin leer MULT a pelo: el contrato entero viene del motor');

/* Nueve tipos, nueve aritméticas. Que ninguna se pierda. */
const TIPOS = ['accion', 'etf', 'crypto', 'perpetuo', 'fx', 'futuro', 'opcion', 'bono', 'commodity'];
const tabla = (codigo.match(/const TS_TIPO_DEF = \{[\s\S]*?\n  \};/) || [''])[0];
const faltanT = TIPOS.filter(t => !new RegExp('^\\s*' + t + ':', 'm').test(tabla));
ok(faltanT.length === 0, `los ${TIPOS.length} tipos tienen aritmética propia`,
   faltanT.length ? 'faltan: ' + faltanT.join(', ') : '');
for (const base of ['ticks', 'prima', 'pips', 'par'])
  ok(new RegExp('def\\.base === "' + base + '"').test(tc), `tesisCalc distingue la base «${base}»`);
ok(/opDir === "vendida"/.test(tc) && /sinTecho/.test(tc),
   'una opción vendida sin cobertura no recibe un tamaño inventado');
ok(/def\.entera \? Math\.floor/.test(tc),
   'el tamaño se trunca sólo en los tipos enteros; cripto y FX se fraccionan');
ok(/coll\("trades"\)\.get\(t\.tradeId\)/.test(tc) && /tradeCalc\(/.test(tc),
   'la R del post-mortem sale de la operación vía tradeCalc');
ok(/stopAlReves/.test(tc) && /porUnidad <= 0/.test(tc),
   'un stop del lado equivocado se detecta, no se convierte en R negativa');

const TESF = ['all', 'get', 'sections', 'create', 'update', 'remove', 'addNote', 'calc', 'progress'];
const sinTes = TESF.filter(f => !new RegExp('^    ' + f + '\\(', 'm').test(src));
ok(sinTes.length === 0, `las ${TESF.length} funciones de TES`, sinTes.length ? 'faltan: ' + sinTes.join(', ') : '');

/* El puente no puede redondear por su cuenta el tamaño de un futuro: medio
   contrato no existe, y un Math.round dejaría el riesgo por encima del planeado. */
/* El truncado vive en tesisCalc, que es quien sabe si el tipo fracciona. El
   puente sólo pasa el número: redondear otra vez aquí sería una segunda regla
   de tamaño, y al alza pondría más riesgo del que autorizaste. */
const puente = cuerpoDe('tsAbrirOperacion');
ok(!/Math\.(floor|round|ceil)/.test(puente),
   'el puente NO redondea: el tamaño ya viene decidido por el tipo',
   /Math\./.test(puente) ? 'volvió a redondear por su cuenta' : '');

console.log('\n═══ 8 · ningún var(--x) que no exista ═══');
/* Un token de color mal escrito NO falla: `background: var(--warning-soft)` con
   ese token sin definir se queda transparente y la regla no pinta nada. Escribí
   --positive-soft, --negative-soft y --warning-soft cuando los tokens se llaman
   --good-soft, --bad-soft y --warn-soft. Seis usos, tres reglas invisibles, y
   sólo se vio en una captura: el aviso del post-mortem salía sin recuadro.

   Un fallo que no deja hueco es el más caro de todos, así que aquí se mira el
   CSS entero y no sólo lo que acabo de tocar. */
const css = (src.match(/<style>([\s\S]*?)<\/style>/g) || []).join('\n');
const definidos = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
/* Los que llegan de fuera del CSS: el navegador, o una variable puesta por JS. */
const DEL_NAVEGADOR = new Set(['--safe-b', '--safe-t']);
const usados = [...new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(m => m[1]))];
/* var(--x, algo) lleva su propio respaldo: si falta el token, cae ahí a propósito. */
const conRespaldo = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/gi)].map(m => m[1]));
const jsPone = new Set([...src.matchAll(/setProperty\(\s*["'](--[a-z0-9-]+)/gi)].map(m => m[1]));
const huerfanos = usados.filter(v => !definidos.has(v) && !conRespaldo.has(v) && !DEL_NAVEGADOR.has(v) && !jsPone.has(v));
ok(huerfanos.length === 0, `los ${usados.length} tokens usados existen`,
   huerfanos.length ? 'sin definir: ' + huerfanos.join(', ') : '');

console.log('\n═══ 9 · ningún test mide una copia congelada ═══');
/* Siete tests apuntaban a una ruta ABSOLUTA de un scratchpad en vez de al
   preview que se reconstruye. El archivo existía, así que pasaban en verde —
   sobre una copia de la app de hacía seis días: 141 KB menos, sin posPerf, sin
   INV, sin TES, sin QE.dimensionar, sin el arreglo del IRR. Cuatro veces
   anuncié «suite 42/42» con siete tests midiendo código que ya no existía.

   Uno de ellos llevaba seis días imprimiendo «cuenta en Cabina del journal:
   undefined» sin que nadie lo mirara.

   Un test verde sobre el archivo equivocado es peor que un test rojo: el rojo
   se arregla. */
import { readdirSync, readFileSync as leer } from 'node:fs';
const dirTest = join(dirname(fileURLToPath(import.meta.url)));
const tests = readdirSync(dirTest).filter(f => f.endsWith('.mjs') && f !== 'sync-index.mjs' && f !== 'build-preview.mjs');
const conRutaFija = [];
for (const f of tests) {
  const t = leer(join(dirTest, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* Sólo se permite derivar la ruta de dónde se corre. Cualquier absoluta que
     no venga de process.cwd() es una copia que nadie regenera. */
  for (const m of t.matchAll(/'file:\/\/\/[^']*'|"file:\/\/\/[^"]*"/g)) conRutaFija.push(`${f}: ${m[0].slice(0, 60)}`);
}
ok(conRutaFija.length === 0, `los ${tests.length} tests derivan su ruta de process.cwd()`,
   conRutaFija.length ? conRutaFija.slice(0, 5).join(' · ') : '');

/* Lo mismo con las dependencias. 44 archivos importaban Playwright por la ruta
   absoluta de un contenedor concreto: el repositorio es público y nadie que lo
   clonara podía correr un solo test. Un import desnudo lo resuelve npm, aquí y
   en CI. */
const porRutaAbsoluta = [];
for (const f of tests) {
  const t = leer(join(dirTest, f), 'utf8');
  for (const m of t.matchAll(/from\s+['"](\/[^'"]+)['"]/g)) porRutaAbsoluta.push(`${f}: ${m[1].slice(0, 46)}`);
}
ok(porRutaAbsoluta.length === 0, 'ninguna dependencia se importa por ruta absoluta',
   porRutaAbsoluta.length ? porRutaAbsoluta.slice(0, 3).join(' · ') + ' — usa el nombre del paquete' : 'se resuelven por node_modules');

/* Y que el preview contra el que corren sea el de AHORA, no uno de ayer. */
const prev = join(dirTest, 'preview.html');
const idx = leer(join(dirTest, '..', 'index.html'), 'utf8');
const pv = leer(prev, 'utf8');
const marcas = ['posPerf', 'tesisCalc', 'window.INV', 'window.TES', 'QE.dimensionar'];
const ausentes = marcas.filter(m => idx.includes(m) && !pv.includes(m));
ok(ausentes.length === 0, 'preview.html está reconstruido desde el index.html actual',
   ausentes.length ? 'falta en el preview: ' + ausentes.join(', ') + ' — corre build-preview.mjs' : '');

console.log('\n═══ 10 · nadie recarga antes de que el disco tenga el dato ═══');
/* `persistDay()` escribe el día con `debounce("day", fn, 400)`. Un test que
   cambia el día y recarga 400 ms después pierde lo guardado SIN un solo error:
   sale «sin filas» y localStorage devuelve null. Me pasó convirtiendo
   sesiones.mjs y no lo vi venir, porque busqué diferidos como `setTimeout(…,N)`
   literales y este pasa el 400 como argumento de `debounce`.

   Hoy ninguno está por debajo, pero el margen es de 100 ms sobre 400. Bajo
   carga eso se voltea, y lo haría de forma intermitente. O se espera de sobra,
   o se espera al DATO con `enDisco`. */
const lineas = f => leer(join(dirTest, f), 'utf8').split('\n');
const flojos = [];
for (const f of tests) {
  const ls = lineas(f);
  let ultima = null, dondeLa = -1;
  ls.forEach((l, i) => {
    const m = [...l.matchAll(/waitForTimeout\((\d+)\)/g)];
    if (m.length) { ultima = Number(m[m.length - 1][1]); dondeLa = i; }
    if ((/\.reload\(\)/.test(l) || /localStorage\.getItem/.test(l)) && ultima !== null && i - dondeLa <= 2 && ultima < 600)
      flojos.push(`${f}:${i + 1} (${ultima} ms)`);
  });
}
ok(flojos.length === 0, 'ninguna recarga ni lectura de disco con <600 ms detrás',
   flojos.length ? flojos.slice(0, 4).join(' · ') + ' — usa enDisco()' : `hay dos debounces: el día 400 ms, los ajustes 500 ms`);

console.log('\n═══ 11 · el borrado en masa pasa por una sola puerta ═══');
/* Borrar una cuenta tenía TRES implementaciones: la fachada FUT.deleteAccount,
   el menú de la tarjeta y el editor. Las dos últimas hacían su propio
   `arr.splice` sin limpiar el filtro, y por la del menú `meta.acct` se quedaba
   en disco apuntando a la cuenta muerta. En la operación más destructiva de la
   app, tres versiones que no hacen lo mismo. */
/* Se vigilan las RETIRADAS, no cualquier splice: `splice(i, 1)` saca, y
   `splice(pos, 0, copia)` mete — que es lo que hace deshacer al devolver una
   cuenta a su sitio. La primera versión de esta regla marcaba las dos y
   señalaba como defecto el propio arreglo. */
const quita = (codigo.match(/state\.settings\.accounts\.splice\([^,]+,\s*1\s*\)|accounts\.filter\(x => x\.id !== /g) || []);
ok(quita.length === 0, 'nadie saca una cuenta del array por su cuenta',
   quita.length ? `${quita.length} fuera de FUT.deleteAccount: ${quita[0].slice(0, 50)}` : 'sólo FUT.deleteAccount');
for (const quien of ['avisaHuerfanas', 'selBorra', 'deshaceBorrado', 'pintaSel', 'guardaPapelera'])
  ok(defs(quien) === 1, `${quien}`.padEnd(22), defs(quien) === 1 ? '' : defs(quien) + ' definiciones');

const sb = cuerpoDe('selBorra');
ok(/FUT\.deleteAccount/.test(sb), 'el borrado en masa de cuentas pasa por la fachada, no por splice');
/* El orden importa: guardar DESPUÉS de borrar deja sin vuelta atrás si algo
   falla a mitad. */
const iGuarda = sb.indexOf('guardaPapelera('), iBorra = Math.min(...['deleteAccount(', 'coll(val(L.col)).remove', 'delete d.days'].map(t => { const k = sb.indexOf(t); return k < 0 ? 1e9 : k; }));
ok(iGuarda >= 0 && iGuarda < iBorra, 'guarda en la papelera ANTES de tocar nada',
   iGuarda >= 0 && iGuarda < iBorra ? '' : 'guarda después: si falla el borrado no hay vuelta atrás');

const bl = cuerpoDe('borrables');
for (const lista of ['jrTable', 'ivOps', 'pbCards', 'idCards', 'histWrap', 'accts'])
  ok(new RegExp(`id: "${lista}"`).test(bl), `la lista «${lista}» está registrada`);
ok(/offsetParent !== null/.test(cuerpoDe('selFilas')),
   'sólo se borra en masa lo que está EN PANTALLA',
   'sin esto, «Todo» marca filas que el usuario no está viendo');

/* La papelera es la red. Si deja de persistir, «deshacer» se convierte en un
   botón que sólo funciona si no recargas. */
ok(/localStorage\.setItem\(PAPELERA/.test(codigo) && /localStorage\.getItem\(PAPELERA\)/.test(codigo),
   'la papelera se guarda en disco: deshacer sobrevive a recargar');

console.log('\n──────────────────────────────────────────');
console.log('  fallos:', fallos.length, fallos.length ? '→ ' + fallos.join(' · ') : '');
process.exit(fallos.length ? 1 : 0);
