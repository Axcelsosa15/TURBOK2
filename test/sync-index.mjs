/* Copia el cuerpo del artefacto (cabina.html del scratchpad) dentro de index.html,
   conservando la cabecera del repositorio, y reconstruye el preview de pruebas. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const fuente = process.env.CABINA || "/tmp/claude-0/-home-user-trading-journal2/98c7b14f-3728-5f9b-a633-ce8f09807ce4/scratchpad/cabina.html";
const idx = readFileSync(join(raiz, "index.html"), "utf8");
const cab = readFileSync(fuente, "utf8");
const i = idx.indexOf("<style>", idx.indexOf("<style>") + 1);
if (i < 0) throw new Error("no encuentro el segundo <style> en index.html");
writeFileSync(join(raiz, "index.html"), idx.slice(0, i) + cab.slice(cab.indexOf("<style>")).trimEnd() + "\n</body>\n</html>\n");
console.log("index.html sincronizado desde", fuente);
