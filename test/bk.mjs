import { chromium } from 'playwright';
const URL = 'file://' + process.cwd() + '/preview.html';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';
const b = await chromium.launch();
const errs = [];
function wire(p, tag) {
  p.on('pageerror', e => errs.push(tag + ' PAGEERROR: ' + e.message));
  p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/ERR_CERT|ERR_CONNECTION|fonts|ERR_FILE/.test(t)) errs.push(tag + ' CONSOLE: ' + t); });
}
const say = (k, v) => console.log('  ' + String(k).padEnd(32) + v);

// ---------- A: cabina con datos ----------
const ctxA = await b.newContext({ viewport: { width: 1300, height: 950 } });
const A = await ctxA.newPage(); wire(A, '[A]');
await A.goto(URL); await A.waitForTimeout(900);
const T = await A.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));

// pre-sesión guardada
const bx = A.locator('#checkList li input[type=checkbox]:not([data-f])');
const nb = await bx.count(); for (let i = 0; i < nb - 1; i++) await bx.nth(i).check();
await A.click('#preSave'); await A.waitForTimeout(300);
// una operación de futuros, con captura inyectada
await A.fill('#qtSym', 'MNQ'); await A.waitForTimeout(150); await A.click('#qtGo'); await A.waitForTimeout(350);
await A.fill('#ef_time', '09:45'); await A.fill('#ef_qty', '2');
await A.fill('#ef_entry', '21000'); await A.fill('#ef_stop', '20980'); await A.fill('#ef_target', '21040'); await A.fill('#ef_exit', '21030');
await A.fill('#ef_lesson', 'Esperar el cierre de la vela de 5m.');
await A.click('#edSave'); await A.waitForTimeout(500);
// inyectar una captura en esa operación (no hay almacenamiento de imágenes fuera del artefacto)
await A.evaluate(png => {
  const K = 'cabina-mnq:v1'; const d = JSON.parse(localStorage.getItem(K) || '{}');
  const id = Object.keys(d.trades || {})[0]; d.trades[id].images = [{ data: png, caption: 'entrada en el pullback' }];
  localStorage.setItem(K, JSON.stringify(d));
}, PNG);
await A.reload(); await A.waitForTimeout(900);
// una inversión y una nota
await A.fill('#qtSym', 'VTI'); await A.waitForTimeout(150); await A.click('#qtGo'); await A.waitForTimeout(350);
await A.fill('#ef_qty', '10'); await A.fill('#ef_price', '280'); await A.click('#edSave'); await A.waitForTimeout(450);
await A.fill('#jNote', 'Sesión limpia, respeté el stop.'); await A.waitForTimeout(700);

say('meta del panel:', await A.textContent('#bkMeta'));
say('nota de modo:', await A.textContent('#bkModeNote'));
say('nota de capturas:', await A.textContent('#bkImgsNote'));
await A.check('#bkImgs'); await A.waitForTimeout(200);
say('nota tras marcar:', await A.textContent('#bkImgsNote'));

// ---------- exportar: descarga real ----------
const dl = A.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await A.click('#bkExport'); await A.waitForTimeout(1500);
const file = await dl;
say('descarga:', file ? file.suggestedFilename() : '(ninguna)');
say('aviso export:', (await A.textContent('#bkNote')).replace(/\s+/g, ' ').trim());

// ---------- exportar: ver el texto ----------
await A.click('#bkShow'); await A.waitForTimeout(1200);
const txt = await A.inputValue('#ef_j');
say('tamaño del texto:', txt.length + ' chars');
await A.click('#edCancel'); await A.waitForTimeout(250);
const parsed = JSON.parse(txt);
say('formato / versión:', parsed.format + ' v' + parsed.version);
say('claves:', Object.keys(parsed).join(','));
say('sesiones / ops:', Object.keys(parsed.days).length + ' / ' + Object.keys(parsed.trades).length);
say('pre en la sesión:', JSON.stringify(parsed.days[T] && parsed.days[T].pre ? parsed.days[T].pre.done + '/' + parsed.days[T].pre.total : null));
const tr = Object.values(parsed.trades);
say('captura dentro:', (tr.find(x => (x.images || []).length)?.images[0].data || '').slice(0, 22) + '…');

// ---------- B: cabina virgen, importar ----------
const ctxB = await b.newContext({ viewport: { width: 1300, height: 950 } });
const B = await ctxB.newPage(); wire(B, '[B]');
await B.goto(URL); await B.waitForTimeout(900);
say('--- B antes ---', '');
say('ops en B:', await B.textContent('#nFut') || '(vacío)');
await B.click('#bkPaste'); await B.waitForTimeout(400);
await B.fill('#ef_j', txt); await B.click('#edSave'); await B.waitForTimeout(700);
say('título del aviso:', await B.textContent('#edTitle'));
say('resumen:', (await B.inputValue('#ef_resumen')).replace(/\n/g, ' | '));
// confirmación mal escrita
await B.fill('#ef_ok', 'si'); await B.click('#edSave'); await B.waitForTimeout(300);
say('rechaza confirmación floja:', await B.textContent('#edTitle'));
await B.fill('#ef_ok', 'importar'); await B.click('#edSave'); await B.waitForTimeout(2500);
await B.waitForTimeout(1200);
say('--- B después ---', '');
say('ops de futuros:', await B.textContent('#nFut'));
say('resultado del día:', await B.inputValue('#jResult'));
say('nota del día:', await B.inputValue('#jNote'));
say('pre-sesión:', (await B.textContent('#preBanner')).replace(/\s+/g, ' ').slice(0, 58));
say('calendario:', await B.textContent('#calCabMeta'));
say('meta del panel:', await B.textContent('#bkMeta'));
await B.click('.tabbtn[data-tab="futuros"]'); await B.click('#ftSeg button[data-v="diario"]'); await B.waitForTimeout(600);
const img = B.locator('#dayBody img.thumb, .pbimgs img').first();
say('captura visible:', await img.count() ? await img.evaluate(e => e.naturalWidth + 'x' + e.naturalHeight + ' src=' + e.src.slice(0, 18)) : '(ninguna)');
await B.click('.tabbtn[data-tab="invest"]'); await B.waitForTimeout(400);
say('ops de inversión:', await B.locator('#ivOps tbody tr').count());

// ---------- C: basura y formatos malos ----------
const C = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage(); wire(C, '[C]');
await C.goto(URL); await C.waitForTimeout(900);
await C.waitForTimeout(2400);
for (const [name, bad] of [['no es json', '{nope'], ['json ajeno', '{"hola":1}'], ['versión futura', JSON.stringify({ format: 'cabina-backup', version: 99, trades: {} })], ['copia vacía', JSON.stringify({ format: 'cabina-backup', version: 1 })]]) {
  await C.click('#bkPaste'); await C.waitForTimeout(300);
  await C.fill('#ef_j', bad); await C.click('#edSave'); await C.waitForTimeout(300);
  const msg = await C.textContent('#edTitle').catch(() => '');
  say(name + ':', (msg || '(aceptado — MAL)').replace(/\s+/g, ' ').trim().slice(0, 78));
  await C.click('#edCancel').catch(() => {}); await C.waitForTimeout(200);
}
console.log('\n--- errores js ---'); console.log(errs.length ? errs.join('\n') : 'none');
await b.close();
