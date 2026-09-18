import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const errs=[]; const b=await chromium.launch(); const F=new Date('2026-01-01T14:00:00Z').getTime();
function semilla(conPos){ const trades={}; let u=0, coste=0;
  for(let m=0;m<12;m++){ const precio=100*Math.pow(1.10,m/12); const q=200/precio; u+=q; coste+=200;
    trades['iv'+m]={id:'iv'+m,type:'inversion',op:'aporte',date:`2025-${String(m+1).padStart(2,'0')}-01`,market:'etfs',asset:'VOO',qty:q,price:precio,fees:0,createdAt:1700000000000+m}; }
  const d={ settings:{accounts:[],rules:[],meta:{}}, trades, positions:{} };
  if (conPos) d.positions.p1={id:'p1',market:'etfs',asset:'VOO',date:'2025-01-01',qty:1,entry:1,fees:0,current:110,thesis:'x',exitPlan:'y'};
  return { d, u, coste }; }
const { d, u, coste } = semilla(true);
const p=await (await b.newContext({viewport:{width:1500,height:1300}})).newPage();
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
await p.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(JSON.stringify(d))});}catch(e){}`);
await p.goto('file://'+process.cwd()+'/preview.html'); await p.waitForTimeout(1300);
await p.click('.tabbtn[data-tab="invest"]'); await p.waitForTimeout(900);

console.log('══ la posición dice qty=1 entry=1 a mano; las 12 compras dicen otra cosa ══');
console.log(`  esperado de las operaciones: ${u.toFixed(4)} unidades · coste $${coste}`);
const r = await p.evaluate(()=>{
  // investStats() está dentro del IIFE; leemos lo que la app CALCULA a través de los tiles
  const t = document.getElementById('ivTiles').innerText.split('\n').filter(Boolean);
  const g = (re) => { const i=t.findIndex(x=>re.test(x)); return i<0?'?':t[i+1]; };
  return { invertido: g(/INVERTIDO/), valor: g(/VALOR ACTUAL/), pnl: g(/P&L NO REALIZADO/i), irr: g(/RENTABILIDAD/) };
});
console.log('  la app calcula   : ' + JSON.stringify(r));
console.log('\n  Si dijera $1 de coste, la derivación no funcionó.');
console.log('  Si dice $2,400, la posición se está derivando de sus 12 compras. ✔');

console.log('\n══ marcadores de lote y antigüedad del precio en el DOM ══');
const marcas = await p.evaluate(()=>{
  const el=[...document.querySelectorAll('.stale')].map(e=>e.textContent.trim()).filter(Boolean);
  return el.slice(0,8);
});
console.log('  .stale encontrados: ' + (marcas.length? JSON.stringify(marcas) : '(ninguno — la tabla no está en esta vista)'));
console.log('\nerrores JS: '+(errs.length?errs.join('\n'):'0'));
await b.close();
