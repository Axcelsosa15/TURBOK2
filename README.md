# TURBOK2 · Cabina

Cockpit de sesión para intradía en futuros, con journal de inversiones, playbook
por instrumento y calculadoras de riesgo e interés compuesto.

Es **una sola página**: `index.html` lleva dentro el HTML, el CSS y el JS. Sin
build, sin bundler, sin dependencias. Lo único que carga de fuera son las
tipografías de Google Fonts.

## Qué hay dentro

| Pestaña | Para qué |
| --- | --- |
| **Cabina** | Una pre-sesión por sesión de mercado (Asia, Londres, NY AM, Lunch, NY PM); niveles del día; **motor de reglas duras** que vigila instrumento, pérdida máxima, pérdidas seguidas, tope de ganancia y contratos con las operaciones del día; **centro de mando de cada cuenta prop** (balance, estado operativo, consistencia, drawdown, riesgo del día, rendimiento de hoy y curva); sesión de hoy con el banner en vivo y el desglose por sesión; y calendario de resultados. |
| **Futuros** | Journal de operaciones: resumen, cuentas, análisis (R múltiple, sesión de mercado, franjas horarias, día de la semana, consistencia), diario del día agrupado por sesión, e **historial de pre-sesiones** con el resultado que dio cada una. |
| **Inversiones** | Posiciones y operaciones por mercado, con métricas de asignación y salud de la cartera. |
| **Playbook** | Una sección por tipo de instrumento: futuros, perpetuos, opciones, cripto, acciones y ETFs, bonos, bienes raíces. |
| **Formas de hacer dinero** | Ideas por categoría, con estado y notas. |
| **Calculadora** | Interés compuesto y dimensionado de riesgo a partir de la cuenta y la regla dura. |

Todo en español y en horario de 12 horas. La hora de referencia es Nueva York
(ET), incluido el cambio de día: a medianoche en ET la cabina abre sesión nueva.

### La sesión es la unidad

La jornada se parte en ocho tramos en hora de Nueva York, sin huecos:

| Sesión | Tramo ET | Lista propia |
| --- | --- | --- |
| Asia | 8:00 PM – 2:00 AM | sí |
| Londres | 2:00 – 7:00 AM | sí |
| Pre-mercado | 7:00 – 8:30 AM | no, es la preparación de NY AM |
| NY AM Kill Zone | 8:30 – 11:00 AM | sí |
| Lunch | 11:00 AM – 1:30 PM | sí |
| NY PM | 1:30 – 4:00 PM | sí |
| Cierre RTH | 4:00 – 5:00 PM | no |
| Pausa diaria | 5:00 – 8:00 PM | no |

De esa tabla salen tres cosas a la vez: el reloj de la cabecera, la sesión a la
que pertenece cada operación (por su hora de entrada) y las cinco pre-sesiones
que se preparan por separado. Cada una guarda su lista, se sella aparte y queda
congelada sin tocar las demás.

### Cómo se archiva cada cosa

Escribes el instrumento en «Registrar operación» y la app decide el destino:

| Escribes | Va a | Por qué |
| --- | --- | --- |
| `MNQ`, `ES`, `MGC` | Journal de Futuros | contrato con valor de punto conocido |
| `MESZ5` | Journal de Futuros | contrato con mes de vencimiento |
| `ETHUSDT`, `BTC-PERP` | Journal de Futuros | perpetuo |
| `SPY 250117C500` | Inversiones · Opciones | contrato de opciones |
| `BTC`, `ETH`, `IBIT` | Inversiones · Cripto | activo conocido |
| `SGOV`, `TLT` | Inversiones · Bonos | activo conocido |
| `O`, `VNQ` | Inversiones · Bienes raíces | activo conocido |
| `VTI`, `QQQ` | Inversiones · ETFs | activo conocido |
| cualquier otro | Inversiones · Acciones | no es un contrato de futuros |

Siempre se puede forzar el destino a mano antes de guardar.

## Traer los datos desde el artefacto

Las dos copias no se hablan solas: cada una guarda en su sitio. El puente es un
archivo JSON, y está construido en las dos direcciones.

1. Abre la Cabina del artefacto y baja hasta **«Copia de seguridad y traspaso»**,
   al final de la primera pestaña.
2. Marca **«Meter las capturas dentro del archivo»** si quieres que los gráficos
   de cada operación viajen también. Sin eso el archivo pesa poco, pero las
   capturas se quedan atrás: viven en el almacenamiento del artefacto y desde
   fuera no se pueden leer.
