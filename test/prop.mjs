/* FASE 1 · El contrato de la firma, por cuenta.

   La pregunta que esta prueba existe para responder: si tengo una LucidFlex con
   tope de $200 y una Apex con tope de $1.100, ¿la cabina le dice a cada una su
   número, o le enseña a las dos el mismo? Hasta hoy, el mismo — y el que se
   equivoca en la dirección peligrosa te quema la cuenta. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const errs = [], fallos = [];
const F = new Date('2026-09-18T14:00:00Z').getTime();
const b = await chromium.launch();

const CUENTA = (id, firm, name, size, dd, rules) => ({ id, firm, name, kind: 'Evaluación',
  size, dd, ddKind: 'trailing_lock', trailBase: 'intradia', limit: 50, total: 0, best: 0,
  target: 3000, status: 'activa', ledger: [], rules: rules || {} });

const SEM = { settings: { meta: { acct: 'lucid' },
  accounts: [
    CUENTA('lucid', 'Lucid Trading', 'LucidFlex 25K', 25000, 1000, { maxLoss: 200, maxContracts: 2, instruments: 'MNQ' }),
    CUENTA('apex',  'Apex Trader',   'Apex 50K',      50000, 2500, { maxLoss: 1100, maxContracts: 10, instruments: 'MNQ, MES' }),
    CUENTA('nueva', 'Sin verificar', 'Cuenta nueva',  50000, 0,    {}),
  ],
  rules: [
    { id: 'onlymnq',   kind: 'fixed', name: 'Solo MNQ', why: '', role: 'instrument', allow: 'MNQ' },
    { id: 'maxloss',   kind: 'num', name: 'Pérdida máxima del día', why: '', value: 200, prefix: '$', unit: '', role: 'maxLoss' },
    { id: 'maxlosses', kind: 'num', name: 'Pérdidas seguidas → cierre', why: '', value: 2, prefix: '', unit: 'ops', role: 'maxLosses' },
    { id: 'contracts', kind: 'num', name: 'Contratos máximos', why: '', value: 2, prefix: '', unit: 'MNQ', role: 'maxContracts' },
    /* Escrita en el protocolo pero SIN número: es el caso que hay que poder
       distinguir de «se cumple». Lucid y Apex tampoco la tienen en su contrato. */
    { id: 'maxgain',   kind: 'num', name: 'Tope de ganancia del día', why: '', value: 0, prefix: '$', unit: '', role: 'maxGain' },
  ] } };

const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 } });
const p = await ctx.newPage();
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
await p.addInitScript(`try{if(!localStorage.getItem('cabina-mnq:v1'))localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(JSON.stringify(SEM))});}catch(e){}`);
await p.goto('file://' + process.cwd() + '/preview.html');
await p.waitForTimeout(1300);

const ok = (c, t, d) => { console.log(`  ${c ? '✅' : '❌'} ${t}${d != null ? '   ' + d : ''}`); if (!c) fallos.push(t); };
const reglas = id => p.evaluate(i => FUT.evaluateRules(i), id);

console.log('\n═══ 1 · cada cuenta lee SU tope, no el del vecino ═══');
const l = await reglas('lucid'), a = await reglas('apex');
ok(l.dailyLossLimit === 200,  'LucidFlex: tope diario $200',  l.dailyLossLimit);
ok(a.dailyLossLimit === 1100, 'Apex: tope diario $1.100',     a.dailyLossLimit);
ok(l.maxContracts === 2 && a.maxContracts === 10, 'y cada una sus contratos máximos', `${l.maxContracts} / ${a.maxContracts}`);
ok(JSON.stringify(l.allowedInstruments) === '["MNQ"]' && a.allowedInstruments.includes('MES'),
   'y sus instrumentos', `${l.allowedInstruments} / ${a.allowedInstruments}`);

console.log('\n═══ 2 · −$600 en el mismo día: bloquea una y no la otra ═══');
const mete = (acct, usd, hora) => p.evaluate(([id, u, h]) => FUT.createTrade({
  accountId: id, instrument: 'MNQ', direction: 'long', qty: 1, date: '2026-09-18',
  time: h, entry: 21000, stop: 20990, exit: 21000 + u / 2 }), [acct, usd, hora]);
