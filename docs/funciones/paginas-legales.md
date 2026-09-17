# Privacidad y condiciones de uso

Dos páginas públicas: `/privacy` y `/terms`.

No son adorno ni trámite interno. Son un requisito de tres sitios a la vez:

- **Intuit** las pide por URL en el cuestionario de producción de QuickBooks
  y las abre desde fuera, sin sesión, para revisarlas a mano.
- **Stripe** exige que el negocio que cobra tenga publicadas unas condiciones.
- **La Ley 25 de Quebec** obliga a decir qué datos se recogen, dónde están y
  a quién se le pueden reclamar — en un sitio que cualquiera pueda leer sin
  tener cuenta.

De ahí la única regla que importa aquí: **tienen que abrirse sin sesión**.

---

## Cómo se usa

Desde fuera no hace falta nada: son dos direcciones públicas.

- `https://logiciel-construction.com/privacy`
- `https://logiciel-construction.com/terms`

Dentro del producto se llega desde dos sitios:

- El **pie de la página de inicio**, junto a las dos puertas de trabajador y
  cliente.
- La **pantalla de alta del negocio**, bajo el botón de crear la cuenta, con
  la frase de que al crear la cuenta se aceptan. Ahí es donde hay algo que
  aceptar, y por eso el aviso está ahí y no en un cartel de cookies: no hay
  cookies que consentir, sólo la sesión y el idioma.

Cada página enlaza a la otra en su pie, y las dos llevan el selector de
idioma arriba: alguien que llega desde un correo en francés no debería tener
que entrar al panel para leerlas en el suyo.

---

## Por dentro

| Pieza | Dónde |
|---|---|
| La pantalla, una sola para las dos | `client/src/pages/PaginaLegal.tsx` |
| Las rutas, sobre la puerta de autenticación | `client/src/App.tsx`, en `Router()` |
| El texto | `client/src/i18n/locales/{es,en,fr,it}.json`, bajo `legal.` |

El sitio de presentación enseña **ese mismo texto**: `paginaLegal()` en
`sitio/construir.mjs` lee los mismos archivos y genera `/fr/confidentialite`,
`/en/privacy` y sus equivalentes. No hay una segunda copia que mantener, y no
puede pasar que lo que se le enseñó al cliente antes de firmar diga algo
distinto de lo que lee después de entrar — que es la versión que cuenta si
alguna vez hay que discutirlo.

`PaginaLegal` recibe `cual="privacy"` o `cual="terms"` y renderiza lo mismo
en los dos casos: cabecera, fecha de actualización, secciones numeradas, pie
con el titular y el enlace a la otra. Escribir dos componentes casi iguales
es cómo se acaba con uno de los dos arreglado y el otro no.

Las rutas se declaran en `Router()`, **antes** del `<Route component={BusinessPanel} />`
final. Si se movieran dentro del panel, `RequireBusinessAuth` las mandaría a
iniciar sesión y el revisor de Intuit vería una pantalla de login donde
esperaba una política de privacidad.

### La forma del texto

Cada documento es una lista de secciones:

```json
"privacy": [
  { "id": "quien", "title": "Quién responde de tus datos", "body": ["…", "…"] }
]
```

Los párrafos admiten dos marcas y sólo dos: `**negrita**` y `` `código` ``.
Las convierte `conFormato()` en la propia pantalla. No es Markdown y no debe
serlo — no hay HTML por medio y no puede haberlo.

La negrita no es decoración: marca lo que hay que leer sí o sí (quién
responde, dónde están los datos, qué no es este programa), porque un muro de
texto gris se lee en diagonal o no se lee.

---

## Cambiar el texto

**No edites los cuatro archivos a mano.** Es texto legal: si la versión
francesa acaba diciendo algo que la castellana no dice, eso no es una errata,
es otra promesa.

El generador está en `scripts/legal-i18n.py`: lleva las cuatro versiones de
cada sección juntas, en la misma tupla, y las escribe de una vez. Para
cambiar una sección se toca ahí y se vuelve a generar, desde la raíz:

```bash
python3 scripts/legal-i18n.py
```

Reescribe el grupo `legal.` entero en los cuatro archivos. Todo lo que tenga
que estar bajo `legal.` —incluida la frase de la pantalla de alta— tiene que
estar en el generador, o la siguiente regeneración se lo lleva por delante.

Al tocar el texto, **sube también la fecha** (`ACTUALIZADO` en el generador,
`legal.updatedOn` en los archivos) y avisa por correo a los negocios que lo
usen antes de que entre en vigor — que es justamente lo que promete la
sección «Si esto cambia».

### Comprobar

La comprobación normal de paridad de idiomas no basta aquí: `legal.privacy`
es una lista, y para el contador de claves una lista es una sola clave. Dos
idiomas con distinto número de secciones pasarían la paridad sin problema.
Hay que mirar dentro:

```bash
python3 - <<'PY'
import json
for grupo in ('privacy', 'terms'):
    ids = {l: [s['id'] for s in json.load(open(f'client/src/i18n/locales/{l}.json'))['legal'][grupo]]
           for l in ['es', 'en', 'fr', 'it']}
    parr = {l: [len(s['body']) for s in json.load(open(f'client/src/i18n/locales/{l}.json'))['legal'][grupo]]
            for l in ['es', 'en', 'fr', 'it']}
    print(grupo, 'mismas secciones:', len(set(map(tuple, ids.values()))) == 1,
          '| mismos párrafos:', len(set(map(tuple, parr.values()))) == 1)
PY
```

---

## Qué dicen, en una línea cada una

**Privacidad** — quién responde (una persona física, con nombre y dirección),
qué datos hay, para qué se usan, que están en Montreal y no salen de Canadá,
quién más los ve (Supabase, Stripe, Intuit, Resend, OpenStreetMap y nadie
más), cuánto se guardan, qué derechos tienes y a qué autoridad puedes
reclamar, qué guarda el navegador, y que esto cambiará.

**Condiciones** — qué es el programa, que **no es asesoría fiscal ni legal**
y no presenta nada ante ningún organismo, que lo que metes es tuyo, que el
dinero de las tarjetas va a tu propia cuenta de Stripe y no a la nuestra, que
no se promete un porcentaje de disponibilidad, cómo dejar de usarlo, y qué
ley rige.

---

## Qué suele salir mal

**Se abren pidiendo iniciar sesión.** Las rutas han caído dentro de
`BusinessPanel`. Tienen que estar en `Router()`, antes del `<Route component={BusinessPanel} />`.

**Una sección sale en castellano dentro del francés.** Falta esa sección en
`fr.json` y el idioma de respaldo es el castellano. Lo caza el comprobador de
arriba, no el de paridad.

**Sale el título pero no el cuerpo.** `t()` devolvió un objeto en vez de la
lista: falta `{ returnObjects: true }` en la llamada. La pantalla se defiende
con `Array.isArray()` y no se rompe, pero sale vacía.
