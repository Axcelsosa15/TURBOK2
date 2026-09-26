/* Segunda pasada: medir lo que el ojo no puede contar. Espaciado fuera de
   escala, alturas de línea sueltas, tamaños de tipo sin token, contraste. */
import { chromium } from 'playwright';
import { SEMILLA as sem } from './espera.mjs';
const F=new Date('2026-09-18T14:20:00Z').getTime();

const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:1600,height:1200}})).newPage();
await p.addInitScript(`{const F=${F};const R=Date;class D extends R{constructor(...a){if(!a.length)super(F);else super(...a);}static now(){return F;}}window.Date=D;}`);
await p.addInitScript(`try{localStorage.setItem('cabina-mnq:v1', ${JSON.stringify(sem)});}catch(e){}`);
await p.goto('file://'+process.cwd()+'/preview.html'); await p.waitForTimeout(1500);

const r = await p.evaluate(() => {
  const ESCALA = new Set([0,1,2,3,4,8,12,16,24,32,48,64]);
  const fuera = {}, tipos = {}, radios = {};
  let nodos = 0, desbordan = [];
  for (const el of document.querySelectorAll('.tab.active *, .topbar *, .tabnav *')) {
    if (!el.offsetParent && el.tagName !== 'BODY') continue;
    nodos++;
    const c = getComputedStyle(el);
    for (const prop of ['paddingTop','paddingBottom','paddingLeft','paddingRight','marginTop','marginBottom','rowGap','columnGap']) {
      const v = parseFloat(c[prop]); if (!Number.isFinite(v) || v === 0) continue;
      if (!ESCALA.has(Math.round(v))) { const k = Math.round(v)+'px'; fuera[k] = (fuera[k]||0)+1; }
    }
    const fs = Math.round(parseFloat(c.fontSize)*10)/10; tipos[fs] = (tipos[fs]||0)+1;
    const br = Math.round(parseFloat(c.borderTopLeftRadius)); if (br) radios[br] = (radios[br]||0)+1;
    if (el.scrollWidth > el.clientWidth + 2 && c.overflowX === 'hidden') desbordan.push(el.className + ' (' + el.scrollWidth + '>' + el.clientWidth + ')');
  }
  return { nodos, fuera, tipos, radios, desbordan: desbordan.slice(0,10),
    desbordePagina: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
const ord = o => Object.entries(o).sort((a,b)=>b[1]-a[1]);
console.log('nodos visibles analizados:', r.nodos);
console.log('\nESPACIADOS FUERA DE ESCALA (4/8/12/16/24/32/48/64):');
const f = ord(r.fuera); console.log(f.length ? '  ' + f.map(([k,v])=>`${k}×${v}`).join('  ') : '  ninguno ✅');
console.log('\nTAMAÑOS DE TIPO EN USO:');
console.log('  ' + ord(r.tipos).map(([k,v])=>`${k}px×${v}`).join('  '));
console.log('\nRADIOS EN USO:');
console.log('  ' + ord(r.radios).map(([k,v])=>`${k}px×${v}`).join('  '));
console.log('\nRECORTES (overflow hidden con contenido mayor):');
console.log(r.desbordan.length ? r.desbordan.map(x=>'  ⚠ '+x).join('\n') : '  ninguno ✅');
console.log('\ndesborde horizontal de la página:', r.desbordePagina, 'px');
await b.close();