await mete('lucid', -600, '09:30'); await mete('apex', -600, '09:30');
await p.waitForTimeout(500);
const l2 = await reglas('lucid'), a2 = await reglas('apex');
ok(l2.status === 'LOCKED' && l2.canTrade === false, 'LucidFlex BLOQUEADA (−$600 sobre $200)', l2.status);
ok(a2.status !== 'LOCKED' && a2.canTrade === true, 'Apex sigue operable (−$600 sobre $1.100)', a2.status);
ok(a2.dailyLossRemaining === 500, 'y le quedan exactamente $500', a2.dailyLossRemaining);

console.log('\n═══ 3 · una regla sin escribir NO se presenta como cumplida ═══');
const n = await reglas('nueva');
ok(n.status === 'WARNING', 'cuenta sin contrato = AVISO, no LISTA', n.status);
ok(/falta escribir/i.test(n.reason), 'y dice qué falta, por su nombre', n.reason.slice(0, 96));
await p.evaluate(() => FUT.setSelectedAccount('nueva')); await p.waitForTimeout(500);
const sinConf = await p.evaluate(() => [...document.querySelectorAll('.rulec')]
  .map(x => x.querySelector('.rname').textContent.trim() + ' = ' + x.querySelector('.rst').textContent.trim())
  .filter(x => /SIN CONFIGURAR/.test(x)));
ok(sinConf.length === 1 && /ganancia/i.test(sinConf[0]), 'el panel marca SIN CONFIGURAR la que nadie escribe', sinConf.join(' · '));
const conValor = await p.evaluate(() => [...document.querySelectorAll('.rulec')]
  .filter(x => /Pérdida máxima/.test(x.querySelector('.rname').textContent))
  .map(x => x.querySelector('.rst').textContent.trim())[0]);
ok(!/SIN CONFIGURAR/.test(conValor || ''), 'y NO marca la que sí se hereda', conValor);

console.log('\n═══ 4 · lo heredado se dice, no se disfraza ═══');
await p.evaluate(() => FUT.updateAccount('nueva', { rules: { maxLoss: 300 } }));
await p.waitForTimeout(500);
const hered = await p.evaluate(() => [...document.querySelectorAll('.rulec')]
  .map(x => x.querySelector('.rname').textContent.trim() + ' → ' + x.querySelector('.rnow').textContent.trim()));
ok(hered.some(x => /seguidas.*del protocolo/i.test(x)), 'una regla heredada lleva «del protocolo»', hered.find(x => /protocolo/.test(x)) || hered.join(' | '));
ok(hered.some(x => /máxima del día.*\$300/.test(x)) && !hered.some(x => /máxima del día.*protocolo/.test(x)),
   'y la propia NO lo lleva', hered.find(x => /máxima del día/.test(x)));