3. Pulsa **«Descargar copia»**. Se descarga `cabina-AAAA-MM-DD.json`.
   Si la descarga no está disponible en esa vista, **«Ver el texto»** te lo deja
   en el portapapeles.
4. Abre esta copia, ve al mismo panel, elige **«Reemplazar todo»** y pulsa
   **«Elegir archivo…»** (o **«Pegar el texto»**).
5. Revisa el resumen que sale — dice qué trae y qué va a pasar — escribe
   `IMPORTAR` y confirma. La página se recarga con los datos dentro.

Funciona igual al revés. Un par de detalles que conviene saber:

- **`format` y `version`.** El archivo lleva las dos marcas. Si algún día cambia
  la forma de los datos, quien importe sabrá de qué versión viene en vez de
  romperse en silencio. Una copia más nueva que la cabina que la lee se rechaza
  con un aviso claro.
- **Reemplazar vs. añadir.** En el navegador se puede empezar de cero. Contra la
  base del artefacto la importación solo escribe encima por id y **nunca borra**
  lo que no venga en la copia: un borrado masivo en la nube no se deshace.
- **Las capturas importadas se ven pero no se editan** en una copia estática: sin
  almacenamiento de imágenes se pueden mirar y quitar, no añadir nuevas.

## El motor de cálculo · QuantEngine v2

Todos los números salen de `engine/quant/`. Funciones puras: sin DOM, sin reloj,
sin `Math.random()` sin semilla, sin dependencias. **253 pruebas**:

```bash
node engine/quant/quant.test.js
```

### Capas

| Módulo | Qué resuelve |
| --- | --- |
| `kernel.js` | `Result` único, guardas, dinero en **centavos enteros**, PRNG sembrado, normal inversa |
| `contracts.js` | rejilla de ticks de 18 futuros; el invariante `multiplier == tickValue / tickSize` se verifica al cargar |
| `trade.js` | P&L exacto en ticks enteros, R como cociente de ticks, dimensionamiento de posición |
| `stats.js` | Welford, cuantiles tipo 7, Wilson, bootstrap sembrado, muestra mínima, significancia |
| `edge.js` | esperanza con IC, profit factor, Kelly, SQN, rachas, distribución de R, concentración |
| `curve.js` | curva de capital y drawdown como **máquina de estados**; consistencia |
| `survival.js` | Monte Carlo de supervivencia de cuenta y barrido de tamaño de posición |
| `compliance.js` | veredicto operativo: QUEMADA > BLOQUEADA > RESTRINGIDA > AVISO > LISTA |
| `index.js` | fachada + adaptador para Cabina (`calcularTradeApp`, `radiografiaCuenta`) |

### Las tres reglas que el motor no rompe

1. **Ningún estadístico se devuelve desnudo.** Cada número viaja con su `n`, su
   error estándar y un veredicto de fiabilidad. Un profit factor de 2.4 sobre 6
   operaciones y uno sobre 600 se imprimen igual y no significan lo mismo; el
   motor está obligado a decir cuál es cuál.
2. **Lo que no se puede calcular devuelve `null` y dice por qué.** Sin valor de
   tick no hay P&L: nunca un multiplicador supuesto. Sin perdedoras el profit
   factor es *indefinido*, no `Infinity`.
3. **Puro y determinista.** Misma semilla, mismo resultado. Una simulación que
   no se puede reproducir no es evidencia.

### Decisiones de diseño que costaron algo

**El dinero vive en centavos enteros.** El float sólo existe en la frontera.
Mil operaciones de \$1.00 suman exactamente \$1000, no \$999.9999999998.

**El dato primario de un contrato es `(tickSize, tickValue)`; el multiplicador es
derivado.** Un futuro no se opera en puntos, se opera en ticks: el P&L es siempre
un múltiplo entero del valor del tick. Escribir el multiplicador a mano permite
specs incoherentes que producen P&L plausible pero falso durante meses. Aquí el
invariante revienta al cargar el módulo. Efecto lateral: los precios fuera de
rejilla (tipeos) se detectan y se avisan en vez de tragarse.

**Monte Carlo en vez de la fórmula clásica de riesgo de ruina.** La fórmula de
Vince asume ganancia y pérdida de tamaño fijo y ruina en cero. Ninguna de las
tres es cierta aquí: la distribución de R tiene colas, el suelo es móvil
(*trailing*) y encima hay límite de pérdida diaria y regla de consistencia que
interactúan entre sí — un día grande puede **retrasar** el aprobado aunque el
objetivo ya esté cubierto. Remuestrear las operaciones reales respeta la forma
real de la distribución sin asumir normalidad.

