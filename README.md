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

### Lo que costaba el tiempo real

Después de arreglar el pico y el vínculo medí lo que nunca había medido: **qué
cuesta guardar una operación cuando el journal ya pesa.** Un intradiario de 3 a
5 operaciones al día llega a 2.500 en dos años, así que no es hipotético.

| operaciones | guardar 1 op (antes) | (después) |
| --- | --- | --- |
| 250 | 127 ms | **70 ms** |
| 1.000 | 360 ms | **159 ms** |
| 3.000 | 982 ms | **354 ms** |

Casi un segundo de retraso al registrar un trade con 3.000 en el histórico. Lo
primero fue descartar que lo hubiera roto yo con el trinquete del pico: medido
antes y después, **la diferencia está dentro del ruido** (978 → 967 ms). Era
previo. El perfil por render lo señaló sin ambigüedad: **93% en `renderFutures`**,
y dentro de él, `renderQE` — mi propio panel.

**El bootstrap asignaba un array por repetición.** `bootstrapCI` llamaba a
`momentos(buf)` en cada una de las 2.000 repeticiones, y `momentos` hace
`limpiar()`, que **asigna un array nuevo**. Con n=1500: 3 millones de elementos
copiados para calcular 2.000 medias, en cada render. Cuando el estadístico es la
media —el caso por defecto— ahora se acumula en línea, sin buffer. Misma
secuencia del PRNG, **mismo resultado bit a bit**: no cambia ni un decimal.
`analizarEdge` con 1.500 operaciones pasó de dominar el render a **36 ms**.

Además las repeticiones se escalan con `n` (`n ≤ 400` mantiene 2.000; por encima
se acota el trabajo total). Con muestras grandes el intervalo ya es estrecho y
2.000 repeticiones sólo compran decimales que nadie mira, a cambio de bloquear
la interfaz.

**`tradesOf` recalculaba lo mismo varias veces por render.** Filtra, valora y
**ordena** todas las operaciones; un solo render lo llamaba desde los tiles, los
filtros, las cuentas, el panel y los gráficos, repitiendo el mismo `O(n log n)`
sobre datos idénticos. Ahora se memoriza contra un contador de revisión
(`coll.rev`, que sube en cada `emit()`), así que si nada cambió no se recalcula
nada.

Memorizar es exactamente como se introducen datos rancios, así que la
verificación fue el mismo detector de antes: **549 valores, cero rancios**, más
las rutas de editar, borrar y el vínculo de la calculadora.

### Sacar a la superficie lo que ya estaba construido

Auditoría: qué capacidades del motor **no tienen superficie en la interfaz**.
Resultó que varias estaban construidas y probadas, y sin usar.

**1. Los avisos del motor no llegaban a la pantalla.** `valuarOperacion` detecta
precios que el contrato **no puede producir** —un `21000.13` en MNQ, que cotiza
de 0,25 en 0,25— y stops del lado equivocado. `tradeCalc` los descartaba. Un
dedazo en el precio de entrada corrompía P&L, R, riesgo y todo lo derivado sin
un solo aviso.

Ahora el editor los muestra **mientras escribes**, con un botón que corrige al
valor de la rejilla:

```
! La entrada 21000.13 no cae en la rejilla de MNQ (tick 0.25).   [usar 21000.25]
```

No bloquea el guardado: un contrato sintético no tiene rejilla y hay rellenos
raros de verdad. Pero el dedazo se caza cuando todavía se puede corregir, y no
dentro de un P&L que ya alimentó el balance, el drawdown y la consistencia.

Dos detalles que costaron su rato: los listeners se enganchan **una sola vez**
(`#edFields` persiste entre aperturas y re-suscribirse acumulaba uno por
apertura), y el botón de corrección usa **delegación** — al pulsarlo el input
pierde el foco, dispara `change`, la zona se repinta y el nodo del botón moría
entre el `mousedown` y el `click`.

