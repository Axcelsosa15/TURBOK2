import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* Apuntaba a una ruta ABSOLUTA del scratchpad. Ese archivo existía, así que
   el test pasaba en verde — midiendo una copia congelada de la app. Cuando se
   descubrió llevaba seis días sin regenerarse: 141 KB menos, sin posPerf, sin
   INV, sin TES, sin el arreglo del IRR. Verde sobre código que ya no existía.
   La ruta se deriva del sitio desde el que se corre, como los otros 36. */
const URL = 'file://' + process.cwd() + '/preview.html';
const errs = []; const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
page.on('console', m => { const t = m.text(); if (m.type()==='error' && !/ERR_CONNECTION|fonts|_blob|ERR_FILE/.test(t)) errs.push('CONSOLE: '+t); });
/* Sin congelar el reloj, este archivo leía la hora real: la misma corrida
   decía «Asia … 1:10 AM» por la noche y «Londres … 2:02 AM» una hora después.
   No llegaba a fallar porque imprime en vez de afirmar, pero medía la sesión
   que tocara en vez de una sesión concreta. Se congela en el mismo instante
   que usa el resto de la suite —10:00 AM ET, dentro de la NY AM Kill Zone— para
   que dos corridas digan lo mismo. */
const __F = new Date('2026-09-17T14:00:00Z').getTime();
await page.addInitScript(`{const F=${__F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
await page.addInitScript(() => { window.claude = { use: async n => n==='permissions' ? { state: async()=> 'granted', request: async ns => Object.fromEntries((ns||[]).map(x=>[x,'granted'])) } : null }; });
await page.goto(URL); await page.waitForTimeout(700);
const T = await page.evaluate(() => new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'}));
const say = (k,v) => console.log('  ' + k.padEnd(34) + v);
const txt = async s => (await page.textContent(s)).replace(/\s+/g,' ').trim();

console.log('=== A. pre-sesión ===');
say('banner visible antes:', await page.locator('#preBanner').isVisible());
say('botón guardar visible:', await page.locator('#preSave').isVisible());
const boxes = page.locator('#checkList li input[type=checkbox]:not([data-f])');
const nb = await boxes.count(); say('pasos en la lista:', nb);
await boxes.nth(0).check(); await boxes.nth(1).check(); await page.waitForTimeout(250);
await page.click('#preSave'); await page.waitForTimeout(500);
say('banner tras guardar:', await txt('#preBanner'));
say('guardar oculto / reabrir visible:', (await page.locator('#preSave').isHidden()) + ' / ' + (await page.locator('#preReopen').isVisible()));
say('checkbox bloqueado:', await boxes.nth(2).isDisabled());
/* Esta línea costaba 30 de los 43 segundos del archivo, y el problema de fondo
   no era la lentitud. `#histWrap` existe pero en este punto no tiene filas, así
   que `.nth(3).textContent()` agotaba el timeout por defecto de Playwright —30
   s— y el `.catch(() => 'sin filas')` convertía el plantón en un texto amable.

   Peor que lento: «sin filas» significaba a la vez «el historial está vacío,
   que es lo normal aquí» y «la tabla no se pintó, que sería un fallo». Dos
   estados distintos con la misma cara, que es justo lo que este repositorio
   persigue en la app. `count()` responde al instante y los separa. */
const filasHist = await page.locator('#histWrap tbody tr').count();
say('columna Pre en historial:', filasHist
  ? await page.locator('#histWrap tbody tr').first().locator('td').nth(3).textContent({ timeout: 5000 })
  : 'sin filas (historial vacío, esperado aquí)');

console.log('=== B. enrutado por instrumento ===');
const route = async sym => { await page.fill('#qtSym', sym); await page.waitForTimeout(160); return [await page.inputValue('#qtDest'), await txt('#qtNote')]; };
for (const s of ['MNQ','MESZ5','BTC','SGOV','O','VTI','AAPL','SPY 250117C500','ETHUSDT']) {
  const [d, n] = await route(s); say(s + ' →', d + '  ·  ' + n.slice(0, 95));
}
console.log('=== C. registrar desde Cabina y ver en Futuros ===');
await page.fill('#qtSym','MNQ'); await page.waitForTimeout(200); await page.click('#qtGo'); await page.waitForTimeout(350);
say('título del editor:', await txt('#edTitle').catch(()=> '(sin #edTitle)'));
say('instrumento precargado:', await page.inputValue('#ef_instrument'));
await page.fill('#ef_time','09:45'); await page.fill('#ef_qty','2');
await page.fill('#ef_entry','21000'); await page.fill('#ef_stop','20980'); await page.fill('#ef_target','21040'); await page.fill('#ef_exit','21030');
await page.click('#edSave'); await page.waitForTimeout(600);
say('resultado del día en Cabina:', await page.inputValue('#jResult'));
say('nota de sync:', (await txt('#jSync')).slice(0,80));
await page.click('.tabbtn[data-tab="futuros"]'); await page.waitForTimeout(400);
say('ops en Futuros:', await txt('#nFut'));
await page.click('.tabbtn[data-tab="cabina"]'); await page.waitForTimeout(300);
await page.fill('#qtSym','VTI'); await page.waitForTimeout(200); await page.click('#qtGo'); await page.waitForTimeout(350);
say('mercado precargado:', await page.inputValue('#ef_market'));
say('activo precargado:', await page.inputValue('#ef_asset'));
await page.fill('#ef_qty','10'); await page.fill('#ef_price','280'); await page.fill('#ef_pnl','40');
await page.click('#edSave'); await page.waitForTimeout(600);
await page.click('.tabbtn[data-tab="invest"]'); await page.waitForTimeout(400);
say('ops de inversión en tabla:', await page.locator('#ivOps tbody tr').count());
say('primera fila:', (await page.evaluate(()=> { const r=document.querySelector('#ivOps tbody tr'); return r ? r.textContent.replace(/\s+/g,' ').trim().slice(0,90) : '(vacía)'; })));
await page.click('.tabbtn[data-tab="cabina"]'); await page.waitForTimeout(300);
say('columna Pre ahora:', (await page.evaluate(()=> { const c=document.querySelector('#histWrap tbody tr td:nth-child(4)'); return c ? c.textContent.trim() : '(sin filas)'; })));

console.log('=== D. calendario en Cabina ===');
say('título:', await txt('#calCabTitle'));
say('meta:', await txt('#calCabMeta'));
say('celdas:', await page.locator('#calCab button.d').count());
say('hoy marcado:', await page.locator('#calCab button.d.today').count());
const hoyCell = page.locator('#calCab button.d.today');
say('hoy muestra:', (await hoyCell.textContent()).replace(/\s+/g,' '));
say('semana con suma:', await page.locator('#calCab .w').count());
await page.click('#calCabPrev'); await page.waitForTimeout(250);
say('mes anterior:', await txt('#calCabTitle'));
await page.click('#calCabNext'); await page.waitForTimeout(250);
say('vuelve a:', await txt('#calCabTitle'));
await hoyCell.click(); await page.waitForTimeout(500);
say('tab activa tras click:', await page.evaluate(()=> document.querySelector('.tab.active').dataset.tab));
say('vista de futuros:', await page.evaluate(()=> document.querySelector('#ftSeg button.active').dataset.v));
say('día abierto:', await txt('#dayTitle'));

console.log('=== E. resultado a mano manda en el calendario ===');
await page.click('.tabbtn[data-tab="cabina"]'); await page.waitForTimeout(300);
await page.fill('#jResult','-250'); await page.waitForTimeout(700);
say('hoy en calendario Cabina:', (await hoyCell.textContent()).replace(/\s+/g,' '));
say('clase de la celda:', await hoyCell.getAttribute('class'));

console.log('=== F. persistencia ===');
await page.reload(); await page.waitForTimeout(1000);
say('banner pre-sesión:', await txt('#preBanner'));
say('checkbox sigue bloqueado:', await page.locator('#checkList li input[type=checkbox]:not([data-f])').nth(2).isDisabled());
say('calendario Cabina:', await txt('#calCabMeta'));
await page.click('#preReopen'); await page.waitForTimeout(400);
say('tras reabrir, banner oculto:', await page.locator('#preBanner').isHidden());
say('checkbox editable:', !(await page.locator('#checkList li input[type=checkbox]:not([data-f])').nth(2).isDisabled()));

console.log('\n--- errores js ---'); console.log(errs.length ? errs.join('\n') : 'none');
await browser.close();