**Base del trailing: `cierre` vs `intradía`.** El pico se actualiza al cerrar el
día o operación a operación. Es la diferencia entre pasar y quemar una cuenta, y
casi ninguna herramienta lo modela.

**La consistencia no impide operar, impide cobrar.** Marcarla como «no puedes
operar» es factualmente falso y además empuja al trader a dejar de registrar
justo los días con más información.

### Cómo llega el motor a la app

`index.html` es un solo archivo sin imports, así que `engine/quant/bundle.mjs`
concatena los módulos en un único ámbito:

```bash
node engine/quant/bundle.mjs   # escribe engine/QuantEngine.bundle.js
```

Ese bundle va literal dentro de `index.html` como `const QE = (function(){…})()`.
El encierro no es decorativo: motor y app tienen funciones con el mismo nombre y
distinto comportamiento — `toNum("")` da `null` en el motor y `num("")` da `0` en
la app — y sueltas en el mismo ámbito la del motor ganaría por *hoisting* sobre
todos los formularios.

El motor se expone además como `window.QuantEngine` **a propósito**: es puro y no
muta nada, así que desde la consola del navegador puedes interrogar tus propios
datos sin pasar por la interfaz.

```js
QuantEngine.analizarEdge(ops)          // ventaja con intervalos de confianza
QuantEngine.simularCuenta({…})         // probabilidad de pasar vs quemar
QuantEngine.barridoDeRiesgo({…})       // dónde deja de convenir subir tamaño
QuantEngine.radiografiaCuenta(tr, ac)  // todo junto para una cuenta
```

`tradeCalc` no calcula: pregunta. Devuelve las mismas claves de siempre
(`pnlEff`, `rReal`, `rPlanned`, `riskUsd`, `multUnknown`, `calcError`), así que
**ninguna función de render cambió una sola línea**. Verificado por diff de
salidas: 7 archivos de prueba de comportamiento, 0 diferencias.

**Comisiones automáticas apagadas por defecto.** El motor las conoce por
instrumento, pero encenderlas bajaría el P&L de todo el histórico; hasta que
`settings.meta.autoFees` sea `true`, manda el campo «Comisiones $» escrito a mano
y ningún número del pasado cambia de valor.

### Números en negativo

Tres defectos reales de signo, encontrados probando la app con una cuenta en
pérdida en vez de con una ganadora. Los tres estaban a la vista y ninguno daba
error: producían cifras plausibles y falsas.

**1. La consistencia inventaba un 100% sobre una cuenta en rojo.**

```js
const ratio = total > 0 ? best / total : (best > 0 ? 1 : 0);   // antes
```

Ese `1` era un centinela interno que acababa impreso como
`Consistencia 100% sobre un límite de 30%` en una cuenta que iba `-$120`. La
consistencia reparte GANANCIAS: sin ganancia acumulada el cociente no existe.
Ahora es `null`, el estado se llama `NO APLICA`, y el texto dice el problema de
verdad — *«el problema no es la consistencia, es el resultado»*. Lo que sí
sigue siendo medible (cuánta ganancia falta para poder cobrar) se conserva.

**2. Un retiro guardado en negativo hacía la cuenta más rica.**

`balance = size + total + deposits − payouts`, y el importe se leía tal cual. Un
respaldo con `{kind:"payout", amount:-500}` restaba `−500`, es decir sumaba.
Medido de extremo a extremo con tres movimientos en negativo:

| | Balance |
| --- | --- |
| antes | `$25,300` **(+$300)** |
| después | `$24,700` **(−$300)** |

$600 de dinero fantasma. El **tipo** del movimiento lleva el signo, así que el
importe se lee siempre como magnitud (`Math.abs`) en el saneador de importación,
en la suma y en la tabla.

**3. Doble signo en la tabla de movimientos:** `+-$200`, `--$50`.

Además:

- `size`, `dd` y `target` se rechazan en negativo: un drawdown negativo no
  significa nada y envenena el suelo, el colchón y toda la simulación.
- `total` (ganancia previa) **sí** acepta negativo — es un resultado, no un
  tamaño — y el campo lo dice.
- La esperanza distingue ahora tres estados y no dos: ventaja confirmada,
  ventaja sin confirmar, y ventaja *medidamente negativa*. Pintar las dos
  últimas igual borra la diferencia entre «no lo sabemos» y «estás perdiendo».