**2. El peor momento de la cuenta se calculaba y se tiraba.** `peorMomento`
recorría la curva en cada render y se descartaba. Para una cuenta de fondeo es el
dato con más información que existe: no cuánto ganaste, sino **a cuánto llegaste
del suelo**. Ahora vive en el módulo de Drawdown y persiste:

```
LO MÁS CERCA QUE HAS ESTADO   $160   el 10 sep 26 · quedaba 16% del colchón
```

**3. `metricasCurva` nunca se llamaba.** Caída máxima y su fecha, días bajo el
agua, factor de recuperación, índice de úlcera, Sharpe y Sortino anualizados:
todo construido, probado y sin superficie. Ahora es una sección de la
Radiografía — y el veredicto del motor manda: con 11 días, Sharpe 6,72 y Sortino
24,02 salen **apagados** y marcados «sin fiabilidad todavía», con la explicación
de por qué las tres primeras tarjetas sí se leen y esas dos no.

**4. La tabla del diario pintaba todas las filas.** Con 3.000 operaciones,
~42.000 nodos en el DOM y el segundo coste más grande al guardar un trade.
Nadie lee la fila 1.800 desplazándose: se pinta un tramo de 250 y se amplía a
petición. El click ya estaba delegado, así que las filas nuevas funcionan solas.

| operaciones | guardar 1 op (v43) | (ahora) |
| --- | --- | --- |
| 250 | 148 ms | **95 ms** |
| 1.000 | 455 ms | **170 ms** |
| 3.000 | 1.284 ms | **286 ms** |

**Una mejora que descarté.** Tenía apuntado enrutar la calculadora de riesgo por
`QE.dimensionar` porque «ignora la rejilla de ticks». Al mirarlo de cerca, su
parametrización —puntos × $/punto— es **equivalente**: no había bug, y cambiarlo
habría sido cambio por cambio.

Verificación: 560 valores comparados en vivo contra tras recargar, cero rancios.
18 archivos de prueba, 0 errores de página. Diff contra la versión anterior:
**10 archivos, todos idénticos** — las cuatro mejoras son puramente aditivas y
ningún número existente cambió.

### Captura, no más análisis (MAE / MFE)

Hasta aquí, 45 versiones analizando datos que ya existían. Esto añade **datos
que no existían**, que es el cuello de botella real. `excursion.js`:

- **MAE** (*Maximum Adverse Excursion*): lo más en contra que fue antes de resolverse.
- **MFE** (*Maximum Favourable Excursion*): lo más a favor que llegó antes de que salieras.

Son los dos números que el P&L **no puede contener**, y contestan lo único que el
resultado no dice:

| Pregunta | Se responde con |
| --- | --- |
| ¿Cuánto podría apretar el stop sin perder ganadoras? | cuantil alto del MAE **de las ganadoras** |
| ¿Cuánto dejo en la mesa por salir pronto? | MFE frente a la salida real |
| ¿Cuántas ganancias reales devuelvo? | operaciones que llegaron a +1R y acabaron en pérdida |

**El MAE se mide sólo sobre ganadoras, a propósito.** En una perdedora el MAE
acaba siendo el stop por definición; meterlas contaminaría la conclusión.

**Un error de diseño que cazó la prueba.** La primera versión promediaba la
captura sobre todas las operaciones. En una perdedora que fue a favor y volvió,
la captura es *negativa*: el panel llegó a mostrar **«captura de la salida
−61,5%»**, que no significa nada. Ahora la captura se promedia sólo sobre
ganadoras, y las perdedoras que fueron a favor contestan su propia pregunta en
una tarjeta aparte — **ganancias devueltas**, el síntoma más caro que existe y el
que el P&L nunca ve, porque cuenta la pérdida y no la ganancia que hubo antes.

**Cuatro campos nuevos, todos opcionales**: hora de salida, por qué saliste
(objetivo / stop / manual / tiempo / noticia / nervios), MAE y MFE. Se piden
después de la salida porque antes no existen, y son opcionales por una razón de
diseño explícita: **un campo que frena el registro reduce el número de
operaciones registradas, y ese número es el cuello de botella**. Una operación
guardada sin ellos funciona exactamente igual.