console.log('\n═══ 5 · el contrato sobrevive al refresh ═══');
await p.waitForTimeout(900);
const guardado = await p.evaluate(() => localStorage.getItem('cabina-mnq:v1'));
const p2 = await ctx.newPage();
p2.on('pageerror', e => errs.push('PAGEERROR(2): ' + e.message));
await p2.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
await p2.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(guardado)});}catch(e){}`);
await p2.goto('file://' + process.cwd() + '/preview.html'); await p2.waitForTimeout(1300);
const tras = await p2.evaluate(() => ({ lucid: FUT.evaluateRules('lucid').dailyLossLimit,
  apex: FUT.evaluateRules('apex').dailyLossLimit, nueva: FUT.evaluateRules('nueva').dailyLossLimit }));
ok(tras.lucid === 200 && tras.apex === 1100 && tras.nueva === 300, 'los tres contratos vuelven enteros', JSON.stringify(tras));

console.log('\n═══ 6 · el editor escribe el contrato ═══');
await p.evaluate(() => FUT.setSelectedAccount('apex')); await p.waitForTimeout(400);
await p.click('.acct[data-id="apex"] button[data-act="cfg"]:visible'); await p.waitForTimeout(400);
ok(await p.isVisible('#ef_r_maxLoss'), 'el editor tiene el campo de pérdida máxima de la cuenta');
ok((await p.inputValue('#ef_r_maxLoss')) === '1100', 'con el valor de la cuenta cargado', await p.inputValue('#ef_r_maxLoss'));
await p.fill('#ef_r_maxLoss', '900');
await p.fill('#ef_r_verifiedAt', '2026-09-18');
await p.fill('#ef_r_url', 'https://apextraderfunding.com/rules');
await p.click('#edSave'); await p.waitForTimeout(500);
const trasEd = await p.evaluate(() => { const a = FUT.account('apex');
  return { tope: FUT.evaluateRules('apex').dailyLossLimit, ver: a.rules.verifiedAt, url: a.rules.url, sobra: Object.keys(a).filter(k => k.startsWith('r_')).length }; });
ok(trasEd.tope === 900, 'guardar cambia el tope de ESA cuenta', trasEd.tope);
ok(trasEd.ver === '2026-09-18' && /apextrader/.test(trasEd.url || ''), 'y guarda fecha de verificación y enlace', `${trasEd.ver} · ${trasEd.url}`);
ok(trasEd.sobra === 0, 'sin dejar campos r_* sueltos en la cuenta', trasEd.sobra);
ok((await reglas('lucid')).dailyLossLimit === 200, 'y NO toca el de la otra cuenta');

/* ═══ 7 · lo que el rediseño rompió sin que nadie lo notara ═══
   Tres defectos que vivieron un turno entero porque ninguna prueba pulsaba el
   chevrón ni miraba el estado EN VIVO de una regla. Van aquí para que no
   vuelvan: son exactamente la clase de fallo que se cuela al mover el DOM. */
console.log('\n═══ 7 · el panel de reglas, en vivo ═══');
/* Con Apex: lleva −$600 sobre un tope de $900, así que aún le queda margen y
   el texto del estado PUEDE cambiar. LucidFlex ya está en «tope alcanzado» y
   ahí ninguna pérdida más mueve la frase. */
await p.evaluate(() => FUT.setSelectedAccount('apex')); await p.waitForTimeout(500);
const antesNow = await p.evaluate(() => [...document.querySelectorAll('.rulec')]
  .filter(x => /Pérdida máxima/.test(x.querySelector('.rname').textContent))
  .map(x => x.querySelector('.rnow').textContent.trim())[0]);
// una pérdida más, SIN repintado completo: sólo paintRuleStates
await p.evaluate(() => FUT.createTrade({ accountId: 'apex', instrument: 'MNQ', direction: 'long',
  qty: 1, date: '2026-09-18', time: '13:00', entry: 21000, stop: 20990, exit: 20950 }));
await p.waitForTimeout(600);
const despuesNow = await p.evaluate(() => [...document.querySelectorAll('.rulec')]
  .filter(x => /Pérdida máxima/.test(x.querySelector('.rname').textContent))
  .map(x => x.querySelector('.rnow').textContent.trim())[0]);
ok(antesNow !== despuesNow, 'el estado de una regla se actualiza en vivo', `${antesNow} → ${despuesNow}`);

const chev = '.rulec:first-child .rtog';
ok(await p.evaluate(c => document.querySelector(c + ' ~ .rdet p, .rulec:first-child .rdet p').hidden, chev),
   'el «por qué» de una regla nace plegado');
await p.click(chev); await p.waitForTimeout(250);
ok(!(await p.evaluate(() => document.querySelector('.rulec:first-child .rdet p').hidden)), 'el chevrón lo abre');
ok((await p.evaluate(() => document.querySelector('.rulec:first-child .rtog').textContent.trim())) === '▸',
   'y sigue siendo un chevrón, no la palabra «Ocultar»',
   await p.evaluate(() => document.querySelector('.rulec:first-child .rtog').textContent.trim()));

const cab = await p.evaluate(() => document.querySelector('#rulesState').textContent.trim());
ok(/sin configurar/i.test(cab), 'la cabecera cuenta las SIN CONFIGURAR aparte de las activas', cab);

console.log('\n──────────────────────────────────────────');
console.log('  fallos:', fallos.length, fallos.length ? '→ ' + fallos.join(' · ') : '');
console.log('  errores JS:', errs.length, errs.length ? '\n   ' + errs.join('\n   ') : '');
await b.close();
process.exit(fallos.length || errs.length ? 1 : 0);
