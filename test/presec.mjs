import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL = 'file://' + process.cwd() + '/preview.html';
const errs = []; const b = await chromium.launch();
const say = (k, v) => console.log('  ' + String(k).padEnd(30) + v);
const p = await (await b.newContext({ viewport: { width: 1400, height: 1100 } })).newPage();
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/ERR_CERT|ERR_CONNECTION|fonts|ERR_FILE/.test(t)) errs.push('CONSOLE: ' + t); });
const F = new Date('2026-09-16T14:00:00Z').getTime();
await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
await p.goto(URL); await p.waitForTimeout(900);
const HOY = await p.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));

console.log('=== vacío ===');
await p.click('.tabbtn[data-tab="futuros"]'); await p.click('#ftSeg button[data-v="presesion"]'); await p.waitForTimeout(800);
say('tiles:', (await p.textContent('#prTiles')).replace(/\s+/g, ' ').slice(0, 110));
say('¿paga?:', (await p.textContent('#prPayWrap')).replace(/\s+/g, ' ').slice(0, 80));
say('pasos:', (await p.textContent('#prSteps')).replace(/\s+/g, ' ').slice(0, 80));

console.log('=== sembrar historial real por la UI ===');
// dos sesiones con pre completa (verdes), una a medias (roja), una sin pre (roja)
const escenarios = [
  { ses: 'nyam', marcar: 'todos', ops: [['09:50', 120]] },
  { ses: 'londres', marcar: 'todos', ops: [['03:30', 90]] },
  { ses: 'lunch', marcar: 2, ops: [['12:10', -70]] },
  { ses: 'nypm', marcar: null, ops: [['14:30', -110]] },
];
for (const e of escenarios) {
  await p.click('.tabbtn[data-tab="cabina"]'); await p.waitForTimeout(400);
  await p.click(`.seschip[data-ses="${e.ses}"]`); await p.waitForTimeout(300);
  if (e.marcar !== null) {
    const bx = p.locator('#checkList li input[type=checkbox]:not([data-f])');
    const n = await bx.count();
    const lim = e.marcar === 'todos' ? n : e.marcar;
    for (let i = 0; i < lim; i++) await bx.nth(i).check();
    await p.waitForTimeout(200); await p.click('#preSave'); await p.waitForTimeout(400);
  }
  for (const [hora, pnl] of e.ops) {
    await p.click('.tabbtn[data-tab="futuros"]'); await p.click('#ftNew'); await p.waitForTimeout(280);
    await p.fill('#ef_date', HOY); await p.fill('#ef_time', hora); await p.fill('#ef_instrument', 'MNQ'); await p.fill('#ef_qty', '1');
    await p.fill('#ef_entry', '21000'); await p.fill('#ef_stop', '20950'); await p.fill('#ef_exit', String(21000 + pnl / 2));
    await p.click('#edSave'); await p.waitForTimeout(400);
  }
}
await p.click('.tabbtn[data-tab="futuros"]'); await p.click('#ftSeg button[data-v="presesion"]'); await p.waitForTimeout(1000);
say('tiles:', (await p.textContent('#prTiles')).replace(/\s+/g, ' ').slice(0, 170));
say('meta ¿paga?:', await p.textContent('#prPayMeta'));
say('tabla ¿paga?:', await p.evaluate(() => [...document.querySelectorAll('#prPayOut tbody tr')].map(r => [...r.children].map(c => c.textContent.trim()).join(' ')).join(' | ')));
say('veredicto:', (await p.textContent('#prPayOut .note-p')).slice(0, 120));
say('meta pasos:', await p.textContent('#prStepMeta'));
say('paso más saltado:', await p.evaluate(() => { const r = document.querySelector('#prSteps tbody tr'); return r ? [...r.children].map(c => c.textContent.trim()).join(' · ').slice(0, 110) : '(vacío)'; }));
say('filas historial:', await p.locator('#prHist tbody tr').count());
say('1ª fila:', await p.evaluate(() => { const r = document.querySelector('#prHist tbody tr'); return r ? [...r.children].map(c => c.textContent.trim()).join(' | ').slice(0, 130) : '(vacío)'; }));
say('fila sin pre:', await p.evaluate(() => { const r = [...document.querySelectorAll('#prHist tbody tr')].find(x => /no se guardó/.test(x.textContent)); return r ? [...r.children].map(c => c.textContent.trim()).join(' | ').slice(0, 110) : '(ninguna)'; }));

console.log('=== filtros ===');
await p.selectOption('#prSes', 'nyam'); await p.waitForTimeout(400);
say('solo NY AM:', await p.locator('#prHist tbody tr').count() + ' filas · ' + await p.textContent('#prCount'));
await p.selectOption('#prSes', ''); await p.waitForTimeout(400);
say('persistencia tras recargar:', '');
await p.reload(); await p.waitForTimeout(1000);
await p.click('.tabbtn[data-tab="futuros"]'); await p.click('#ftSeg button[data-v="presesion"]'); await p.waitForTimeout(900);
say('filas tras recargar:', await p.locator('#prHist tbody tr').count());
console.log('\n--- errores js ---'); console.log(errs.length ? errs.join('\n') : 'none');
await b.close();