La superficie es deliberadamente corta: tres tarjetas que sólo aparecen cuando
hay con qué sostenerlas. Sin datos suficientes sale un contador — *«llevas 3; con
5 empiezan a salir números y con 30 se pueden creer»*— que hace más por el
registro que cualquier gráfico.

### Inversión: cinco arreglos, uno de ellos matemático

El criterio de diseño aquí es **el contrario** al de futuros. En futuros, más
atención y más medición ayudan. En una cartera de largo plazo la atención es el
enemigo: mirar más lleva a tocar más. Todo lo de abajo está construido para que
abras este tab **menos**, no más.

**1. La rentabilidad estaba mal calculada.** `(valor − coste) / coste` es retorno
simple sobre coste total, y con aportes repartidos en el tiempo no es tu
rentabilidad: el dólar de enero trabajó doce meses y el de diciembre, cero.
Medido con un DCA de $200/mes sobre un activo que sube 10%:

```
  retorno simple    5.34%    ← lo que mostraba
  IRR anualizado   10.00%    ← lo que de verdad pasó
```

Casi la mitad — y el error va en la dirección peligrosa: **te hace parecer peor
de lo que eres**, lo que empuja a abandonar una estrategia que funciona. El tile
ahora titula con el IRR y relega el simple a subtítulo, con la brecha nombrada.

`portfolio.js` calcula el IRR por **bisección** sobre el valor capitalizado.
Newton converge más rápido pero puede divergir con flujos irregulares, y aquí
importa más no mentir que terminar rápido.

**Y lo que NO calcula:** el TWR verdadero necesita el valor de la cartera *en
cada fecha de aporte*, y eso no se registra. Se devuelve `null` con su motivo en
vez de aproximarlo y hacerlo pasar por exacto.

*Un bug propio, encontrado por el control:* la primera versión **dividía** por
`(1+r)^t` en vez de multiplicar — descontaba los aportes hacia adelante en lugar
de capitalizarlos. Daba **−9,06%** para una cartera que ganaba. Lo cazó el caso
de control: una compra única con +10% en un año tiene que dar 10,00% por ambos
métodos.

**2. La posición no soportaba DCA.** Una posición era *una* fecha, *una* cantidad,
*un* precio. El playbook de esta misma app recomienda «DCA mensual en índice»:
doce compras del mismo ETF no caben en ese molde. Y los datos ya existían — el
flujo de operaciones los tenía. Ahora la posición **se deriva de sus
operaciones** (emparejadas por activo + mercado), con coste medio, ventas
parciales y conteo de compras. Si no hay operaciones, mandan los campos escritos
a mano: nada de lo que ya tenías deja de funcionar.

**3. El precio actual no tenía fecha.** Una cartera valorada hace tres meses se
mostraba como «valor actual» sin más. Ahora cada precio se sella al guardarlo y
la fila dice *«hace 34 días»*, en ámbar pasada una semana y en rojo pasado un
mes. El scorecard mira la fecha, no sólo la existencia.

**4. ¿Cuánto te ha costado tocar?** El equivalente de «el protocolo, ¿paga?» en
inversión. Cada venta se puede marcar como desviación del plan, y para las que
tienen precio de referencia se calcula exactamente qué valdrían hoy esas unidades
frente a lo que te dieron. Sin contrafactual: las unidades existieron y el precio
de hoy lo tienes escrito.

**5. Fricción al VENDER, no al comprar.** En futuros el *gate* frena las entradas
fuera de protocolo. Aquí el error caro es el contrario, así que al elegir «venta»
aparece **el plan de salida que tú mismo escribiste**, con la línea que importa:
*«lo escribiste cuando no sabías el resultado»*. No bloquea —a veces vender es
correcto— pero obliga a leerlo antes.

