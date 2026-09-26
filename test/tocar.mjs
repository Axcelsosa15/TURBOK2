import { chromium } from 'playwright';
const errs=[]; const b=await chromium.launch(); const F=new Date('2026-01-01T14:00:00Z').getTime();
function semilla(conVenta){
  const trades={}; let u=0;
  for(let m=0;m<12;m++){ const precio=100*Math.pow(1.10,m/12); const q=200/precio; u+=q;
    trades['iv'+m]={id:'iv'+m,type:'inversion',op:'aporte',date:`2025-${String(m+1).padStart(2,'0')}-01`,market:'etfs',asset:'VOO',qty:q,price:precio,fees:0,createdAt:1700000000000+m}; }
  if(conVenta) trades['vv']={id:'vv',type:'inversion',op:'venta',date:'2025-06-15',market:'etfs',asset:'VOO',qty:5,price:104,fees:0,offPlan:'1',createdAt:1700000099999};
  return { settings:{accounts:[],rules:[],meta:{}}, trades,
    positions:{ p1:{id:'p1',market:'etfs',asset:'VOO',date:'2025-01-01',qty:1,entry:1,fees:0,current:110,
      thesis:'índice amplio a 10 años', exitPlan:'No vendo salvo necesidad real de liquidez.'} } }; }
async function ver(conVenta, etiqueta){
  const p=await (await b.newContext({viewport:{width:1500,height:1300}})).newPage();
  p.on('pageerror',e=>errs.push(etiqueta+' PAGEERROR: '+e.message));
  await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
  await p.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(JSON.stringify(semilla(conVenta)))});}catch(e){}`);
  await p.goto('file://'+process.cwd()+'/preview.html'); await p.waitForTimeout(1300);
  await p.click('.tabbtn[data-tab="invest"]'); await p.waitForTimeout(900);
  const t = await p.evaluate(()=>{ const e=document.getElementById('ivTocar'); return e&&!e.hidden? e.innerText : '(oculto)'; });
  return { p, t };
}
console.log('══ PASO 4 · sin ventas fuera de plan ══');
const a = await ver(false, 'a');
console.log(a.t.split('\n').filter(Boolean).map(l=>'  '+l).join('\n'));
await a.p.context().close();

console.log('\n══ PASO 4 · con una venta de 5 unidades a $104, fuera de plan (hoy $110) ══');
const c = await ver(true, 'c');
console.log(c.t.split('\n').filter(Boolean).map(l=>'  '+l).join('\n'));

console.log('\n══ PASO 5 · el plan de salida aparece al elegir «venta» ══');
await c.p.click('#ivNew');
await c.p.waitForTimeout(500);
const abierto = await c.p.evaluate(()=>!!document.getElementById('ef_op'));
if (abierto) {
  await c.p.fill('#ef_asset','VOO');
  await c.p.selectOption('#ef_op','venta'); await c.p.waitForTimeout(450);
  console.log('  ' + await c.p.evaluate(()=>{ const z=document.getElementById('edAvisos'); return z&&!z.hidden? z.innerText.replace(/\n+/g,' | ') : '(sin aviso)'; }));
  await c.p.selectOption('#ef_op','compra'); await c.p.waitForTimeout(400);
  console.log('  al volver a «compra»: ' + await c.p.evaluate(()=>{ const z=document.getElementById('edAvisos'); return z&&!z.hidden? z.innerText.replace(/\n+/g,' | ') : '(sin aviso)'; }));
} else console.log('  (no se pudo abrir el editor de operación)');
console.log('\nerrores JS: '+(errs.length?errs.join('\n'):'0'));
await b.close();
