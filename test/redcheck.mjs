import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
await p.addInitScript(()=>{window.claude={use:async n=>n==='permissions'?{state:async()=>'granted',request:async ns=>Object.fromEntries((ns||[]).map(x=>[x,'granted']))}:null};});
await p.goto('file:///tmp/claude-0/-home-user-trading-journal2/98c7b14f-3728-5f9b-a633-ce8f09807ce4/scratchpad/preview.html');
await p.waitForTimeout(600); await p.click('#demoToggle'); await p.waitForTimeout(1000);
const scan = () => p.evaluate(() => {
  const RED = ['rgb(224, 96, 79)'];
  const out = [];
  const root = document.querySelector('.tab.active');
  root.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    if (el.children.length && ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const txt = el.textContent.trim();
    // importe positivo: empieza por $ y sin signo menos delante
    if (!/^\$[\d,]+(\.\d+)?$/.test(txt)) return;
    const c = getComputedStyle(el).color;
    if (RED.includes(c)) {
      const lab = el.parentElement ? (el.parentElement.querySelector('.lab, .k') || {}).textContent : '';
      out.push(`${txt}  <-- rojo  [${(lab||'').trim()}]  (${el.className})`);
    }
  });
  return out;
});
for (const [tab, sub] of [['cabina',null],['futuros','resumen'],['futuros','cuentas'],['futuros','analisis'],['futuros','diario'],['invest',null],['playbook',null],['ideas',null],['calc',null]]) {
  await p.click(`.tabbtn[data-tab="${tab}"]`); await p.waitForTimeout(220);
  if (sub) { await p.click(`#ftSeg button[data-v="${sub}"]`); await p.waitForTimeout(380); }
  const bad = await scan();
  console.log(`${tab}${sub?'/'+sub:''}: ${bad.length ? '\n   ' + bad.join('\n   ') : 'ok'}`);
}
await b.close();