329 pruebas del motor (36 nuevas de cartera). 23 archivos de prueba de la app.
Diff contra la versión anterior: 10 archivos, una sola diferencia — el texto del
tile de rentabilidad, que es el cambio buscado.

### El bug que introduje al arreglar el DCA

Veinte minutos después de derivar la posición de sus operaciones, fui a buscar
lo que acababa de romper. Lo encontré.

`posLotes` emparejaba por **activo + mercado**. Con **dos** posiciones del mismo
activo en el mismo mercado, cada una reclamaba el conjunto **completo** de
operaciones:

| posiciones de VOO | invertido | valor |
| --- | --- | --- |
| 1 | $2,400 | $2,528 |
| 2 | **$4,800** | **$5,056** |
| 3 | **$7,200** | **$7,584** |

La cartera mostraba el triple del dinero que hay. Y el escenario no es raro: es
exactamente el apaño que el modelo **viejo** obligaba a hacer —una posición por
compra— así que quien lo hubiera usado vería su patrimonio multiplicado el día
que actualizara.

**Cuando hay ambigüedad no se reparte a ojo.** Se cae a los campos escritos a
mano y la fila lo dice: *«3 posiciones de VOO aquí · únelas para derivar de las
operaciones»*.

**Y una segunda corrección, más pequeña:** el precio sólo se re-fechaba si el
número cambiaba. Si lo revisabas y seguía igual, contaba como viejo — pero lo
miraste hoy. Ahora se re-fecha siempre que haya precio.

Verificación: 24 archivos de prueba, 562 valores en vivo contra tras recargar sin
rancios, y **los 13 diffs idénticos** — el arreglo sólo toca la ruta de
posiciones duplicadas, que ninguna prueba anterior ejercitaba. Por eso existe
ahora `dup.mjs`.

### El diagrama, hecho ejecutable

Un diagrama de arquitectura es una afirmación, y una afirmación se comprueba.
`test/capa.mjs` mete tres operaciones y lee **las mismas siete magnitudes desde
CABINA y desde FUTUROS**, que las llaman distinto («Ganancia total» vs «P&L
NETO», «Suelo de la cuenta» vs «umbral»):

```
  magnitud            CABINA      FUTUROS
  ✅ ganancia total         140         140
  ✅ balance              25140       25140
  ✅ colchón               1000        1000
  ✅ suelo / umbral       24140       24140
  ✅ mejor día              120         120
  ✅ consistencia            86          86
  ✅ P&L (tiles)            140         140

  7/7 idénticas: las dos pestañas leen del mismo cálculo.
```

Y el escaneo estático lo respalda: **una sola definición** de `tradeCalc`,
`acctAgg`, `consistency`, `futStats`, `tradesOf`, `evaluateAccountRules`,
`posCalc`, `investStats` y `dayRuleCheck`, y **cero** sitios recalculando P&L a
mano. No siempre fue así — esta misma sesión eliminó la tabla `MULT` duplicada,
`riskThreshold`, `rngOf` y un segundo Monte Carlo.

**Las pruebas de la app vivían en un directorio efímero.** Si el contenedor
moría, se perdían — y con ellas la única forma de re-verificar que la
arquitectura sigue siendo cierta. Ahora están en `test/` (42 archivos), con
`test/build-preview.mjs` para reconstruir el preview desde `index.html`.

Las dos más valiosas no comparan contra un valor escrito a mano: comparan **la
app contra sí misma**. `vivo.mjs` compara *en vivo* contra *tras recargar*;
`capa.mjs` compara *una pestaña* contra *otra*. Eso encuentra cosas que un valor
esperado no encuentra, porque no depende de que a quien escribe la prueba se le
ocurra el caso.

### La puerta única (`FUT`)

El diagrama ya era cierto para los **números**: CABINA y FUTUROS leían de
`coll("trades")` y de `acctAgg`. Lo que no estaba unificado era la **selección
de cuenta**: `ft.acct` vivía solo en FUTUROS, CABINA no tenía selector, y la
única conexión era un botón que saltaba de una pestaña a la otra. Dos pantallas
de la misma cuenta podían estar mirando cosas distintas.

