# Protocolos

Procedimientos de este repositorio. Ninguno es teórico: cada uno existe porque
algo falló primero, y debajo de cada protocolo está escrito **qué falló**. Sin esa
línea el protocolo es una opinión, y las opiniones se saltan cuando hay prisa.

La columna que más importa es la última: **quién lo vigila**. Un protocolo que
sólo vive en un documento se podrece igual que se podrió `preview.html` — seis
días en verde midiendo una copia congelada. Los que dicen *humano* son los
frágiles, y están marcados para que se sepa.

La última fila vigila a las demás: `capa2` §14 falla si algún documento cita
una sección del guardián que no existe. Se añadió porque §9, §10 y §11 se
citaron durante una sesión entera con una numeración que sólo estaba en la
cabeza de quien escribía — en el fichero únicamente estaban etiquetadas §12 y
§13, así que nadie podía seguir la referencia.

| # | Protocolo | Quién lo vigila |
|---|---|---|
| 1 | Publicar un cambio en la app | `capa2` §9 (parcial) + humano |
| 2 | Antes de decir «verde» | `correr.mjs` |
| 3 | Añadir o cambiar una regla de `capa2` | humano |
| 4 | Añadir una prueba | `capa2` §9, §13 |
| 5 | Qué nunca entra al repositorio | humano |
| 6 | Cuando CI falla | humano |
| 7 | Republicar el artefacto | `capa2` §12 (parcial) |
| 8 | Al clonar | humano |
| 10 | Tocar el motor de cálculo | `motor-bundle` + `capa2` §15 |
| 11 | Una aserción puede fallar por el motivo correcto | humano |
| 12 | El porcentaje de riesgo se pasa como fracción | `invariantes` |
| — | *Que esta tabla no mienta* | `capa2` §14 |

---

## 1 · Publicar un cambio en la app

`index.html` es la fuente. `test/preview.html` se **genera** y no se versiona.

```
1. editar index.html          (o traer el cuerpo: node test/sync-index.mjs <ruta/cabina.html>)
2. npm run preview            ← regenera test/preview.html desde index.html
3. npm test                   ← 45/45 o no se sigue
4. git commit && git push
5. republicar el artefacto    (ver protocolo 7)
```

**El paso 2 no es opcional y es el que se olvida.** Las pruebas cargan
`preview.html`, no `index.html`. Si no se regenera, miden el archivo viejo.

> **Qué falló:** siete pruebas apuntaron durante seis días a un `preview.html`
> obsoleto — 633 KB contra 774 KB, sin una sola mención de `posPerf`, `INV`,
> `TES`, `tesisCalc` ni `QE.dimensionar`. Estuvieron en verde todo ese tiempo
> midiendo código muerto, y se anunció «42/42» cuatro veces. Una imprimía
> `cuenta en Cabina del journal: undefined` sin que nadie lo mirara.

`capa2` §9 comprueba que `preview.html` contiene los símbolos de `index.html`,
así que caza un preview rancio. No caza que te olvides del paso 5.

---

## 2 · Antes de decir «verde»

> **La regla, en una línea:** no aceptar «verde», «sincronizado», «publicado» ni
> un número de tests como evidencia **hasta comprobar exactamente qué se
> ejecutó**.

Esta sesión la violó cuatro veces, y cada una parecía un hecho:

| Se dijo | Qué era en realidad |
|---|---|
| «42/42 en verde» | siete pruebas medían un `preview.html` de seis días antes |
| «44/44 en verde» | 37 procesos no se rompieron; las aserciones no se miraban |
| «45/45 en verde» | no incluía las 421 aserciones del motor: nada las ejecutaba |
| «todo el código está subido» | cierto, y contestaba a la pregunta equivocada |

No se reporta un número sin haber mirado la salida.

- **Un código de salida 0 no es prueba de nada.** De 45 archivos, 30 sólo
  *miden* (imprimen mediciones, no afirman) y salir 0 es correcto en ellos. De
  los que afirman, varios no contaban sus fallos.
