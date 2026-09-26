import { chromium } from 'playwright';
/* Apuntaba a una ruta ABSOLUTA del scratchpad. Ese archivo existía, así que
   el test pasaba en verde — midiendo una copia congelada de la app. Cuando se
   descubrió llevaba seis días sin regenerarse: 141 KB menos, sin posPerf, sin
   INV, sin TES, sin el arreglo del IRR. Verde sobre código que ya no existía.
   La ruta se deriva del sitio desde el que se corre, como los otros 36. */
const URL = 'file://' + process.cwd() + '/preview.html';
const errs = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/ERR_CONNECTION|fonts|_blob|ERR_FILE/.test(t)) errs.push('CONSOLE: ' + t); });
await page.addInitScript(() => {
  window.claude = { use: async n => n === 'assets' ? { upload: async () => ({ id: 'a1' }), delete: async () => {} }
    : n === 'permissions' ? { state: async () => 'granted', request: async ns => Object.fromEntries((ns||[]).map(x => [x,'granted'])) } : null };
});
await page.goto(URL); await page.waitForTimeout(700);
console.log('=== ESTADO VACÍO (usuario nuevo) ===');
const scan = () => page.evaluate(() => {
  const out = [];
  document.querySelectorAll('.tab.active, .ftview.active').forEach(root => {
    root.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
      const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
      if (/undefined|NaN|\[object|Infinity/.test(own)) out.push(el.tagName + '.' + String(el.className).slice(0,28) + ' :: ' + own.trim().slice(0,80));
    });
  });
  return out;
});
for (const [tab, sub] of [['cabina',null],['futuros','resumen'],['futuros','cuentas'],['futuros','analisis'],['futuros','diario'],['invest',null],['playbook',null],['ideas',null],['calc',null]]) {
  await page.click(`.tabbtn[data-tab="${tab}"]`); await page.waitForTimeout(200);
  if (sub) { await page.click(`#ftSeg button[data-v="${sub}"]`); await page.waitForTimeout(300); }
  const bad = await scan();
  console.log(`${tab}${sub?'/'+sub:''}:`, bad.length ? bad.slice(0,5).join(' | ') : 'ok');
}
console.log('\n=== CALCULADORA: casos límite ===');
await page.click('.tabbtn[data-tab="calc"]'); await page.waitForTimeout(250);
for (const [y, p, c, r] of [[1,1000,200,10],[60,0,0,0],[10,0,100,0],[1,100,0,50]]) {
  await page.fill('#cc_y', String(y)); await page.fill('#cc_p', String(p)); await page.fill('#cc_c', String(c)); await page.fill('#cc_r', String(r));
  await page.waitForTimeout(250);
  const hero = (await page.textContent('#ccHero')).replace(/\s+/g,' ');
  const note = (await page.textContent('#ccNote')).replace(/\s+/g,' ');
  console.log(`  y=${y} p=${p} c=${c} r=${r}% -> ${hero.slice(0,70)} || nota: ${note.slice(0,95)}`);
}
await page.click('#calcSeg button[data-v="risk"]'); await page.waitForTimeout(400);
console.log('  riesgo hero:', (await page.textContent('#riskHero')).replace(/\s+/g,' ').slice(0,120));
await page.fill('#rk_stop', '0'); await page.waitForTimeout(300);
console.log('  stop=0 ->', (await page.textContent('#riskOut')).replace(/\s+/g,' ').slice(0,120));
await page.fill('#rk_stop', '15'); await page.fill('#rk_dd', '0'); await page.waitForTimeout(300);
console.log('  dd=0 ->', (await page.textContent('#riskMeta')).replace(/\s+/g,' ').slice(0,110));
console.log('\n--- errores js ---'); console.log(errs.length ? errs.join('\n') : 'none');
await browser.close();
