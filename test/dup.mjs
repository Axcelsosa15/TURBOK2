import { chromium } from 'playwright';
const errs=[]; const b=await chromium.launch(); const F=new Date('2026-01-01T14:00:00Z').getTime();
function semilla(nPos){
  const trades={}; let u=0;
  for(let m=0;m<12;m++){ const precio=100*Math.pow(1.10,m/12); const q=200/precio; u+=q;
    trades['iv'+m]={id:'iv'+m,type:'inversion',op:'aporte',date:`2025-${String(m+1).padStart(2,'0')}-01`,market:'etfs',asset:'VOO',qty:q,price:precio,fees:0,createdAt:1700000000000+m}; }
  const positions={};
  for(let i=0;i<nPos;i++) positions['p'+i]={id:'p'+i,market:'etfs',asset:'VOO',date:'2025-01-01',qty:u/nPos,entry:100,fees:0,current:110,thesis:'x',exitPlan:'y'};
  return { settings:{accounts:[],rules:[],meta:{}}, trades, positions };
}
async function ver(nPos){
  const p=await (await b.newContext({viewport:{width:1500,height:1200}})).newPage();
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
  await p.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(JSON.stringify(semilla(nPos)))});}catch(e){}`);
  await p.goto('file://'+process.cwd()+'/preview.html'); await p.waitForTimeout(1200);
  await p.click('.tabbtn[data-tab="invest"]'); await p.waitForTimeout(800);
  const r = await p.evaluate(()=>{ const t=document.getElementById('ivTiles').innerText.split('\n').filter(Boolean);
    const g=re=>{const i=t.findIndex(x=>re.test(x)); return i<0?'?':t[i+1];};
    return { pos:g(/POSICIONES/), invertido:g(/INVERTIDO/), valor:g(/VALOR ACTUAL/) }; });
  await p.context().close(); return r;
}
console.log('Aportado REAL en las operaciones: $2,400 · valor real ≈ $2,528\n');
for (const n of [1,2,3]) {
  const r = await ver(n);
  console.log(`  ${n} posición(es) del MISMO activo VOO en el MISMO mercado -> ${JSON.stringify(r)}`);
}
console.log('\n  Si "invertido" se multiplica con el número de posiciones, hay doble conteo.');
console.log('\nerrores JS: '+(errs.length?errs.join('\n'):'0'));
await b.close();