`FUT` es la capa de datos hecha explícita: lecturas, escrituras, selección,
cálculo y reglas en un solo objeto. **No calcula nada nuevo.** Cada función
delega en la implementación que ya existía, así que añadirla no puede crear una
segunda verdad; su valor es el contrario: convierte *«¿de dónde sale este
número?»* en una lista cerrada de sitios a los que se puede llamar.

```
                      FUT  ← window.FUT (depuración y pruebas)
   ┌───────────────────┼────────────────────┐
   lecturas        escrituras            cálculo
   accounts()      createTrade()         calculateAccountStats()
   trades()        updateTrade()         calculateConsistency()
   rules()         deleteTrade()         calculateDrawdown()
   selectedAccount() createAccount()     calculateEquityCurve()
                   updateAccount()       calculateStreaks()  …15 en total
                   deleteAccount()
                   updateRule()          reglas
                   setSelectedAccount()  evaluateRules(cuenta, fecha)
                   setFilters()
        │                    │                     │
        └──────── coll("trades") · state.settings · QE ────────┘
```

**La selección de cuenta es un solo estado**, guardado en los ajustes y por
tanto superviviente a un refresh. El selector de CABINA y el filtro de FUTUROS
escriben en el mismo sitio; ninguno avisa al otro porque los dos repintan desde
él. La tarjeta de la cuenta elegida se marca y sube arriba en CABINA — no se
ocultan las demás: la selección dice *«esta es la que estoy operando»*, no
*«olvídate del resto»*.

Dos cosas cambiaron de comportamiento al hacerlo:

- **FUTUROS → Cuentas ahora enseña el estado operativo** (LISTA / AVISO /
  RESTRINGIDA / BLOQUEADA / QUEMADA) que salía del mismo motor y solo se veía en
  CABINA. Enseñaba el dinero de la cuenta pero no si el día estaba cerrado.
- **El panel de reglas se mide sobre la cuenta seleccionada.** Antes sumaba el
  día de todas las cuentas, y entonces el panel y la tarjeta —que sí se mide por
  cuenta— podían discrepar del mismo día. Sin selección, sigue mirando el día
  completo.

Lo que **no** cambió, a propósito: los filtros de FUTUROS siguen sin tocar las
métricas de cuenta. `acctAgg` filtra por `accountId`, nunca por `ft`, así que
filtrar el análisis por instrumento no mueve el balance. `test/sync.mjs` lo
comprueba explícitamente, porque es el error clásico de esta separación.

`evaluateRules(cuenta, fecha)` es la firma completa: acepta una fecha, así que
se puede preguntar por un día que no es hoy, y devuelve además las listas de
`violations` y `warnings` y un `lockedUntil`. Los cierres por pérdida del día o
por racha duran hasta el cierre de **ese** día; una cuenta quemada no tiene
fecha de desbloqueo.

Tres pruebas del directorio estaban rotas **desde antes de esta sesión**, y las
tres por defectos de la propia prueba, no de la app:

- `vivo2` y `vivo3` medían un panel *desde otra pestaña* y lo comparaban contra
  el mismo panel visible: «oculto ≠ visible», ❌ garantizado sin que la app
  tuviera nada mal. Peor: `vivo2` preguntaba si el editor estaba abierto con
  `getElementById('ef_exit')`, y el overlay se queda en el DOM al cerrarse, así
  que el `fill` siguiente moría por *timeout* y se llevaba el resto del archivo.
  Sus partes B y C —editar y borrar desde el journal— apuntaban a un `#ftList`
  que no existe: llevaban imprimiendo «se revisa aparte» desde el primer día.
  Ahora miden en la misma pestaña, usan `.ov.open` y `#jrTable`, y **pasan**:
  editar de +$120 a +$400 y borrar una de dos se propagan solos.
