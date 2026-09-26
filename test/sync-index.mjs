/* Copia el cuerpo del artefacto (cabina.html del scratchpad) dentro de index.html,
   conservando la cabecera del repositorio, y reconstruye el preview de pruebas. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
/* La fuente se pasa: antes el valor por defecto era una ruta del contenedor
   donde se escribio esto, asi que para cualquier otra persona fallaba con un
   ENOENT que no explicaba nada. */
const fuente = process.argv[2] || process.env.CABINA;
if (!fuente) {
  console.error("Falta la fuente. Uso: node test/sync-index.mjs <ruta/al/cabina.html>");
  console.error("  (o CABINA=<ruta> node test/sync-index.mjs)");
  process.exit(2);
}
const idx = readFileSync(join(raiz, "index.html"), "utf8");
const cab = readFileSync(fuente, "utf8");
const i = idx.indexOf("<style>", idx.indexOf("<style>") + 1);
if (i < 0) throw new Error("no encuentro el segundo <style> en index.html");
writeFileSync(join(raiz, "index.html"), idx.slice(0, i) + cab.slice(cab.indexOf("<style>")).trimEnd() + "\n</body>\n</html>\n");
console.log("index.html sincronizado desde", fuente);
