import { chromium } from 'playwright';
const errs=[]; const b=await chromium.launch(); const F=new Date('2026-09-17T14:00:00Z').getTime();
function semilla(n){ const trades={}; let r=99; const rnd=()=>(r=(r*1103515245+12345)&0x7fffffff)/0x7fffffff;
  for(let i=0;i<n;i++){ const d=new Date(Date.UTC(2025,0,1+Math.floor(i/3))); const id='t'+i; const g=rnd()<0.45;
    trades[id]={id,type:'futuros',date:d.toISOString().slice(0,10),time:'09:'+String(10+(i%45)).padStart(2,'0'),instrument:'MNQ',
      direction:'long',qty:2,entry:21000,stop:20990,exit:g?21030:20990,accountId:'a1',createdAt:1700000000000+i}; }
  return { settings:{accounts:[{id:'a1',firm:'L',name:'L25K',size:25000,dd:1000,ddKind:'trailing_lock',trailBase:'intradia',limit:50,total:0,best:0,target:1500,status:'activa',ledger:[]}],rules:[],meta:{}}, trades }; }
const p=await (await b.newContext({viewport:{width:1500,height:1200}})).newPage();
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
await p.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(JSON.stringify(semilla(700)))});}catch(e){}`);
await p.goto('file://'+process.cwd()+'/preview.html'); await p.waitForSelector('.acct',{timeout:30000});
await p.click('.tabbtn[data-tab="futuros"]'); await p.waitForTimeout(500);
await p.click('button[data-v="diario"]'); await p.waitForTimeout(700);
const estado = () => p.evaluate(()=>({ filas: document.querySelectorAll('#jrTable tbody tr').length,
  meta: document.getElementById('jrMeta').textContent, boton: (document.getElementById('jrMas')||{}).textContent || '(ninguno)' }));
console.log('  inicial      : ' + JSON.stringify(await estado()));
await p.click('#jrMas'); await p.waitForTimeout(600);
console.log('  tras ampliar : ' + JSON.stringify(await estado()));
await p.click('#jrMas'); await p.waitForTimeout(600);
console.log('  otra vez     : ' + JSON.stringify(await estado()));
console.log('\n  control: fila 1 (siempre estuvo) vs fila 700 (añadida por el botón)');
for (const idx of [0, 699]) {
  const info = await p.evaluate((k)=>{ const trs=document.querySelectorAll('#jrTable tbody tr'); const tr=trs[k]; if(!tr) return {no:'sin fila '+k};
    tr.click(); return { id: tr.dataset.id }; }, idx);
  await p.waitForTimeout(450);
  const st = await p.evaluate(()=>({ titulo: (document.getElementById('edTitle')||{}).textContent || '(cerrado)',
    campos: document.querySelectorAll('#edFields [id^=ef_]').length,
    entrada: (document.getElementById('ef_entry')||{}).value || '—' }));
  console.log(`  fila ${idx+1} (${info.id||'?'}) -> ${JSON.stringify(st)}`);
  await p.evaluate(()=>{ const c=document.getElementById('edCancel'); if(c) c.click(); }); await p.waitForTimeout(300);
}
console.log('\n  tras un filtro que reduce la lista, ¿se reajusta el tope?');
await p.evaluate(()=>{ const d=document.getElementById('edCancel'); if(d) d.click(); });
await p.waitForTimeout(300);
await p.selectOption('#ftRange','month').catch(()=>{});
await p.waitForTimeout(700);
console.log('  ' + JSON.stringify(await estado()));
console.log('\nerrores JS: '+(errs.length?errs.join('\n'):'0'));
await b.close();