- `correr.mjs` marca rojo si el proceso **se rompe O si la salida contiene ❌**,
  e imprime las líneas que fallaron. Eso cubre los 45 y los que vengan.
- Si un test nuevo afirma algo, su `process.exit` debe reflejar sus aserciones
  de todos modos. El runner es la red, no la excusa.

> **Qué falló:** `correr.mjs` sólo miraba el código de salida. `cmd.mjs` falló
> una aserción real —la paleta no encontraba la cuenta— y la suite lo contó como
> ✅. Es decir: «44/44 en verde» significaba «37 procesos no se rompieron». Se
> descubrió viendo el ❌ en pantalla, no razonando.

---

## 3 · Añadir o cambiar una regla de `capa2`

**Una regla no se da por buena hasta verla roja.**

```
1. escribir la regla
2. sabotear el código que vigila     ← a propósito, en el sentido que la regla prohíbe
3. confirmar que se pone ROJA y que el mensaje nombra el problema
4. restaurar
5. confirmar que el md5 del cuerpo de index.html no cambió
```

Y la regla tiene que afirmar **una razón cierta**. Si dice «sin esto X revienta»,
hay que haber comprobado que X revienta.

> **Qué falló:** dos veces en el mismo turno. §12 decía «sin el ternario
> `window.claude && … : null` la página servida revienta en el primer `await`»:
> falso, el `catch` de al lado ya asigna `null`. Reescrita para vigilar el
> `catch`: igual de falso, quitarlo deja que cubra el ternario. Son defensa
> redundante y cada una basta sola, así que la regla acabó exigiendo **al menos
> una** — lo único cuya ausencia rompe algo. Antes, un sabotaje a §10 no llegó a
> aterrizar y el guardián se quedó en verde sin que nadie lo notara.

> Y del propio encabezado de `capa2.mjs`: *«un guardián que falla siempre acaba
> ignorado, que es peor que no tenerlo»*. Un falso positivo es fatal; un falso
> negativo es tolerable.

---

## 4 · Añadir una prueba

- **Ninguna ruta absoluta del sistema.** Ni para leer, ni para escribir, ni para
  capturas. Lo relativo sí: `process.cwd() + '/preview.html'`,
  `new URL('./x', import.meta.url)`. Vigilado por `capa2` §13.
- **La semilla es `test/semilla.json`**, importada como `SEMILLA` desde
  `espera.mjs`. Una sola copia, resuelta contra la ubicación del módulo.
- **Nada de esperas fijas.** `espera.mjs` tiene `quieto`, `trasAccion`,
  `trasGuardar`, `enDisco`, `arrancada`, `siembra`. Ojo con los dos guardados
  con retardo: `persistDay` a 400 ms y `persistSettings` a 500 ms — no son
  `setTimeout` literales, así que no salen buscando `setTimeout(`; para eso está
  `enDisco()`.
- **Sembrar con `siembra()`**, nunca con `addInitScript` + `localStorage.getItem`
  condicional. Un `setItem` **incondicional** en `addInitScript` sí es fiable —
  es lo que hacen 24 archivos— pero corre en **cada navegación**, así que un test
  que recarga a propósito se re-siembra a sí mismo.
- **`page.reload()` sobre `file://` tira el almacén de forma intermitente.** Para
  comprobar que algo sobrevive a reabrir, se lee lo que quedó escrito y se abre
  una **pestaña nueva** sembrada con exactamente eso (`sync.mjs` y `borrar.mjs`).
  Recargar mide el navegador, no la app.

> **Qué falló:** tres pruebas leían `/tmp/semilla.json`, un archivo que existía
> sólo en el contenedor donde se escribieron. Verdes aquí, ENOENT en CI. Antes,
> 44 de 48 archivos importaban Playwright por
> `/opt/node22/lib/node_modules/playwright/index.mjs`: nadie que clonara el
> repositorio podía correr una sola prueba. Y `tesis.mjs` iba inestable 8 de 10
> veces porque `addInitScript` con un `getItem` condicional no es fiable en
> `file://` — al arrancar el almacén no está ligado, `getItem` devuelve null y la
> semilla se reescribe encima.

