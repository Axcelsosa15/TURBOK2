import { chromium } from 'playwright';
const b = await chromium.launch();
// 9:00 AM ET (kill zone), 12:00 PM ET (lunch), 20:00 ET (Asia) y sábado (cerrado)
const CASES = [['killzone','2026-09-15T13:00:00Z'],['lunch','2026-09-15T16:00:00Z'],['asia','2026-09-16T01:00:00Z'],['cerrado','2026-09-19T15:00:00Z']];
for (const [w,label] of [[390,'iphone14'],[430,'promax'],[375,'se'],[1400,'desktop']]) {
  for (const [name, iso] of CASES) {
    const ctx = await b.newContext({ viewport:{width:w,height:900}, isMobile:w<500, hasTouch:w<500 });
    const p = await ctx.newPage();
    const F = new Date(iso).getTime();
    await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;window.claude={use:async n=>null};}`);
    await p.goto('file://' + process.cwd() + '/preview.html');
    await p.waitForTimeout(700);
    const o = await p.evaluate(() => {
      const pill = document.getElementById('sessionPill');
      const bar = document.querySelector('.topbar');
      const kids = [...bar.querySelectorAll('.brand, .clock > *')].map(e=>({t:e.textContent.trim().slice(0,22), r:e.getBoundingClientRect()}));
      const over = [];
      for (let i=0;i<kids.length;i++) for (let j=i+1;j<kids.length;j++){
        const a=kids[i].r,c=kids[j].r;
        if (a.right>c.left+1 && c.right>a.left+1 && a.bottom>c.top+1 && c.bottom>a.top+1) over.push(kids[i].t+' ∩ '+kids[j].t);
      }
      const lab = document.getElementById('sessionLabel').getBoundingClientRect();
      const pr = pill.getBoundingClientRect();
      const dentro = lab.left >= pr.left-1 && lab.right <= pr.right+1 && lab.top >= pr.top-1 && lab.bottom <= pr.bottom+1;
      return { cls: pill.className, h: Math.round(pr.height), dentro, over,
        ovf: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    const bad = (!o.dentro || o.over.length || o.ovf) ? '  <<< FALLO ' + JSON.stringify(o.over) : '';
    console.log(`${label.padEnd(9)} ${name.padEnd(9)} ${o.cls.padEnd(11)} alto=${String(o.h).padStart(3)} texto dentro=${o.dentro} overflow=${o.ovf}${bad}`);
    await ctx.close();
  }
}
await b.close();