- Los importes del panel llevan signo siempre visible (`+$120` / `-$120`): en
  una rejilla de cifras un menos fino se pierde de vista.

**Ejemplo en rojo.** El panel trae un botón que carga un sistema sintético
perdedor (32% de acierto, payoff 1.6:1) para ver la radiografía en rojo sin
perder dinero de verdad. Va marcado en pantalla y **no entra en ninguna
colección**: las operaciones reales siguen intactas.

### Un solo sitio para cada cosa

Después de arreglar los tres errores de signo busqué la misma familia de bugs a
propósito, en vez de esperar a tropezarla. Apareció algo peor que un signo: **un
motor de riesgo entero duplicado fuera del motor**, en la calculadora de riesgo.

| Duplicado en la interfaz | Ya existía en el motor | Por qué importa |
| --- | --- | --- |
| `riskThreshold()` | `sueloPara()` | **Dos definiciones del suelo de la cuenta.** Es el bug de las dos tablas de multiplicadores otra vez: en cuanto una cambia, la calculadora y la tarjeta discrepan sobre si estás vivo. |
| `riskSim()` | ahora `simularParametrico()` | Un segundo Monte Carlo, con su propio generador, sin una sola prueba. |
| `rngOf()` | `rng()` | Copia byte a byte del mismo mulberry32. |
| `streakProb()` | ahora `probabilidadDeRacha()` | Programación dinámica exacta; merecía pruebas. |

El modelo paramétrico —ganancia fija `R`, pérdida fija `1`— **no** se sustituyó
por el bootstrap. Ahí es el modelo correcto: la calculadora pregunta *«y si mi
acierto fuera del 45%»*, o sea la hipótesis **es** la entrada y no hay
distribución real que remuestrear. Lo que no tenía por qué tener era su propio
generador, su propio suelo y cero pruebas. Ahora vive en `survival.js` junto al
bootstrap, y cada uno responde la pregunta que le toca.

Salida de la calculadora antes y después de la consolidación: **idéntica al
carácter**. Un refactor que cambia un número no es un refactor.

**Y se acabó el `∞`.** La app imprimía `∞` como profit factor en cuatro sitios
cuando no había ninguna operación perdedora. El motor ya se negaba a hacerlo;
la interfaz no. Ahora `futStats` devuelve `null` con `pfRazon`, y la tarjeta
dice *«sin operaciones perdedoras: indefinido»* en vez de insinuar un sistema
perfecto que sólo tuvo pocas operaciones.

### Tiempo real, y lo que encontré al medirlo

«Que todos los números se ajusten solos al entrar una operación» sonaba a que
ya funcionaba: el store abanica a doce renders. Así que en vez de suponerlo, lo
medí. La verdad de referencia es **lo que muestra la app tras recargar**:
cualquier valor que difiera entre *actualizado en vivo* y *tras recargar* está
rancio.

**549 valores numéricos**, seis pestañas, todas las sub-vistas: **cero rancios**.
La propagación estaba bien. Lo que no estaba bien era otra cosa.

**1. El pico podía BAJAR, y eso congelaba el colchón en «lleno».**

El pico se calculaba sobre los cierres diarios *recalculados*. Con dos
operaciones el mismo día, el «cierre» de hoy cambia con cada una:

| | balance | pico | suelo | colchón |
| --- | --- | --- | --- | --- |
| tras +$120 | 25,120 | 25,120 | 24,120 | $1,000 |
| tras −$40 | 25,080 | **25,080** ↓ | 24,080 | **$1,000** |
| tras −$40 | 25,040 | **25,040** ↓ | 24,040 | **$1,000** |

El suelo perseguía al balance hacia abajo, así que **el colchón salía siempre
lleno: perdieras lo que perdieras, la app decía que te quedaban $1.000**. El
único número que avisa de que vas a quemar la cuenta estaba clavado en «todo
bien» por construcción.

El pico es un **trinquete** sobre el recorrido del capital, no un máximo de
agregados que se recalculan. `QE.construirCurva` ya lo hacía bien, así que
`acctAgg` ahora se lo pregunta — y de paso desaparece la **tercera** copia de la
fórmula del suelo. Corregido: pico `25,120` fijo, colchón `$1,000 → $960 → $920`.

