/* BORRADO EN MASA · seleccionar y borrar varias cosas de una vez.

   Es la función más destructiva de la app y no hay servidor detrás: los datos
   viven en este navegador. Por eso lo que se comprueba aquí no es sólo que
   borre, sino las tres cosas que impiden que una equivocación sea definitiva:

     · la confirmación dice QUÉ cambia, no cuántas filas;
     · lo borrado vuelve entero, incluso después de recargar;
     · en masa sólo se borra lo que está EN PANTALLA. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { quieto, arrancada, trasGuardar } from './espera.mjs';
const errs = [], fallos = [];
const F = new Date('2026-09-17T14:00:00Z').getTime();
const b = await chromium.launch();
const ok = (c, t, d) => { console.log(`  ${c ? '✅' : '❌'} ${t}${d != null ? '   ' + d : ''}`); if (!c) fallos.push(t); };
const CUENTA = { id: 'a1', name: 'Apex', size: 50000, dd: 2500, ddKind: 'estatico', status: 'fondeada', ledger: [] };

async function pagina(semilla) {
  const p = await (await b.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
  await p.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(JSON.stringify(semilla))});}catch(e){}`);
  await p.goto('file://' + process.cwd() + '/preview.html'); await arrancada(p, '.tabbtn');
  return p;
}
const base = extra => Object.assign({ settings: { meta: {}, accounts: [CUENTA], rules: [] } }, extra || {});
const txt = (p, s) => p.textContent(s).then(x => x.replace(/\s+/g, ' ').trim());
const vivos = (p, host) => p.$$eval(`#${host} tr[data-id], #${host} tr[data-date], #${host} .card[data-id]`,
  n => n.filter(x => x.offsetParent !== null).length);

console.log('\n═══ el clic selecciona; borrar dice qué cambia ═══');
{
  const trades = {};
  for (let i = 0; i < 6; i++) trades['t' + i] = { id: 't' + i, type: 'futuros', accountId: 'a1', date: '2026-09-17',
    instrument: 'MNQ', direction: 'long', qty: 2, entry: 21000, stop: 20980, exit: 21000 + (i % 2 ? 30 : -20) };
  const p = await pagina(base({ trades }));
  await p.click('.tabbtn[data-tab="futuros"]'); await quieto(p);

  /* El journal vive en la sub-vista «Diario». Mientras miras «Resumen» sus
     filas existen en el DOM pero no en pantalla, y «Todo» habría marcado seis
     operaciones que no estás viendo. */
  ok(await p.evaluate(() => document.getElementById('selbtn-jrTable').disabled),
     'en «Resumen» el botón está apagado: el journal no está a la vista');
  await p.click('#ftSeg button[data-v="diario"]'); await quieto(p);
  await new Promise(r => setTimeout(r, 60));
  ok(!(await p.evaluate(() => document.getElementById('selbtn-jrTable').disabled)),
     'y se enciende al entrar en «Diario»');

  const bal0 = await p.evaluate(() => FUT.calculateAccountStats('a1').total);
  await p.click('#selbtn-jrTable'); await quieto(p);
  ok((await txt(p, '#selbtn-jrTable')) === 'Salir de selección', 'el botón se convierte en salida');
  await p.click('#jrTable tr[data-id]:nth-of-type(1)');
  await p.click('#jrTable tr[data-id]:nth-of-type(2)'); await quieto(p);
  ok(await p.$$eval('#jrTable tr.sel', n => n.length) === 2, 'el clic en la fila la marca, sin casillas');

  await p.click('[data-sel="borrar"]'); await quieto(p);
  const conf = await txt(p, '#selbar-jrTable');
  ok(/de resultado/.test(conf) && /Apex/.test(conf),
     'la confirmación dice el RESULTADO y la cuenta que mueve, no sólo «2 filas»', conf.slice(0, 80));

  await p.click('[data-sel="si"]'); await trasGuardar(p);
  ok(await vivos(p, 'jrTable') === 4, 'borra las 2 marcadas y deja las otras 4');
  const bal1 = await p.evaluate(() => FUT.calculateAccountStats('a1').total);
  ok(bal1 !== bal0, 'y el balance de la cuenta se mueve de verdad', `${bal0} → ${bal1}`);

  console.log('\n═══ lo borrado vuelve, incluso tras recargar ═══');
  ok(await p.evaluate(() => !!document.getElementById('papelera')), 'queda una barra con «Deshacer»');
  await p.reload(); await arrancada(p, '.tabbtn');
  ok(await p.evaluate(() => !!document.getElementById('papelera')),
     'que SOBREVIVE a recargar — un aviso que se va convierte «me equivoqué» en «ya no hay nada que hacer»');
  await p.click('[data-pap="undo"]'); await quieto(p);
  await p.click('.tabbtn[data-tab="futuros"]'); await quieto(p);
  await p.click('#ftSeg button[data-v="diario"]'); await quieto(p);
  ok(await vivos(p, 'jrTable') === 6, 'vuelven las 6 operaciones');
  ok(await p.evaluate(() => FUT.calculateAccountStats('a1').total) === bal0,
     'y el balance vuelve al que era, al céntimo', bal0);
  await p.context().close();
}

