# Fixtures de importación

Aquí van los CSV reales exportados del bróker, anonimizados: sin número de
cuenta, sin nombre, sin saldos. Sólo las columnas que el importador necesita
leer y unas pocas filas.

Son la **fase 0** de [`docs/IMPORTAR.md`](../../docs/IMPORTAR.md) y bloquean todo
lo demás: un mapeo escrito de memoria falla con el primer fichero real.

Las dos que hacen falta, en este orden:

- `ninjatrader.csv` — Control Center → Trade Performance → pestaña **Trades** →
  exportar. Ya viene emparejado en idas y vueltas: es el que desbloquea la fase 1.
- `tradovate.csv` — Account → la cuenta → ajustes → pestaña **Orders** → rango →
  descargar. Viene en órdenes sueltas: es el que obliga a la fase 2.

Casos que hacen falta además del normal, para la fase 2:

- `*-parcial.csv` — una entrada, varias salidas
- `*-multiple.csv` — varias entradas, una salida
- `*-vuelta.csv` — dar la vuelta a la posición en una sola orden