- `perfil` y `ledger` morían por un archivo ausente (`preview_perf.html`,
  `prev_v1.html`): builds de usar y tirar que no están versionadas. Ahora se
  degradan — `perfil` mide reloj de pared sin el desglose, `ledger` se salta la
  mitad arqueológica.

El foco pasó a probarse sin navegar: se escribe en un campo, entra una operación
por la capa de datos, y se comprueba que el cursor y lo escrito siguen ahí. Eso
sí es el invariante que importa.

`test/sync.mjs` recorre los diez escenarios completos —crear desde cada
pestaña, editar, borrar, tope diario, racha, contratos, varias cuentas,
selección compartida, persistencia— más los casos límite que rompen esto de
verdad: cuenta con cero operaciones, y la operación que cambia de día y de
cuenta.

### Medir antes de optimizar, y decirlo cuando la medida te contradice

Guardar una operación con 1.500 en el journal llamaba a `acctAgg` **18 veces**
con tres cuentas abiertas: seis por cuenta, devolviendo exactamente lo mismo
cada vez. Parecía el cuello de botella. Memoricé `acctAgg`, `futStats`,
`futFiltered` y las listas por cuenta, con la disciplina de siempre — la clave
incluye **todo** lo que la función lee, así que no hay que acordarse de
invalidar nada:

```
                       llamadas      reloj
  acctAgg   antes  18        →  3
  futStats  antes  7.500 ops →  3.000     190 ms → 181 ms
```

**Las llamadas cayeron 6× y el reloj no se movió.** Dicho claro: memoricé lo que
parecía caro por número de llamadas y no lo era. Perfilando de verdad, en un
guardado de 179 ms:

```
  renderFutures   103 ms   ← el DOM
  renderQE         34 ms
  futStatsCrudo     4 ms   ← la matemática
```

La cuenta nunca fue el coste. Lo era reconstruir la tabla, el calendario y los
gráficos como cadenas de HTML.

Lo que sí estaba mal era **cuántas veces** se reconstruían. Al arrancar,
`loadLocal()` emite una vez por colección —trades, playbooks, ideas, markets,
watch, positions— y cada suscriptor llamaba a sus renders a pelo:
`renderFutures` corría 4 veces, `renderInvest` 6, para producir el mismo HTML.
Ahora todos los suscriptores pasan por un agrupador que acumula zonas **por
nombre** y las pinta una vez por tick:

```
  arranque (1.500 ops, 3 cuentas)   855 ms → 661 ms   (−23%)
  arranque (300 ops, 1 cuenta)      678 ms → 563 ms   (−17%)
  guardar una operación             161 ms → 167 ms   (sin cambio)
```

El guardado no mejora y no hay por qué fingir que sí: ahí solo emite `trades`,
o sea no había nada que agrupar. Lo que queda por hacer, si alguna vez molesta,
es no reconstruir la vista de Futuros cuando no está a la vista.

Un microtask, no `requestAnimationFrame`: se resuelve antes de que el navegador
pinte —nada se ve a medio actualizar— y no se congela en una pestaña de fondo,
que dejaría los números viejos al volver.

De paso desapareció el último `try{}catch{}` mudo: el de los destinos de la
calculadora. Si falla, ahora se dice cuál falló.

### El rediseño, y lo que la medición dijo de él

Un rediseño se justifica con defectos, no con gustos. Los que había, medidos:

- **8 radios distintos** (1, 2, 3, 4, 5, 6, 7, 999) y **17 espaciados**
  (5, 6, 7, 9, 10, 11, 13, 14, 18…). No es un sistema, es una acumulación.
- **19 tamaños de tipo** en la misma pantalla.
- La tarjeta de cuenta tenía **siete zonas apiladas** con cuatro rejillas
  distintas, y dentro de ellas el texto se recortaba a media palabra:
  `GANANCI/A`, `PÉRDIDAS SEGU`, y una columna de una palabra por línea que se
  salía por el borde derecho. Eso no es densidad, es un defecto.
