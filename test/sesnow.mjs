import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const CASES = [
  ['pre-mercado 7:30', '2026-09-15T11:30:00Z'],
  ['kill zone 9:00',   '2026-09-15T13:00:00Z'],
  ['kill zone 10:55',  '2026-09-15T14:55:00Z'],
  ['lunch 12:00',      '2026-09-15T16:00:00Z'],
  ['NY PM 14:00',      '2026-09-15T18:00:00Z'],
  ['cierre 16:30',     '2026-09-15T20:30:00Z'],
  ['asia 21:00',       '2026-09-16T01:00:00Z'],
  ['londres 3:00',     '2026-09-15T07:00:00Z'],
  ['viernes 17:10',    '2026-09-18T21:10:00Z'],
  ['sábado mediodía',  '2026-09-19T15:00:00Z'],
];
for (const [name, iso] of CASES) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const p = await ctx.newPage();
  const F = new Date(iso).getTime();
  await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;window.claude={use:async n=>null};}`);
  await p.goto('file://' + process.cwd() + '/preview.html');
  await p.waitForTimeout(600);
  const o = await p.evaluate(() => {
    const el = document.getElementById('sesNow');
    const hdr = el.closest('header');
    const r = el.getBoundingClientRect(); const hr = hdr.getBoundingClientRect();
    const meta = document.getElementById('todayLabel').getBoundingClientRect();
    const solapa = r.right > meta.left + 1 && meta.right > r.left + 1 && r.bottom > meta.top + 1 && meta.bottom > r.top + 1;
    return {
      cls: el.className,
      tit: el.querySelector('b') ? el.querySelector('b').textContent : '(vacío)',
      sub: el.querySelector('small') ? el.querySelector('small').textContent : '',
      dentro: r.right <= hr.right + 1 && r.left >= hr.left - 1,
      solapa,
    };
  });
  console.log(name.padEnd(19), o.cls.replace('sesnow ','').padEnd(5), '|', (o.tit + ' / ' + o.sub).padEnd(62), '| dentro:' + o.dentro, 'solapa:' + o.solapa);
  await ctx.close();
}
await b.close();
