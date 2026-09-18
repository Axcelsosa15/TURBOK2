# Pruebas de la app

Estas pruebas conducen la app real en Chromium (Playwright) contra un
`preview.html` que envuelve `index.html` con el esqueleto del artefacto. No son
pruebas unitarias: abren la aplicación, meten operaciones por el formulario y
leen lo que aparece en pantalla.

Vivían en un directorio efímero. Si el contenedor moría, se perdían — y con
ellas la única forma de re-verificar que la arquitectura sigue siendo cierta.
Por eso están aquí.

## Cómo correrlas

```bash
# 1. construir el preview a partir de index.html
node test/build-preview.mjs

# 2. una prueba
node test/capa.mjs

# 3. el motor (no necesita navegador)
node engine/quant/quant.test.js
```

## Las que importan y por qué

| Archivo | Qué garantiza |
| --- | --- |
| **`capa.mjs`** | **El diagrama de arquitectura, hecho ejecutable.** CABINA y FUTUROS tienen que dar el MISMO número para las mismas siete magnitudes. Si alguien reintroduce un cálculo duplicado, esto falla |
| **`vivo.mjs`** | Detector de números rancios: compara ~560 valores «en vivo» contra «tras recargar». Cualquier diferencia es un número viejo en pantalla |
| `dup.mjs` | Doble conteo con posiciones del mismo activo (bug real de la v47) |
| `pico.mjs` | El pico es un trinquete: no puede bajar |
| `tocar.mjs` | Coste de las ventas fuera de plan + fricción al vender |
| `exc.mjs` / `exc2.mjs` | Captura y agregación de MAE / MFE |
| `aviso.mjs` | Precios fuera de la rejilla del contrato |
| `peorm.mjs` | El momento de máximo riesgo persiste |
| `tope.mjs` | Paginado de la tabla del diario |
| `inv.mjs` / `dca.mjs` | IRR y posición derivada de sus operaciones |
| `migra.mjs` | Migración y respaldo |
| `gate.mjs` | Puerta de protocolo |
| `sesiones.mjs` / `presec.mjs` | Modelo por sesión y pre-sesión |
| `motor.mjs` / `cuenta.mjs` / `acciones.mjs` | Motor de reglas y tarjeta de cuenta |
| `audit2-5.mjs` | Desbordes y anchos en 7 resoluciones |
| `perf.mjs` / `perfil.mjs` | Coste de guardar una operación con el journal lleno |

## El método

Ninguna de estas pruebas afirma un resultado esperado escrito a mano cuando
puede evitarlo. Las dos más valiosas comparan **la app contra sí misma**:

- `vivo.mjs` compara *actualizado en vivo* contra *tras recargar*. La verdad de
  referencia es lo que la app muestra desde cero.
- `capa.mjs` compara *una pestaña* contra *otra*. La verdad de referencia es la
  coherencia interna.

Eso encuentra cosas que un valor esperado no encuentra, porque no depende de que
a quien escribe la prueba se le ocurra el caso.
