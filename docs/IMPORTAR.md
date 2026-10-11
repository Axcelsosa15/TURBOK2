# Importar operaciones desde el bróker

Estado: **especificación, nada implementado.** Este documento existe para que la
fase 1 se pueda empezar sin volver a decidir nada.

El `README.md` ya nombraba el hueco: no hay esquema canónico de operación
importada, ni mapeos por bróker, ni el camino de importación, ni huella de
deduplicación. Esto es ese hueco, desarmado en piezas que se pueden hacer una
por una.

---

## Por qué es la pieza que decide el producto

Cabina obliga hoy a escribir cada operación a mano. Para el autor, con pocas
operaciones al día, es sostenible. Para cualquier otro no lo es, y es la razón
por la que un diario se abandona en la segunda semana: el coste de registrar
supera al de mirar.

Todos los competidores lo resuelven con sincronización automática. Cabina no
puede: es local-first y no habla con el bróker. Lo que sí puede es tragar el CSV
que el bróker ya te deja descargar, que es el 90 % del valor con el 10 % del
aparato y sin pedirle a nadie sus credenciales.

---

## LO QUE DE VERDAD HAY DENTRO DEL CSV: EJECUCIONES, NO OPERACIONES

Es la trampa de todo el asunto y conviene decirla antes que nada.

Una operación de Cabina (`trades/<id>`, ver [`DATA_MODEL.md`](DATA_MODEL.md)) es
una **ida y vuelta**: tiene `entry`, `exit`, `direction`, `qty`. Un export de
bróker —en Tradovate, el informe de **Orders**— es una lista de **órdenes o
ejecuciones**: una fila por compra y otra por venta, cada una con su hora, su
precio y su cantidad.

Entre las dos cosas hay un algoritmo, no un mapeo de columnas:

- Cuatro contratos comprados en una orden y cerrados en tres órdenes distintas
  son **una** operación, no cuatro filas.
- Dos entradas y una salida en el mismo instrumento y la misma cuenta se
  emparejan en FIFO, no por cercanía en el tiempo.
- Dar la vuelta a una posición (vender 2 estando largo de 1) cierra una
  operación y abre otra en sentido contrario, en la misma fila.

Quien trate el CSV como «una fila, una operación» produce un diario con el doble
de operaciones y la mitad del P&L. Es el fallo clásico y hay que diseñarlo para
no cometerlo: **el emparejado es la fase 2 y es la más difícil.**

---

## El esquema canónico ya existe

No hay que inventar ninguno. La operación importada es una operación normal:

```
date, time, accountId, instrument, direction, qty, entry, stop, target,
exit, exitTime, exitWhy, fees, mae, mfe, setupId, plan, invalida,
quality, tags, notes, images[], source
```

Con las invariantes de siempre: `qty` y `fees` son magnitudes sin signo, la
dirección la dice `direction`, y el P&L no se guarda —lo deriva el motor—, salvo
que el bróker reporte uno, que entonces gana por ser un hecho.

`source` pasa a admitir `import:<plataforma>` junto a `quick_add` y `manual`.

### LO QUE NINGÚN CSV TRAE, Y ES LO QUE HACE ÚTIL A CABINA

Un export de bróker da `date`, `time`, `instrument`, `direction`, `qty`,
`entry`, `exit`, `fees`. Punto.

No trae `stop`. No trae `target`. No trae `setupId`. No trae `plan`. No trae
`quality`. No trae `exitWhy`.

Es decir: **no trae ni uno solo de los campos de los que sale la R, la
expectativa, el reward-to-risk ni el análisis de errores.** Un diario importado
y no completado da P&L y nada más — exactamente lo que ya te da la plataforma
del bróker, y el motivo por el que importar *solo* no es una funcionalidad.

De ahí la fase 5, que no es un extra: la operación importada entra **incompleta
y marcada como tal**, y la Cabina la reclama. El importador no es el producto;
es el que llena la cola de trabajo del producto.

---

## El camino

```
SUBIR → DETECTAR → MAPEAR → EMPAREJAR → PREVISUALIZAR → IMPORTAR
```

| Paso | Qué hace | Qué pasa si falla |
|---|---|---|
| **Subir** | Un `<input type=file>` y pegar texto. Nada sale del navegador. | — |
| **Detectar** | Compara la fila de cabecera con las firmas conocidas. | Cae a Mapear en manual. Nunca adivina a medias. |
| **Mapear** | Qué columna es `date`, cuál `instrument`, cuál `price`… | Es el paso manual: no puede fallar, sólo quedar incompleto. |
| **Emparejar** | FIFO por cuenta + instrumento → operaciones de ida y vuelta. | Las ejecuciones que quedan sin pareja se muestran **aparte**, no se descartan en silencio. |
| **Previsualizar** | La tabla exacta que se va a escribir, con los duplicados ya marcados. | — |
| **Importar** | Escribe. Una sola vez, y se puede deshacer entero. | — |

