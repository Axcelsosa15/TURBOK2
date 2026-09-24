/* ESPERAR A LA CONDICIÓN, NO AL RELOJ.

   La suite dormía 227 segundos escritos a mano en `waitForTimeout`, y esa
   cuenta se queda corta porque no ve los que están dentro de bucles. Perfilado
   sobre `vivo.mjs`: una pasada de `foto()` gastaba 11.840 ms de espera fija
   para hacer 40 ms de trabajo real. Ratio 296:1.

   El motivo es que la espera estaba mal calibrada por construcción: Cabina
   pinta con un coalescer de microtasks (fanout → Promise.resolve().then()), o
   sea que termina de pintar ANTES de que Playwright complete el viaje de
   vuelta del clic. Medido con un MutationObserver, las 23 esperas de una foto
   daban el suelo del observador y nunca más: el DOM ya estaba quieto antes de
   empezar a mirarlo. Los 500 ms no esperaban a nada.

   Un número fijo tiene además el problema de que falla en los dos sentidos: de
   más cuesta minutos, y de menos produce un test intermitente, que es peor que
   no tener test. Esperar a la condición no tiene ese dilema. */

/* Resuelve en cuanto el DOM lleva `calma` ms sin mutar. El tope duro existe
   para que un render que no llegue nunca falle como test lento y no como test
   colgado. */
export const quieto = (pg, calma = 30, tope = 1500) => pg.evaluate(([c, t]) => new Promise(res => {
  let timer = setTimeout(fin, c);
  const ob = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(fin, c); });
  ob.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
  const duro = setTimeout(fin, t);
  function fin() { clearTimeout(timer); clearTimeout(duro); ob.disconnect(); res(); }
}), [calma, tope]);

/* El arranque es el único caso que NO se resuelve con quiescencia a secas: la
   app carga en fases (localStorage, normalize, renders) y entre dos fases cabe
   un hueco mayor que la calma, así que el observador se rendiría a mitad. Se
   espera a que EXISTA lo que el test va a usar, y sólo después a que se calme. */
export const arrancada = async (pg, sel = '.acct') => {
  await pg.waitForSelector(sel, { timeout: 15000 });
  await quieto(pg, 120, 4000);
};

/* ⚠ DÓNDE NO SIRVE LA QUIESCENCIA, Y POR QUÉ
   La app tiene caminos que difieren trabajo con setTimeout. Si la calma es más
   corta que ese diferido, el observador ve el DOM quieto, devuelve, y el
   repintado llega DESPUÉS: test intermitente, que es peor que no tener test.

   Los diferidos que hay hoy en index.html:
       40 ms   bkConfirmImport tras leer un archivo o pegar JSON
       60 ms   openTrade al pulsar «Ver operación» desde una tesis
      100 ms   openPlaybook al crear una versión nueva
     1200 ms   location.reload() tras restaurar un respaldo
     1200 ms   migrarSiHaceFalta al arrancar

   De ahí las dos calmas: `quieto` (30 ms) vale para cambiar de vista, que es
   repintado síncrono vía fanout; `trasAccion` (150 ms) cubre los diferidos de
   40/60/100. Para los dos de 1200 ms NO se usa quiescencia: se espera a la
   navegación o al selector que sólo existe después.

   Antes de meter `quieto` en un sitio nuevo: mira si ese camino difiere algo. */
export const trasAccion = (pg) => quieto(pg, 150, 3000);

/* Tras guardar en un editor hay dos oleadas: se cierra el overlay y se repinta
   lo que dependa del dato. Más calma y más tope que un simple cambio de vista. */
export const trasGuardar = (pg) => quieto(pg, 60, 3000);
