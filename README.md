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
| **Futuros** | Journal de operaciones: resumen, cuentas, análisis (R múltiple, sesión de mercado, franjas horarias, día de la semana, consistencia) y diario del día agrupado por sesión. |
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