Regla dura del camino: **nada se escribe antes de Previsualizar**, y lo que se
previsualiza es lo que se escribe, no una aproximación.

---

## La huella de deduplicación

Reimportar un rango que se solapa con otro ya importado es el caso normal, no el
raro: se exporta «el último mes» cada semana.

Deduplicar por operación no vale —la misma ida y vuelta puede emparejarse
distinto si el rango cambia—, así que **la huella va en la ejecución, no en la
operación**:

- Si el bróker da un identificador de ejecución, ése es la huella.
- Si no, `cuenta + instrumento + marca de tiempo + lado + cantidad + precio`,
  normalizado y resumido.

Cada operación guarda el conjunto de huellas de las ejecuciones que la
formaron. Al importar se construye el conjunto de huellas ya consumidas y toda
ejecución que ya esté dentro se descarta **antes** de emparejar. Así una
reimportación de un rango solapado produce cero operaciones nuevas, y una que
añade tres días produce exactamente las de esos tres días.

---

## Lo que NO va a hacer

Decirlo ahora evita discutirlo en la fase 4.

- **No se conecta al bróker.** Ni API, ni credenciales, ni OAuth. CSV y nada más.
- **No adivina el setup.** `setupId` lo pone una persona.
- **No inventa el stop.** Sin stop no hay R, y una R inventada es peor que
  ninguna.
- **No importa inversiones.** Futuros primero; la cartera es otro modelo.
- **No arregla un CSV roto.** Si el bróker exporta mal, se dice y se para.

---

## Fases, con su punto de control

Cada fase es útil por sí sola y se puede soltar sin la siguiente.

### Fase 0 — Conseguir los CSV *(tuya, 10 minutos, bloquea todo)*

Exportar un CSV real de **cada** plataforma que uses de verdad y guardarlo en el
repositorio como fixture anónimo.

> **Control:** hay al menos un `.csv` real en `test/fixtures/`. Sin esto, todo lo
> de abajo se diseña a ciegas y se rehace.

### Fase 1 — El mapeador manual

Subir cualquier CSV, ver las primeras filas, decir a mano qué columna es qué,
previsualizar e importar. Sin detección, sin emparejado: una fila, una
operación, y se asume que el CSV ya trae idas y vueltas.

Funciona con **todos** los brókers desde el primer día, porque no sabe nada de
ninguno.

> **Control:** importar el fixture de la fase 0 y que las cifras cuadren con la
> plataforma del bróker al céntimo. Prueba en `test/importar.mjs`.

### Fase 2 — Emparejado de ejecuciones

FIFO por cuenta e instrumento. Cierres parciales, entradas múltiples y vueltas
de posición. Las ejecuciones huérfanas se muestran, no se tiran.

> **Control:** un fixture con un cierre parcial, uno con dos entradas y uno con
> una vuelta de posición, los tres con el resultado esperado escrito a mano en
> la prueba.

### Fase 3 — Huella y reimportación

> **Control:** importar el mismo fichero dos veces produce cero operaciones
> nuevas la segunda. Importar un rango que se solapa produce sólo lo nuevo.

### Fase 4 — Detección automática

Una firma de cabecera por plataforma, añadida **sólo** cuando haya un CSV real
de ella. Nada de mapeos escritos de memoria.

Las dos que importan, en este orden, porque son las que usa el autor:

| Plataforma | De dónde sale el CSV | Qué trae |
|---|---|---|
| **Tradovate** | Account → la cuenta → ajustes → pestaña **Orders** → rango → descargar | Órdenes, no idas y vueltas → necesita la fase 2 |
| **NinjaTrader** | Control Center → **Trade Performance** → pestaña Trades → exportar | Ya empareja idas y vueltas él solo → puede saltarse la fase 2 |

Esa diferencia es la razón de empezar por NinjaTrader aunque Tradovate sea el
que más se usa en las prop: con un export de Trades de NinjaTrader la fase 1
sola ya produce operaciones correctas, sin emparejado. Sirve de banco de pruebas
del resto del camino mientras la fase 2 no existe.

> **Control:** el fixture se detecta solo y el mapeo propuesto es el correcto sin
> tocarlo.

### Fase 5 — La cola de operaciones incompletas

La operación importada entra marcada. La Cabina dice cuántas le faltan campos y
lleva a completarlas de una en una. Las métricas que dependen de un campo que
falta ya saben decir que falta: eso está hecho.

> **Control:** con 20 operaciones importadas sin stop, Métricas/Edge dice que no
> puede medir en R y nombra cuántas y por qué.

---

## Por dónde NO empezar

Por la fase 4. Es la que más se luce —«detecta tu bróker solo»— y la única que
no se puede hacer bien sin los ficheros de la fase 0. Empezar por ahí produce
mapeos escritos de memoria que fallan con el primer CSV real.