- **Lo más grande de la tarjeta era `3950.00%`** —la consistencia sobre una
  ganancia diminuta, un número sin significado— mientras `RESTRINGIDA`, que es
  lo único que decide si puedes operar, iba en gris pequeño a media tarjeta.
- Las reglas duras eran seis tarjetas iguales en 820px, y dentro de cada una el
  LÍMITE era lo más grande y el ESTADO ACTUAL lo más pequeño. Jerarquía al
  revés: el límite no cambia nunca; lo que cambia es dónde estás tú.

Lo que se hizo, y lo que costó:

```
                             antes    después
  radios en px sueltos           8          0   (4 tokens)
  espaciados fuera de escala   126          9   (los 9 son márgenes ópticos)
  tamaños de tipo               19         10
  alto de la página          3.457px    3.524px  (mismo contenido, mejor orden)
  alto en un teléfono       10.063px    8.384px  (−17%)
  desborde horizontal móvil   sí          0px
```

**La tarjeta de cuenta** pasó a responder las preguntas en el orden en que se
hacen: ¿puedo operar? (el veredicto, arriba y a lo ancho, con su motivo) ·
¿cuánto tengo? · ¿cómo voy hoy? · ¿cuánto riesgo queda? (cuatro métricas con la
misma anatomía) · ¿y el detalle? (sólo si lo pides). Desaparecieron la rejilla
de seis KPIs, las tres tarjetas-módulo y la fila de chips que repetía lo que ya
dice el centro de reglas. Treinta números que nadie puede leer no son más
información: son menos.

**Container queries, no media queries**, en la tarjeta. En una pantalla de
1600px caben dos cuentas lado a lado: cada una mide 420px y una media query de
viewport creería que hay sitio de sobra para cuatro columnas. La tarjeta se mide
a sí misma, y las cifras usan `clamp(…, cqi, …)` para caber sin truncarse.

**El teclado.** ⌘K abre una paleta que lista acciones, pestañas y cuentas, y
seis letras sueltas navegan. La regla que hace que esto no sea un desastre:
**una letra nunca actúa si estás escribiendo**. Sin esa guarda, teclear
«Nota: probé…» en el diario abriría el editor de operaciones en la N.
`test/cmd.mjs` lo comprueba explícitamente, además de que ⌘K sí funcione con
el foco dentro de un campo.

Todo lo que hace la paleta entra por las mismas puertas que un clic —`showTab`,
`setFtView`, `openTrade`, `FUT.setSelectedAccount`—. Si algo sólo se pudiera
hacer con ⌘K sería una función escondida, no un atajo.

**Lo que no se tocó**: la capa de datos. Cabina y Futuros siguen leyendo de
`coll("trades")`, `acctAgg` y el mismo motor de reglas; `sync.mjs` y `vivo.mjs`
pasan sin cambios. Seis pruebas sí hubo que actualizar —apuntaban a selectores
que el rediseño movió— y una de ellas descubrió un error mío: había bajado la
consistencia a un decimal, y `53.97%` no es `54.0%` cuando el límite es 50.

`test/diseno.mjs` mide todo esto sobre la página viva: recorre los 804 nodos
visibles y lista los espaciados fuera de escala, los tamaños de tipo, los radios
y cualquier elemento cuyo contenido no quepa. Es la prueba que convierte
«parece consistente» en un número.

### El contrato de la firma, por cuenta

Hasta aquí había **una** pérdida máxima diaria para todas las cuentas:
`ruleByRole(role)` no recibía cuenta. Una LucidFlex con tope de $200 y una Apex
con tope de $1.100 leían el mismo número, así que una de las dos mentía — y la
que miente en la dirección peligrosa te quema la cuenta.

Ahora hay **dos niveles**, porque son dos cosas distintas con consecuencias
distintas:

