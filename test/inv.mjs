import { chromium } from 'playwright';
const errs=[]; const b=await chromium.launch(); const F=new Date('2026-01-01T14:00:00Z').getTime();
// DCA real: $200/mes durante 12 meses de 2025 en un ETF
function semilla(){
  const trades={}; let u=0;
  for(let m=0;m<12;m++){ const precio=100*Math.pow(1.10,m/12); const q=200/precio; u+=q;
    trades['iv'+m]={id:'iv'+m,type:'inversion',op:'aporte',date:`2025-${String(m+1).padStart(2,'0')}-01`,
      market:'etfs',asset:'VOO',qty:q,price:precio,fees:0,createdAt:1700000000000+m}; }
  return { settings:{accounts:[],rules:[],meta:{}}, trades,
    positions:{ p1:{id:'p1',market:'etfs',asset:'VOO',date:'2025-01-01',qty:u,entry:2400/u,fees:0,current:110,
      thesis:'índice amplio, horizonte 10 años', exitPlan:'no vendo salvo necesidad real de liquidez'} } };
}
const p=await (await b.newContext({viewport:{width:1500,height:1300}})).newPage();
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
await p.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(JSON.stringify(semilla()))});}catch(e){}`);
await p.goto('file://'+process.cwd()+'/preview.html'); await p.waitForTimeout(1300);
await p.click('.tabbtn[data-tab="invest"]'); await p.waitForTimeout(900);
const t = await p.evaluate(()=>{ const e=document.getElementById('ivTiles'); return e? e.innerText : '(sin tiles)'; });
console.log('── TILES ──'); console.log(t.split('\n').filter(Boolean).map(l=>'  '+l).join('\n'));
const sc = await p.evaluate(()=>{ const e=document.getElementById('ivScore'); return e? e.innerText : '(sin scorecard)'; });
console.log('\n── SCORECARD (fila de rentabilidad) ──');
console.log(sc.split('\n').filter(l=>/Rentabilidad|IRR|%/.test(l)).map(l=>'  '+l).join('\n'));
console.log('\n── TABLA DE POSICIONES (DCA derivado) ──');
// entrar al mercado que contiene la posición
await p.click('#mlist button[data-id="etfs"]').catch(async()=>{ await p.evaluate(()=>{ const b=[...document.querySelectorAll('#mlist button[data-id]')].find(x=>/ETF/i.test(x.textContent||'')); if(b) b.click(); }); });
await p.waitForTimeout(800);
const tab = await p.evaluate(()=>{ const t=[...document.querySelectorAll('table.t')].find(x=>/Tesis|Salida planeada/.test(x.innerText)); return t? t.innerText : '(no encontrada)'; });
console.log(tab.split('\n').filter(Boolean).slice(0,6).map(l=>'  '+l).join('\n'));
console.log('\n── SCORECARD · precios al día ──');
const sc2 = await p.evaluate(()=>{ const e=document.getElementById('ivScore'); const li=e.innerText.split('\n'); const i=li.findIndex(x=>/Precios al d/.test(x)); return i<0?'(no)':li.slice(i-1,i+2).join(' | '); });
console.log('  ' + sc2);
console.log('\nerrores JS: '+(errs.length?errs.join('\n'):'0'));
await b.close();
