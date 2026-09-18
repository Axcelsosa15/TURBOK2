/* Construye test/preview.html envolviendo index.html con el esqueleto que
   añade el host del artefacto. Las pruebas cargan ese preview. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");
const html = readFileSync(join(raiz, "index.html"), "utf8");
const i = html.indexOf("<style>");
if (i < 0) throw new Error("no encuentro el <style> de la app en index.html");

const cabeza = `<!doctype html><html><head><meta charset=utf8>
<meta name=viewport content="width=device-width,initial-scale=1">
<style>:root{color-scheme:dark}body{margin:0;padding:0;background:#0B0E13;color:#E8ECF2}
img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>
<title>Cabina</title>
`;
writeFileSync(join(aqui, "preview.html"), cabeza + html.slice(i));
console.log("test/preview.html escrito");