```
  CONTRATO DE LA FIRMA   account.rules{}    romperlo QUEMA la cuenta
  PROTOCOLO DEL TRADER   settings.rules[]   romperlo rompe la disciplina
```

El contrato manda. Si la cuenta no tiene ese número escrito, se hereda del
protocolo **y se dice** que se ha heredado («$0 de $200 · del protocolo»): un
límite heredado que creías propio es justo el error que esto viene a quitar. Si
no existe en ninguno de los dos, la regla sale **SIN CONFIGURAR** con su propio
color muerto — antes salía como AVISO «sin valor», que se lee igual que
cualquier otro aviso.

Lo que ya vive en la cuenta no se duplica: el objetivo es `a.target`, el
drawdown `a.dd`, la consistencia `a.limit`. `account.rules{}` guarda sólo lo que
faltaba, más la metadata del contrato: fecha de verificación, versión, enlace y
notas. Dos sitios para el mismo número es el bug que se acababa de quitar; no se
reintroduce con otro nombre.

**Una cuenta sin las reglas que la queman ya no se presenta como LISTA.** Sale
en AVISO diciendo exactamente qué falta escribir — «falta el tamaño y el
drawdown máximo» — y sigue siendo operable, porque eso lo decide el trader. Lo
que la cabina no hace es decir que todo va bien cuando no tiene con qué saberlo.
Esto cambió el veredicto de una cuenta nueva de READY a WARNING, y con él una
prueba de `sync.mjs` que lo daba por bueno.

`test/prop.mjs` mete −$600 el mismo día en las dos cuentas: LucidFlex queda
BLOQUEADA sobre su tope de $200 y Apex sigue operable con $500 restantes de sus
$1.100. Ese contraste es toda la fase en una línea.

**Tres defectos del rediseño anterior salieron a la luz al escribirla**, y los
tres vivían porque ninguna prueba tocaba esa parte del DOM:

- El chevrón del «por qué» de una regla buscaba el párrafo con
  `nextElementSibling`, pero el rediseño lo había metido dentro de la fila:
  devolvía `null` y reventaba al pulsarlo.
- `paintRuleStates` actualizaba `.rnote`, renombrado a `.rnow`. Al no
  encontrarlo, **el estado en vivo de cada regla dejó de refrescarse en
  silencio**: seguía mostrando el número del último repintado completo.
- La cabecera contaba las reglas sin configurar como «activas», es decir,
  afirmaba vigilar algo que nadie había escrito.

### El guardián de la arquitectura

`test/capa2.mjs` no abre el navegador: lee el archivo en 40 ms y comprueba las
afirmaciones que este README hace. Una afirmación que nadie comprueba deja de
ser cierta en cuanto alguien tiene prisa.

Vigila una definición por cálculo; que nadie llame a los `*Crudo` saltándose la
memoria; que las 26 funciones de `FUT` sigan ahí; que cada memoria dependa de
`coll("trades").rev` y que la huella de la cuenta cubra **todo** campo que
`acctAgg` lee de ella; y que ningún número tenga dos implementaciones.

La primera versión marcaba tres falsos positivos, y los tres enseñan lo mismo:
`MULT` existe pero **se deriva** de `QE.CONTRACTS`; `riskThreshold` existe pero
**delega** en `QE.sueloPara`; y el tercer «duplicado» era un comentario que dice
*«nunca calcules el P&L así»*. Buscaba nombres, no implementaciones. Un guardián
que falla siempre acaba ignorado, que es peor que no tenerlo. Ahora comprueba
que cada envoltorio **siga delegando**.

Y se probó rompiéndolo a propósito — un guardián que no puede fallar es teatro:

```
  quito trailBase y ledger de la huella          → ❌ fuera de la huella: ledger, trailBase
  llamo a acctAggCrudo saltándome la memoria     → ❌ 2 llamadas
  riskThreshold deja de delegar                  → ❌ ya no llama a QE.sueloPara
  desaparece calculateSQN de FUT                 → ❌ faltan: calculateSQN
```

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
