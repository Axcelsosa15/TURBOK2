import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { quieto, arrancada, trasGuardar, enDisco } from './espera.mjs';
const URL = 'file://' + process.cwd() + '/preview.html';
const errs = []; const b = await chromium.launch();
const say = (k, v) => console.log('  ' + String(k).padEnd(34) + v);
function wire(p, tag) {
  p.on('pageerror', e => errs.push(tag + ' PAGEERROR: ' + e.message));
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/ERR_CERT|ERR_CONNECTION|fonts|ERR_FILE/.test(t)) errs.push(tag + ' CONSOLE: ' + t); });
}
async function open(iso, seed) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage(); wire(p, '[' + (iso || 'now') + ']');
  if (seed) await p.addInitScript(seed);
  if (iso) { const F = new Date(iso).getTime();
    await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`); }
  /* Este 900 se ejecutaba OCHO veces —una por contexto— o sea 7,2 s del total.
     Se espera a que exista #checkList, que es lo primero que lee cualquiera de
     las secciones, y después a que el DOM se calme. */
  await p.goto(URL); await arrancada(p, '#checkList'); return p;
}

console.log('=== A. tabla de sesiones vs reloj ===');
for (const [iso, esp] of [['2026-09-15T13:00:00Z','NY AM'],['2026-09-15T16:30:00Z','Lunch'],['2026-09-15T19:00:00Z','NY PM'],['2026-09-15T20:30:00Z','Cierre'],['2026-09-15T22:00:00Z','Pausa'],['2026-09-16T01:00:00Z','Asia'],['2026-09-15T07:00:00Z','Londres'],['2026-09-15T11:45:00Z','Pre-mercado'],['2026-09-19T15:00:00Z','Cerrado']]) {
  const p = await open(iso);
  const o = await p.evaluate(() => ({ pill: document.getElementById('sessionLabel').textContent, chips: [...document.querySelectorAll('.seschip')].map(c => c.dataset.ses + (c.classList.contains('on') ? '*' : '') + (c.classList.contains('live') ? '●' : '')).join(' '), meta: document.getElementById('checkMeta').textContent }));
  say(iso.slice(11, 16) + 'Z → ' + esp, (o.pill + ' | ' + o.chips + ' | ' + o.meta).slice(0, 100));
  await p.context().close();
}

console.log('=== B. cada sesión guarda la suya ===');
const P = await open('2026-09-15T13:00:00Z');
const bx = () => P.locator('#checkList li input[type=checkbox]:not([data-f])');
say('pestañas:', await P.locator('.seschip').count());
say('activa al abrir:', await P.locator('.seschip.on').getAttribute('data-ses'));
await bx().nth(0).check(); await bx().nth(1).check(); await quieto(P);
say('NY AM tras 2 checks:', await P.textContent('#checkMeta'));
await P.click('.seschip[data-ses="asia"]'); await quieto(P);
say('Asia (debe estar a 0):', await P.textContent('#checkMeta'));
say('checkbox 0 en Asia:', await bx().nth(0).isChecked());
await bx().nth(3).check(); await quieto(P);
await P.click('.seschip[data-ses="nyam"]'); await quieto(P);
say('vuelve a NY AM:', await P.textContent('#checkMeta'));
say('checkbox 0 en NY AM:', await bx().nth(0).isChecked());
await P.click('#preSave'); await trasGuardar(P);
say('banner NY AM:', (await P.textContent('#preBanner')).replace(/\s+/g, ' ').slice(0, 72));
say('botón dice:', await P.textContent('#preSave').catch(() => '(oculto)'));
say('checkbox bloqueado en NY AM:', await bx().nth(4).isDisabled());
say('chips:', await P.evaluate(() => [...document.querySelectorAll('.seschip')].map(c => c.textContent.trim()).join(' | ')));
await P.click('.seschip[data-ses="asia"]'); await quieto(P);
say('Asia sigue editable:', !(await bx().nth(4).isDisabled()));
say('botón en Asia:', await P.textContent('#preSave'));
await P.click('#preSave'); await trasGuardar(P);
say('2 pre guardadas, chips:', await P.evaluate(() => [...document.querySelectorAll('.seschip')].map(c => c.textContent.trim()).join(' | ')));
say('columna Pre historial:', await P.evaluate(() => { const c = document.querySelector('#histWrap tbody tr td:nth-child(4)'); return c ? c.textContent.trim() + ' (' + c.title + ')' : '(sin filas)'; }));
/* persistDay escribe con 400 ms de debounce: recargar antes pierde las pres. */
await enDisco(P, d => d && d.days && Object.values(d.days).some(x => x.pres && Object.keys(x.pres).length >= 2));
await P.reload(); await arrancada(P, '#checkList');
say('tras recargar, chips:', await P.evaluate(() => [...document.querySelectorAll('.seschip')].map(c => c.textContent.trim()).join(' | ')));
await P.context().close();

console.log('=== C. migración de un día antiguo ===');
const viejo = () => { const K='cabina-mnq:v1'; const d={days:{}}; const hoy=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});
  d.days[hoy]={date:hoy,checks:{c1:true,c2:true},pre:{at:new Date('2026-09-15T13:10:00Z').getTime(),done:5,total:9,items:[]},result:80,closed:false,updatedAt:1};
  localStorage.setItem(K, JSON.stringify(d)); };
const M = await open('2026-09-15T13:30:00Z', viejo);
say('chips tras migrar:', await M.evaluate(() => [...document.querySelectorAll('.seschip')].map(c => c.textContent.trim()).join(' | ')));
say('banner:', (await M.textContent('#preBanner')).replace(/\s+/g, ' ').slice(0, 70));
say('estructura guardada:', await M.evaluate(() => { const d = JSON.parse(localStorage.getItem('cabina-mnq:v1')); const k = Object.keys(d.days)[0]; const x = d.days[k]; return 'pres=' + Object.keys(x.pres || {}).join(',') + ' checksBy=' + Object.keys(x.checksBy || {}).join(','); }));
await M.context().close();

console.log('=== D. trades por sesión ===');
const T = await open('2026-09-15T13:00:00Z');
const hoy = await T.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));
const ops = [['03:30', 21000, 21030], ['09:45', 21000, 21040], ['10:20', 21000, 20960], ['12:30', 21000, 21010], ['14:40', 21000, 20970], ['21:15', 21000, 21050]];
for (const [hora, ent, sal] of ops) {
  await T.click('.tabbtn[data-tab="futuros"]'); await T.click('#ftNew');
  await T.waitForSelector('#ef_entry', { timeout: 10000 }); await quieto(T);
  await T.fill('#ef_date', hoy); await T.fill('#ef_time', hora); await T.fill('#ef_instrument', 'MNQ'); await T.fill('#ef_qty', '2');
  await T.fill('#ef_entry', String(ent)); await T.fill('#ef_stop', '20980'); await T.fill('#ef_exit', String(sal));
  await T.click('#edSave'); await trasGuardar(T);
}
await quieto(T);
say('filtro de sesión:', await T.$$eval('#ftSes option', o => o.map(x => x.textContent).join(' / ')));
say('etiquetas en el journal:', await T.evaluate(() => [...document.querySelectorAll('#jrTable tbody tr')].map(r => r.children[2].textContent.trim()).join(' ')));
await T.click('#ftSeg button[data-v="analisis"]'); await quieto(T);
say('meta por sesión:', await T.textContent('#seMeta'));
say('tabla por sesión:', await T.evaluate(() => [...document.querySelectorAll('#seOut tbody tr')].map(r => [...r.children].slice(0, 5).map(c => c.textContent.trim()).join(' ')).join(' | ')));
say('veredicto:', (await T.textContent('#seOut .note-p')).slice(0, 130));
await T.click('#ftSeg button[data-v="diario"]'); await quieto(T);
say('grupos en el diario:', await T.evaluate(() => [...document.querySelectorAll('#dayBody tr.sesrow')].map(r => r.textContent.replace(/\s+/g, ' ').trim()).join(' || ')));
await T.selectOption('#ftSes', 'nyam'); await quieto(T);
say('filtrado a NY AM:', await T.evaluate(() => document.querySelectorAll('#jrTable tbody tr').length + ' filas'));
await T.selectOption('#ftSes', ''); await quieto(T);
await T.click('.tabbtn[data-tab="cabina"]'); await quieto(T);
say('desglose en Cabina:', await T.evaluate(() => [...document.querySelectorAll('#jSesBreak .jses')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | ')));
await T.context().close();

console.log('\n--- errores js ---'); console.log(errs.length ? errs.join('\n') : 'none');
await b.close();

console.log('=== E. columna Pre en el historial ===');
{
  const b2 = await chromium.launch();
  const ctx = await b2.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage(); wire(p, '[E]');
  const F = new Date('2026-09-15T13:00:00Z').getTime();
  await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
  await p.goto(URL); await arrancada(p, '#checkList');
  const bx = p.locator('#checkList li input[type=checkbox]:not([data-f])');
  const n = await bx.count();
  for (let i = 0; i < n; i++) await bx.nth(i).check();
  await p.click('#preSave'); await trasGuardar(p);
  await p.click('.seschip[data-ses="londres"]'); await quieto(p);
  await bx.nth(0).check(); await p.click('#preSave'); await trasGuardar(p);
  say('chips:', await p.evaluate(() => [...document.querySelectorAll('.seschip')].map(c => c.textContent.trim() + (c.classList.contains('done') ? '[ok]' : '')).join(' | ')));
  /* El handler de #jResult es síncrono (persistDay + renderDaySync), sin
     debounce: el repintado del historial llega en el mismo fanout. */
  await p.fill('#jResult', '150'); await trasGuardar(p);
  await enDisco(p, d => d && d.days && Object.values(d.days).some(x => x.result === 150));
  say('columna Pre:', await p.evaluate(() => { const c = document.querySelector('#histWrap tbody tr td:nth-child(4)'); return c ? c.textContent.trim() + ' · ' + c.className + ' · ' + c.title : '(sin filas)'; }));
  await enDisco(p, d => d && d.days && Object.values(d.days).some(x => x.pres && Object.keys(x.pres).length >= 2));
  await p.reload(); await arrancada(p, '#checkList');
  say('persiste:', await p.evaluate(() => { const c = document.querySelector('#histWrap tbody tr td:nth-child(4)'); return c ? c.textContent.trim() + ' · ' + c.title : '(sin filas)'; }));
  say('estructura en disco:', await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('cabina-mnq:v1')); const k = Object.keys(d.days)[0]; const x = d.days[k]; return 'pres=' + Object.keys(x.pres || {}).join(',') + ' checksBy=' + Object.keys(x.checksBy || {}).join(','); }));
  say('copia lleva las pres:', await p.evaluate(async () => { const el = document.getElementById('bkShow'); el.click(); await new Promise(r => setTimeout(r, 800)); const t = document.getElementById('ef_j').value; const b = JSON.parse(t); const d = Object.values(b.days)[0]; return 'pres=' + Object.keys(d.pres || {}).join(',') + ' checksBy=' + Object.keys(d.checksBy || {}).join(','); }));
  console.log('  errores E:', errs.filter(e => e.startsWith('[E]')).join(' | ') || 'none');
  await b2.close();
}
