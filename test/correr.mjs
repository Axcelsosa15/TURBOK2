/* Corre la suite entera y devuelve un código de salida útil para CI.

   Cada archivo es un proceso aparte a propósito: comparten `preview.html` pero
   no estado de navegador, y uno que se cuelgue no se lleva a los demás. El
   `timeout` está para que un test colgado falle como test colgado y no como
   una tubería de CI que se agota a los seis minutos sin decir cuál fue. */
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
/* No son tests: dos son herramientas y uno necesita un baseline que no está
   en el repositorio. Se nombran para que nadie se pregunte por qué faltan. */
const NO_SON_TESTS = new Set(['build-preview.mjs', 'sync-index.mjs', 'espera.mjs', 'correr.mjs']);
const SIN_BASELINE = new Set(['perf.mjs']);

const solo = process.argv.slice(2);
let archivos = readdirSync(aqui).filter(f => f.endsWith('.mjs') && !NO_SON_TESTS.has(f) && !SIN_BASELINE.has(f)).sort();
if (solo.length) archivos = archivos.filter(f => solo.some(s => f.startsWith(s)));

const TOPE_MS = 300000;
const corre = f => new Promise(res => {
  const t0 = Date.now();
  const p = spawn(process.execPath, [join(aqui, f)], { cwd: aqui, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', d => { out += d; });
  p.stderr.on('data', d => { out += d; });
  const reloj = setTimeout(() => { p.kill('SIGKILL'); }, TOPE_MS);
  p.on('close', code => { clearTimeout(reloj); res({ f, code, ms: Date.now() - t0, out }); });
});

console.log(`Cabina · ${archivos.length} archivos de prueba\n`);
const malos = [];
const t0 = Date.now();
for (const f of archivos) {
  const r = await corre(f);
  const fallos = (r.out.match(/fallos: (\d+)/) || [])[1];
  const marca = r.code === 0 ? '✅' : '❌';
  console.log(`  ${marca} ${f.replace('.mjs', '').padEnd(14)} ${String(r.ms).padStart(6)} ms${fallos ? `  ${fallos} fallos` : ''}`);
  if (r.code !== 0) { malos.push(f); console.log(r.out.split('\n').slice(-14).map(l => '       ' + l).join('\n')); }
}
console.log(`\n${archivos.length - malos.length}/${archivos.length} en verde · ${Math.round((Date.now() - t0) / 1000)} s`);
if (malos.length) { console.log('rojos: ' + malos.join(' ')); process.exit(1); }