console.log('\n═══ un solo mecanismo para las cinco listas ═══');
/* Cinco selectores distintos serían, en tres turnos, cinco borrados que se
   comportan distinto: el mismo defecto que este repositorio persigue en los
   números, trasladado a la interfaz. */
const casos = [
  { n: 'inversiones', tab: 'invest', host: 'ivOps', espera: /desplegados|cobrados/,
    semilla: { positions: { pv: { id: 'pv', asset: 'VOO', market: 'etfs', current: 530 } },
      trades: { i1: { id: 'i1', type: 'inversion', asset: 'VOO', market: 'etfs', op: 'compra', date: '2026-02-01', qty: 4, price: 480 },
                i2: { id: 'i2', type: 'inversion', asset: 'VOO', market: 'etfs', op: 'dividendo', date: '2026-03-01', pnl: 60 } } } },
  { n: 'playbook', tab: 'playbook', host: 'pbCards', sub: '#pbNav .tabbtn[data-v="futuros"]', espera: /operación|operaciones|cita/,
    semilla: { playbooks: { p1: { id: 'p1', name: 'Setup C', kind: 'futuros', type: 'futuros', status: 'activo' },
                            p2: { id: 'p2', name: 'FVG', kind: 'futuros', type: 'futuros', status: 'activo' } },
      trades: { tz: { id: 'tz', type: 'futuros', accountId: 'a1', date: '2026-09-17', instrument: 'MNQ', direction: 'long', qty: 1, entry: 21000, stop: 20990, exit: 21020, setupId: 'p1' } } } },
  { n: 'ideas', tab: 'ideas', host: 'idCards', espera: /\d+ de \d+/,
    semilla: { ideas: { d1: { id: 'd1', name: 'Dropshipping', cat: 'online', status: 'idea' },
                        d2: { id: 'd2', name: 'Alquiler', cat: 'activos', status: 'idea' } } } },
  { n: 'sesiones', tab: 'cabina', host: 'histWrap', espera: /resultados/,
    semilla: { days: { '2026-09-10': { date: '2026-09-10', result: 120, trades: 2, closed: true },
                       '2026-09-11': { date: '2026-09-11', result: -40, trades: 1, closed: true } } } },
];
for (const c of casos) {
  const p = await pagina(base(c.semilla));
  await p.click(`.tabbtn[data-tab="${c.tab}"]`); await quieto(p);
  if (c.sub) { await p.click(c.sub); await quieto(p); }
  await new Promise(r => setTimeout(r, 80));
  const antes = await vivos(p, c.host);
  await p.click(`#selbtn-${c.host}`); await quieto(p);
  await p.click('[data-sel="todo"]'); await quieto(p);
  await p.click('[data-sel="borrar"]'); await quieto(p);
  const conf = await txt(p, `#selbar-${c.host}`);
  ok(c.espera.test(conf), `${c.n}: la confirmación dice qué se pierde`, conf.slice(8, 76));
  await p.click('[data-sel="si"]'); await trasGuardar(p);
  ok(await vivos(p, c.host) === 0, `${c.n}: borra las ${antes} seleccionadas`);
  await p.click('[data-pap="undo"]'); await quieto(p);
  await new Promise(r => setTimeout(r, 200));
  ok(await vivos(p, c.host) === antes, `${c.n}: y las ${antes} vuelven con «Deshacer»`);
  await p.context().close();
}

console.log('\n═══ en modo selección el clic NO hace otra cosa ═══');
{
  /* Mezclar «seleccionar» con «abrir el editor» o con la × de borrar una sola
     es exactamente como se borra lo que no se quería. */
  const p = await pagina(base({ trades: { t1: { id: 't1', type: 'futuros', accountId: 'a1', date: '2026-09-17', instrument: 'MNQ', direction: 'long', qty: 1, entry: 21000, stop: 20990, exit: 21020 } } }));
  await p.click('.tabbtn[data-tab="futuros"]'); await quieto(p);
  await p.click('#ftSeg button[data-v="diario"]'); await quieto(p);
  await new Promise(r => setTimeout(r, 60));
  await p.click('#selbtn-jrTable'); await quieto(p);
  await p.click('#jrTable tr[data-id]'); await quieto(p);
  ok(!(await p.evaluate(() => { const o = document.querySelector('.ov'); return o && o.classList.contains('open'); })),
     'pulsar una fila NO abre el editor');
  ok(await p.evaluate(() => { const b = document.querySelector('#jrTable tr[data-id] button'); return !b || getComputedStyle(b).pointerEvents === 'none'; }),
     'y los botones de la fila quedan inertes');
  await p.context().close();
}

console.log('\n──────────────────────────────────────────');
console.log('  fallos:', fallos.length, fallos.length ? '→ ' + fallos.join(' · ') : '');
console.log('  errores JS:', errs.length, errs.length ? '\n   ' + errs.join('\n   ') : '');
await b.close();
process.exit(fallos.length || errs.length ? 1 : 0);
