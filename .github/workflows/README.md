`pruebas.yml` corre los 44 archivos de `test/` en cada push a `main` y en cada
pull request.

Dos detalles que no son evidentes:

- **Sólo instala Chromium.** La suite no prueba otros navegadores; bajar los
  tres añade minutos por corrida sin comprobar nada más.
- **Reconstruye `preview.html` antes de correr.** Los tests cargan ese archivo,
  no `index.html`. Una vez la suite estuvo seis días en verde midiendo una copia
  congelada; `capa2.mjs` comprueba ahora que el preview contenga lo que hay en
  `index.html`, y este paso se asegura de que así sea.