> **Y lo que costó más de encontrar:** `borrar.mjs` falló en CI y no aquí — 33 s
> en el runner contra 18 s en local. Tres hipótesis mías fueron falsas (un
> debounce, una carrera de CPU a 8× de estrangulamiento, una caducidad de la
> papelera) antes de que la causa apareciera escrita **en este mismo
> repositorio**: el comentario de `sync.mjs` ya decía que `file://` tira el
> almacén al recargar. Y al arreglarlo salió un segundo defecto, peor: la semilla
> resucitaba las 2 operaciones borradas en la recarga, así que «vuelven las 6
> operaciones» pasaba demostrando que la semilla se re-ejecutó, no que
> «Deshacer» funcione. Medido: 6 en disco antes del clic. Ahora se comprueba
> además que al reabrir el borrado **sigue hecho** (4), que era la mitad que
> faltaba.

---

## 5 · Qué nunca entra al repositorio

Es público. No entra:

- **Operaciones, cuentas o reglas reales.** Los fixtures son **sintéticos**: la
  misma forma, todos los valores inventados.
- **Capturas de gráficos de operaciones.** Las del artefacto quedan
  inventariadas en `ARTEFACTO.md` por id y sha256, y fuera del repositorio.
- Claves, tokens, correos.

Subir algo aquí **no se deshace**: queda en el historial y se indexa.

> **Qué falló:** la semilla de `/tmp` que tres pruebas leían eran datos reales —
> 18 operaciones MNQ, dos cuentas prop con su tamaño y su drawdown, y seis reglas
> con el criterio de su autor escrito («MGC eliminado: instrumento perdedor
> documentado»). Estuvo a un `git add` de ser pública.

---

## 6 · Cuando CI falla

**Leer el log antes de teorizar.** Siempre. Sin excepción.

```
mcp__github__actions_list   → encontrar el run y su conclusión
mcp__github__get_job_logs   → failed_only: true, return_content: true
```

Un fallo de 11 segundos no ejecutó nada: murió en el montaje. Un fallo de siete
minutos sí corrió la suite y está diciendo algo del código.

> **Qué falló:** en esta sesión, tres diagnósticos por lectura de código fueron
> desmentidos por la primera medición: un «filtro fantasma» que no existía, un
> test lento que se culpó al sondeo de rAF cuando era la siembra, y la causa del
> parpadeo. Y la propia suite de CI se empujó sin haberla ejecutado nunca en un
> runner: tres fallos distintos seguidos, uno por push.

---

## 7 · Republicar el artefacto

- **Omitir `capabilities`.** Eso arrastra la declaración guardada intacta y
  mantiene fijado el contrato. Pasarla de nuevo es una declaración **completa**:
  lo que no se repita queda revocado.
- **Mover el contrato es deliberado**, nunca un efecto colateral de editar.
- El contenido es `index.html` **desde el segundo `<style>`** en adelante. Lo de
  antes y después es la cáscara de página estática que añade `sync-index.mjs`.
- `permissions` **no se declara**: es built-in y declararla la rechaza el
  contrato.

**Hoy `index.html` va por delante de lo publicado**, en comentarios y en una
función muerta — cero cambio de comportamiento. El alcance exacto y cómo cerrar
la divergencia están en [ARTEFACTO.md](ARTEFACTO.md), y ahí queda escrito que en
cuanto toque una línea que se EJECUTA deja de ser aceptable.

Detalle completo en [ARTEFACTO.md](ARTEFACTO.md). `capa2` §12 vigila que toda
capacidad que el código llame esté documentada, que `permissions` no figure entre
las declaradas y que cada llamada degrade a `null`.

> **Qué falló:** durante semanas el repositorio no registraba **nada** de esto.
> El dato de qué se declara al publicar vivía únicamente en la llamada de
> publicación, que no está en ningún archivo: quien clonara veía un HTML y
> ninguna forma de saber por qué el mismo archivo se comporta distinto según
> dónde se abra.

