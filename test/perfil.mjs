import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const F = new Date('2026-09-17T14:00:00Z').getTime();
function semilla(n){ const trades={}; let r=12345; const rnd=()=>(r=(r*1103515245+12345)&0x7fffffff)/0x7fffffff;
  for(let i=0;i<n;i++){ const d=new Date(Date.UTC(2025,0,1+Math.floor(i/3))); const id='t'+i; const g=rnd()<0.45;
    trades[id]={id,type:'futuros',date:d.toISOString().slice(0,10),time:'09:'+String(10+(i%45)).padStart(2,'0'),instrument:'MNQ',
      direction:rnd()<0.5?'long':'short',qty:1+(i%3),entry:21000,stop:20990,exit:g?21000+10+Math.round(rnd()*40):20990,accountId:'a1',createdAt:1700000000000+i}; }
  return { settings:{accounts:[{id:'a1',firm:'Lucid',name:'LucidFlex 25K',kind:'Evaluación',size:25000,dd:1000,ddKind:'trailing_lock',trailBase:'intradia',limit:50,total:0,best:0,target:1500,status:'activa',ledger:[]}],rules:[],meta:{}}, trades }; }
const N = Number(process.argv[2] || 1500);
const p = await (await b.newContext({viewport:{width:1500,height:1200}})).newPage();
const perfiles = [];
p.on('console', m => { const t = m.text(); if (t.startsWith('PERFIL ')) perfiles.push(JSON.parse(t.slice(7))); });
await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
await p.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(JSON.stringify(semilla(N)))});}catch(e){}`);
await p.goto('file://'+process.cwd()+'/preview_perf.html'); await p.waitForSelector('.acct',{timeout:30000}).catch(()=>{});
await p.waitForTimeout(600);
perfiles.length = 0;
await p.click('.tabbtn[data-tab="futuros"]'); await p.waitForTimeout(400);
await p.click('#ftNew'); await p.waitForTimeout(300);
await p.fill('#ef_date','2026-09-17'); await p.fill('#ef_instrument','MNQ'); await p.fill('#ef_qty','2');
await p.fill('#ef_entry','21000'); await p.fill('#ef_stop','20990'); await p.fill('#ef_exit','21030');
await p.click('#edSave'); await p.waitForTimeout(1500);
const detalle = await p.evaluate(()=>{ const a=window.__acum||{}; const o={}; Object.keys(a).forEach(k=>o[k]=Math.round(a[k])); return o; });
const u = perfiles[perfiles.length-1] || {};
const total = Object.values(u).reduce((a,c)=>a+c,0);
console.log(`\nguardar 1 operación con ${N} en el journal — total ${total} ms\n`);
Object.entries(u).sort((a,c)=>c[1]-a[1]).forEach(([k,v])=>{
  const pct = total? Math.round(v/total*100):0;
  console.log('  ' + k.padEnd(24) + String(v).padStart(5) + ' ms  ' + String(pct).padStart(3) + '%  ' + '█'.repeat(Math.round(pct/2)));
});
console.log('\n── dentro de renderFutures (acumulado desde el arranque) ──');
Object.entries(detalle).sort((a,c)=>c[1]-a[1]).slice(0,12).forEach(([k,v])=>console.log('  '+k.padEnd(22)+String(v).padStart(6)+' ms'));
await b.close();