Con esto llega un campo nuevo por cuenta, **«El pico se marca…»**: *intradía*
(operación a operación) o *al cierre del día*. Decide si un máximo que tocaste a
media sesión cuenta, y es la diferencia entre pasar y quemar una cuenta. El
valor por defecto es **intradía** porque es lo conservador: nunca te infla el
colchón.

**2. La calculadora de riesgo dimensionaba sobre un balance viejo.**

`loadAcctIntoRisk` **copiaba** balance y pico a sus campos. Una vez copiados se
congelaban: la tarjeta decía `$25,080` y la calculadora seguía en `$25,120`, con
umbral, colchón, ruina y número de contratos calculados sobre el balance
equivocado. Justo el panel con el que decides el tamaño.

Ahora queda **vinculada**: los cinco campos que derivan de la cuenta se releen
solos al entrar una operación, y el panel lo dice (`● en vivo desde LucidFlex
25K`). Si escribes tú uno de esos campos, mandas tú: se desvincula y lo avisa,
en vez de que el siguiente trade te pise el número.

**3. Un `catch {}` vacío escondía un fallo permanente.**

El abanico era `try { renderHistory(); renderAccounts(); renderRules(); } catch {}`.
Si el primero lanzaba, los otros dos **no corrían** y nadie se enteraba: números
clavados, cero errores en consola. Ahora cada render está aislado, un fallo se
nombra en pantalla, y el primer arranque con el cambio destapó esto:

```
render «respaldo» falló: ReferenceError: Cannot access 'BK_PARTS' before initialization
```

`BK_PARTS` se declaraba **después** de la suscripción, y `subscribe()` ejecuta su
callback de inmediato: el panel de respaldo llevaba fallando en silencio en cada
arranque. Arreglado moviendo la declaración delante de quien la usa.

### El motor anterior

`engine/MathEngine.js` (v1, 92 pruebas) queda en el repo como referencia
histórica. **No lo usa nadie**: `index.html` ya no lo carga. Su aportación fue
sacar el cálculo de una operación del render; lo que le faltaba era todo lo
demás — la curva, el drawdown como estado, y cualquier noción de cuánta de una
cifra es señal.

## Cómo fluye un dato

No hay framework: una colección en memoria es la única fuente y todo lo demás
son lectores suscritos a ella.

```
openTrade() ─► coll("trades").set(id, rec) ─► localStorage | base del artefacto
                        │
                        └─ emit() ─► renderFutures()      (journal, tiles, calendario)
                                     renderAccounts()     (balance, drawdown, estado)
                                     syncDayFromTrades()  (P&L del día en Cabina)
                                     renderRules()        (motor de reglas duras)
                                     renderHistory()      (historial y calendario)
                                     invalidatePre()      (vista de pre-sesiones)
```

Un detalle que confunde: **un stop es un plan, no un hecho.** Una operación con
entrada y stop pero sin salida sigue ABIERTA y su P&L es cero, así que el
balance no se mueve — que es lo correcto. Cuando de verdad toca el stop, el
botón `abierta · tocó el stop` de la columna de salida la cierra al precio del
stop y el resto se actualiza solo.

## Dónde se guardan los datos

Depende de dónde se abra la página:

- **Como artefacto de Claude**: base de datos del artefacto (sincroniza entre
  dispositivos) y subida de capturas de pantalla por operación.
- **Servida como archivo estático** (GitHub Pages, Vercel, o abriendo el
  archivo a mano): `localStorage` del navegador. Los datos **no salen del
  equipo**, no se sincronizan entre dispositivos y se pierden si se borran los
  datos del sitio. Las capturas quedan dentro de la propia operación como data
  URI, así que conviene no abusar.

Dicho claro: este repositorio guarda **el sistema, no los datos**. Clonarlo no
trae tu journal.

## Abrirla en local

```sh
python3 -m http.server 8000
# luego: http://localhost:8000/
```

Vale con abrir `index.html` directamente en el navegador; el `http.server` solo
evita rarezas con `file://`.

## Publicarla

El repositorio ya trae `.nojekyll`, así que sirve tal cual desde **GitHub
Pages** (Settings → Pages → Deploy from a branch → `main` / `root`) o desde
**Vercel** (importar el repo, sin framework, sin build).

La página lleva `<meta name="robots" content="noindex, nofollow">`. Si algún día
quieres que la indexen los buscadores, quita esa línea del `<head>`.

> El repositorio es público: cualquiera puede leer el código y los valores por
> defecto de las reglas y las cuentas de ejemplo. Tus operaciones no están aquí
> — viven en tu navegador.
