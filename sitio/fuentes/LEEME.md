# Las letras del sitio

Dos familias, servidas desde nuestro propio dominio en vez de pedírselas a
Google. El motivo está en `sitio/estilo.css`, arriba del todo: una descarga
menos que bloquea el pintado, en un dominio menos, y la IP del visitante que no
sale hacia un tercero por el hecho de abrir la página.

| Familia | Pesos | Autoría | Licencia |
|---|---|---|---|
| Plus Jakarta Sans | 700, 800 | Tokotype | SIL Open Font License 1.1 |
| Public Sans | 400, 500, 600, 700 | U.S. Web Design System | SIL Open Font License 1.1 |

## La licencia

La OFL 1.1 permite usarlas, servirlas y redistribuirlas, también en algo que se
cobra, y **obliga a que la licencia acompañe a los archivos**. Por eso está
este documento aquí y no sólo en la cabeza de alguien.

Las dos condiciones que hay que respetar:

1. **No se venden los archivos de letra sueltos.** Se sirven como parte del
   sitio, que es exactamente para lo que está pensada la licencia.
2. **No se renombran las familias** si se modifican. Estos archivos son los de
   Google Fonts tal cual, sin tocar, así que no aplica — pero si algún día se
   recorta un subconjunto a mano, el resultado tiene que llamarse de otra
   manera.

El texto completo de la OFL 1.1 está en <https://openfontlicense.org>, y el de
cada familia en su repositorio:

- Plus Jakarta Sans — <https://github.com/tokotype/PlusJakartaSans>
- Public Sans — <https://github.com/uswds/public-sans>

## De dónde salieron estos archivos

Son los `woff2` que sirve Google Fonts, descargados uno a uno y renombrados
`familia-peso-subconjunto.woff2`. El nombre lleva dentro todo lo que lo
identifica, y eso es lo que permite servirlos con un año de caché e
`immutable`: si algún día cambia la letra, cambia el nombre, y nadie se queda
con la anterior pegada en el navegador.

Cada peso viene partido en `latin` y `latin-ext`, con el `unicode-range` que le
corresponde escrito en `estilo.css`. Una página que no usa ninguna letra del
segundo archivo no lo descarga.

## Si hace falta otro peso

1. Pídele a Google Fonts el CSS de ese peso con un navegador moderno en el
   `User-Agent` (si no, contesta con `woff` antiguo en vez de `woff2`).
2. Baja el `woff2` de `latin` y el de `latin-ext`, con este mismo nombre.
3. Copia los dos bloques `@font-face` al principio de `sitio/estilo.css`, con
   su `unicode-range` tal cual viene.

No hace falta tocar `construir.mjs`: la carpeta entera se copia a lo generado.
Lo que sí hay que mirar es `PRECARGA`, que sólo nombra las tres caras que se
ven antes de bajar la página — precargar de más es descargar de más.
