# Fixtures de importación

Aquí van los CSV reales exportados del bróker, anonimizados: sin número de
cuenta, sin nombre, sin saldos. Sólo las columnas que el importador necesita
leer y unas pocas filas.

Son la **fase 0** de [`docs/IMPORTAR.md`](../../docs/IMPORTAR.md) y bloquean todo
lo demás: un mapeo escrito de memoria falla con el primer fichero real.

Uno por plataforma, con el nombre de la plataforma: `tradovate.csv`,
`ninjatrader.csv`, `rithmic.csv`…

Casos que hacen falta además del normal, para la fase 2:

- `*-parcial.csv` — una entrada, varias salidas
- `*-multiple.csv` — varias entradas, una salida
- `*-vuelta.csv` — dar la vuelta a la posición en una sola orden
