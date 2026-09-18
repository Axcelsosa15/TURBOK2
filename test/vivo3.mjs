import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const errs = []; const b = await chromium.launch();
const F = new Date('2026-09-17T14:00:00Z').getTime();
const SEM = { settings: { accounts: [{ id:'a1', firm:'Lucid', name:'LucidFlex 25K', kind:'Evaluación',
  size:25000, dd:1000, ddKind:'trailing_lock', limit:50, total:0, best:0, target:1500, status:'activa', ledger:[] }],
  rules: [], meta: {} } };
async function abrir() {
  const p = await (await b.newContext({ viewport:{width:1500,height:1300} })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
  await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
  await p.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(JSON.stringify(SEM))});}catch(e){}`);
  await p.goto('file://' + process.cwd() + '/preview.html'); await p.waitForTimeout(1200);
  return p;
}
async function op(p, id, exit) {
  await p.click('.tabbtn[data-tab="futuros"]'); await p.click('#ftNew'); await p.waitForTimeout(260);
  await p.fill('#ef_date','2026-09-17'); await p.fill('#ef_time','09:45');
  await p.fill('#ef_instrument','MNQ'); await p.fill('#ef_qty','2');
  await p.selectOption('#ef_accountId', id);
  await p.fill('#ef_entry','21000'); await p.fill('#ef_stop','20990'); await p.fill('#ef_exit', String(exit));
  await p.click('#edSave'); await p.waitForTimeout(650);
}
// Estado de la interfaz que el usuario tenía abierto
const estado = p => p.evaluate(() => ({
  riesgo:   !!document.querySelector('#riskForm') && !!document.getElementById('riskMeta')?.offsetParent,
  menu:     [...document.querySelectorAll('.acc-menu .menu')].some(m => !m.hidden),
  detalles: [...document.querySelectorAll('.rulec [aria-expanded="true"]')].length,
  journal:  !!document.querySelector('#acctJournal, .acc-journal:not([hidden])'),
  scrollY:  Math.round(window.scrollY),
  foco:     document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '(ninguno)',
}));

const p = await abrir();
const id = await p.evaluate(()=>document.querySelector('.acct').dataset.id);
await op(p, id, 21030);
await p.click('.tabbtn[data-tab="cabina"]').catch(()=>{}); await p.waitForTimeout(500);

console.log('══ abro paneles y pongo el foco en un sitio ══');
await p.click('.acct [data-act="risk"]'); await p.waitForTimeout(700);
await p.evaluate(()=>{ const i=document.getElementById('rk_risk'); if(i){i.focus(); i.scrollIntoView();} });
await p.waitForTimeout(300);
const antes = await estado(p);
console.log('  ' + JSON.stringify(antes));

console.log('\n══ entra una operación ══');
await op(p, id, 20990);
await p.click('.tabbtn[data-tab="cabina"]').catch(()=>{}); await p.waitForTimeout(800);
const despues = await estado(p);
console.log('  ' + JSON.stringify(despues));

console.log('\n══ VEREDICTO ══');
const filas = [
  ['calculadora de riesgo abierta', antes.riesgo, despues.riesgo],
  ['menú ••• abierto',             antes.menu,   despues.menu],
  ['posición de scroll',           antes.scrollY, despues.scrollY],
  ['elemento con el foco',         antes.foco,   despues.foco],
];
for (const [k, a, d] of filas) {
  const ok = String(a) === String(d);
  console.log(`  ${ok ? '✅' : '❌'} ${k.padEnd(32)} antes=${a}  después=${d}`);
}
console.log('\nerrores JS: ' + (errs.length ? errs.join('\n') : '0'));
await b.close();
