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

console.log('\n──────────────────────────────────────────');
console.log('  fallos:', fallos.length, fallos.length ? '→ ' + fallos.join(' · ') : '');
process.exit(fallos.length ? 1 : 0);
