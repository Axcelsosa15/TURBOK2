# El artefacto

`index.html` es una copia estática de un artefacto publicado en claude.ai. El
código es el mismo; lo que cambia es la cáscara y lo que la página puede hacer.
Este archivo existe porque durante semanas el repositorio no registraba nada de
esto: quien clonara sólo veía un HTML, sin forma de saber contra qué se publica
ni por qué el mismo archivo se comporta distinto según dónde se abra.

## Identidad

| | |
|---|---|
| Enlace | https://claude.ai/artifact/2Nkv7mgKa7xtxZY9yvxeAb |
| Contrato en ejecución | `0.2.46` |
| Compartición | enlace público — *ver la advertencia al final* |

## Capacidades declaradas

Al publicar se declara esto, y sólo esto:

```
assets, db, downloads
```

- **`db`** — el almacén de documentos. Es lo que hace que los datos sobrevivan
  al navegador y se sincronicen entre dispositivos. Sin él la app cae a
  `localStorage` (clave `cabina-mnq:v1`) y cada dispositivo queda aislado.
- **`assets`** — subir imágenes al playbook. Sin él el botón de imagen
  desaparece.
- **`downloads`** — el respaldo en JSON. Dentro del artefacto la página no puede
  descargar por su cuenta: lo pide a la cápsula, que muestra nombre y tamaño y
  espera permiso. Servido como archivo suelto vale la descarga normal.

`permissions` **no se declara**: es built-in en todo artefacto. El código la
llama al arrancar (`perms.request(["db", "assets"])`) para pedir los dos
permisos en un solo diálogo en vez de interrumpir dos veces más tarde.

Las cuatro llamadas van envueltas en `try/catch` con caída a `null`, así que la
misma página funciona servida como archivo suelto, donde `window.claude` no
existe: `db` cae a `localStorage`, `assets` esconde el botón, `downloads` usa
`URL.createObjectURL`.

## Publicar un cambio

El contenido del artefacto es `index.html` **desde `<style>` en adelante**. La
diferencia con el archivo del repositorio es sólo el envoltorio de página
estática que añade `test/sync-index.mjs`:

- delante: `<!DOCTYPE html>`, `<head>` con las fuentes y los metas, un reset
  mínimo, `</head><body>`
- detrás: `</body></html>`

### ⚠ Ahora mismo NO coinciden

`index.html` va **por delante** del artefacto publicado (versión
`1790329585-a362`). La diferencia es exactamente esto, y sólo esto:

| Cambio | Efecto en la app |
|---|---|
| el bloque «MathEngine — ÚNICA FUENTE DE CÁLCULO» dice ahora la verdad | ninguno: es un comentario |
| «190 pruebas» → «329 pruebas» | ninguno: es un comentario |
| 9 copias duplicadas del encabezado del bundle, fuera | ninguno: son comentarios |
| `pbar()` retirada | ninguno: estaba definida y **nunca se llamaba**, y su marcado no tenía una sola regla CSS |

**Cero cambio de comportamiento.** Por eso la divergencia se deja registrada en
vez de gastar el presupuesto de una sesión en cerrarla: republicar obliga a leer
las 10 818 líneas de lo publicado —la herramienta no acepta una comparación por
hash, y hace bien: es la regla de no publicar lo que no has visto— y eso son unos
430 000 tokens para un cambio que ningún usuario ve.

Lo que **no** se hace es dejarlo en silencio. Para cerrarla:

```sh
# 1. reconstruir el cuerpo: la cabecera (<title> + las dos fuentes) se toma de
#    lo publicado, y el contenido desde el SEGUNDO <style> de index.html
# 2. leer lo publicado entero (lo exige la herramienta)
# 3. publicar omitiendo `capabilities`, para arrastrar la declaración guardada
```

El cuerpo listo para publicar ya está generado en el scratchpad de la sesión que
lo preparó. Si esta divergencia crece más allá de comentarios, **deja de ser
aceptable**: en cuanto toque una línea que se ejecuta, hay que republicar antes
de seguir.

### Cuando sí coinciden

Verificado con el arreglo anterior: quitando ese envoltorio, el cuerpo coincide
byte a byte con lo publicado (sha256 `2c50f0a516caff45`).

Al republicar **se omite `capabilities`**, que arrastra la declaración guardada
intacta y mantiene fijado el contrato. Pasarlo de nuevo es una declaración
completa: lo que no se repita se revoca. Mover el contrato (`contract:
'latest'`) es un gesto deliberado, nunca un efecto colateral de editar.

## El almacén de assets NO está aquí

El artefacto guarda 7 imágenes PNG (3.9 MB) subidas al playbook. **No están en
el repositorio y no deben estarlo**: son capturas de gráficos de operaciones
reales y éste es un repositorio público. Quedan inventariadas por si hay que
reconstruir referencias:

| id | bytes | subida |
|---|---|---|
| `de7a8f2eda03b94731a13caf4c023f08` | 314 374 | 2026-09-15 |
| `95f4b7f770b31c725ad4ccbdcac34abf` | 469 513 | 2026-09-15 |
| `00fbbed3da6890ecd1ae7158d0cd1784` | 635 158 | 2026-09-16 |
| `96cebe0c43880d5112bf767af69ef295` | 635 158 | 2026-09-16 |
| `fe41b68f3bee5ef864307df7ad9cfe1e` | 611 828 | 2026-09-16 |
| `29b4712c28788ee8da93b3a2174637ee` | 675 090 | 2026-09-17 |
| `02465af7fd3a8e7df5d8661f7d205821` | 585 548 | 2026-09-17 |

Las dos del 16 de septiembre son **el mismo archivo**: mismo sha256
(`c446f708…`), mismo tamaño, tres minutos de diferencia. La app subió la imagen
dos veces y gastó 635 KB de cuota en una copia que ninguna fila referencia.
`assets.delete(id)` la borraría, pero sólo tras comprobar qué playbook apunta a
cuál.

## Advertencia sobre la compartición

El artefacto tiene datos de trading reales. Su ajuste de compartición es
«cualquiera con el enlace». Eso sólo lo cambia el dueño, desde el menú Share.

Hay una tensión sin resolver: el contrato dice que una página que declara
`assets` es interna de la organización y nunca pública. Si eso manda sobre el
ajuste, el enlace no sería realmente público. No se puede comprobar desde aquí
— lo dice el diálogo Share, que es quien sabe si la opción pública se ofrece
siquiera. Hasta saberlo, trátalo como público.