---

## 8 · Al clonar

Comprueba que el remoto tiene refspec:

```sh
git config --get-all remote.origin.fetch
# vacío → git fetch no trae nada y origin/main no existe:
git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
```

> **Qué falló:** en el clon donde se desarrolló esto, `remote.origin.fetch`
> estaba vacío. `git fetch origin main` no creaba `origin/main`, así que **no se
> podía comprobar localmente si algo estaba subido o si faltaba traer algo**. Se
> resolvió comparando el sha del árbol: `git write-tree` contra
> `git rev-parse origin/main^{tree}`. Si coinciden, cada byte rastreado está en
> el remoto.

---

## 10 · Tocar el motor de cálculo

El motor existe **tres veces**, y sólo una corre:

```
engine/quant/*.js   ──npm run bundle──►  engine/QuantEngine.bundle.js   ──a mano──►  index.html
   (11 módulos)                              (lo que se versiona)          (lo que EJECUTA el usuario)
```

Así que:

```
1. editar el módulo en engine/quant/
2. npm run bundle                    ← regenera el bundle
3. reincrustar el bundle en index.html, desde `const QE = (function () {`
4. npm test                          ← motor-quant, motor-math, motor-bundle y capa2 §15
```

Los cuatro eslabones están vigilados, cada uno por su pieza:

| Eslabón | Quién lo comprueba |
|---|---|
| los módulos hacen la cuenta bien | `motor-quant` (329 aserciones) |
| el motor v1 de referencia sigue válido | `motor-math` (92 aserciones) |
| el bundle es lo que producen los módulos | `motor-bundle` (`bundle.mjs --check`) |
| lo incrustado es exactamente el bundle | `capa2` §15 |

> **Qué falló:** nada todavía, y eso era el problema. La cadena era manual de
> principio a fin: `bundle.mjs` existía pero **no estaba en `package.json`**, y
> nada comparaba los tres. Estaba intacta por disciplina, no por comprobación.
> Peor: `correr.mjs` sólo escaneaba `test/`, así que las **421 aserciones** del
> motor —`quant.test.js` con 329 y `MathEngine.test.js` con 92— estaban en el
> repositorio y **no se ejecutaban jamás**. El «45/45 en verde» no las incluía.
> Es el fallo del `preview.html` rancio un nivel más abajo, y sobre la
> matemática del dinero: dimensionado en la rejilla de ticks, IRR, drawdown,
> Monte Carlo de supervivencia.
>
> Y `MathEngine.test.js` no sólo no corría: **estaba roto**. Usa `require()`, y
> el `"type": "module"` que se añadió al crear `package.json` lo dejó sin
> compilar. Dos commits en ese estado sin que nada lo dijera, porque nada lo
> ejecutaba.

---

## 12 · El porcentaje de riesgo se pasa como FRACCIÓN

`QE.dimensionar` acepta las dos formas y las distingue **por el valor**:

```
riesgoPct >= 1   se lee como PORCENTAJE   (1 -> 1%,  2 -> 2%,  50 -> 50%)
riesgoPct <  1   se lee como FRACCIÓN     (0.01 -> 1%,  0.005 -> 0.5%)
```

Está probado a propósito (`riesgoPct: 0.01` → 12 contratos), así que **la
convención del motor no se toca**. Lo que se hace es no depender de ella: quien
llame desde la interfaz pasa `pc / 100`, una fracción, que el motor lee igual en
todo el rango.

> **Qué falló:** el campo se llama «Riesgo por operación (%)» y su `step` es
> `0.1`, así que invita a escribir 0.5 queriendo medio por ciento. El motor leía
> 50%. Medido por la app, cuenta de 25 000 con stop de 10 puntos MNQ:
>
> | escrito | contratos antes | contratos ahora |
> |---|---|---|
> | 0.25 | 625 | 3 |
> | 0.5 | 1250 | 6 |
> | 1 | 12 | 12 |
> | 2 | 25 | 25 |
> | 50 | 625 | 625 |
>
> Un **100× en el tamaño de posición**, en el número más peligroso del sistema.
> No era silencioso —el motor avisaba «Arriesgar 50% por operación es
> agresivo»— pero el aviso decía 50% para quien había escrito 0.5, y nada lo
> bloqueaba. Arreglado en el sitio de llamada, no en el motor: para 1 y 2 el
> resultado no cambia, y de paso un riesgo menor al 1% pasa a ser expresable.

`test/invariantes.mjs` fija la doble lectura para que deje de sorprender:
comprueba que `0.5` y `50` significan lo mismo. Si alguien cambia la convención,
rompe una prueba en vez de un tamaño de posición.

---

## 11 · Una aserción tiene que poder fallar por el motivo correcto

Pasar y **demostrar lo que se busca** no son lo mismo. Tres formas de pasar por el
motivo equivocado, las tres encontradas aquí:

1. **La semilla hace el trabajo.** `borrar.mjs` afirmaba «vuelven las 6
   operaciones» tras recargar. La semilla se re-sembraba en cada navegación, así
   que volvían **antes** de pulsar «Deshacer». Medido: 6 en disco antes del clic.
   *Arreglo:* sembrar lo GUARDADO y comprobar además que **el borrado sigue
   hecho** (4) al reabrir — la mitad que faltaba.

2. **La app se compara contra sí misma.** `sync.mjs` afirmaba «todo sobrevive»
   con `pre === post`, dos fotos de la app. Con `foto()` devolviendo `null` en
   cada campo, **pasaba igual**: no distinguía «todo sobrevive» de «todo está
   vacío en los dos lados». *Arreglo:* anclar primero — números finitos, `n > 0`,
   cuentas > 0 — y después comparar.

3. **La aserción es demasiado laxa.** `bal1 !== bal0` («el balance se mueve»)
   pasaba con `NaN`. *Arreglo:* el valor exacto, `bal1 === bal0 - 40`, que es el
   que la propia confirmación de la app anuncia.

> **Qué falló:** los tres casos de arriba, los tres encontrados en este
> repositorio y los tres medidos con un sabotaje antes de arreglarlos. El peor
> fue `sync.mjs`: la prueba de persistencia pasaba con la app devolviendo
> `null` en cada campo.

Para los caminos del dinero —balance, dimensionado, P&L, drawdown, Monte Carlo,
IRR, borrado y deshacer, persistencia, reglas prop— la pregunta no es «¿pasa?»
sino **«¿podría pasar si la app estuviera rota?»**. Si la respuesta es sí, la
aserción no vale todavía.

Tres niveles, y cada uno responde algo que los otros no:

| Nivel | Qué prueba | Dónde |
|---|---|---|
| unidad | las funciones calculan bien | `motor-quant` 329, `motor-math` 92 |
| integración | la app consume **ese** motor | `motor-bundle`, `capa2` §15 |
| navegador | acción → DOM → cálculo → disco → reabrir → mismo número | `sync`, `borrar`, `servida` |

---

## · Lo que ningún protocolo cubre

*No es un protocolo: es la lista de lo que queda fuera del alcance de todos.*

Honestidad sobre los límites:

- **GitHub Pages hay que activarlo a mano una vez** (Settings → Pages → Source:
  GitHub Actions). El `GITHUB_TOKEN` de Actions no puede **crear** el sitio: eso
  es administración del repositorio. Mientras no esté activado, `pagina.yml`
  **avisa y se queda quieto** en vez de fallar — un check rojo en cada push
  entrena a ignorar el rojo, y quien dice si el código está bien es `pruebas`.
  En cuanto se active, el siguiente push que pase la suite publica solo.
- **La compartición del artefacto sólo la cambia su dueño**, desde el menú Share.
- **No hay LICENSE**, así que el repositorio es «todos los derechos reservados»:
  público para leer, sin permiso para usar.
