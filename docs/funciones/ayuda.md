# El bot de ayuda

**Dónde:** la barra de abajo, en todas las pantallas del panel
**Código:** `client/src/components/ayuda/BotDeAyuda.tsx`,
`client/src/components/ayuda/arbolDeAyuda.ts`

Un árbol de botones que contesta «¿dónde se pone esto?» y «¿cómo se hace
aquello?» sin salir de la pantalla en la que estás.

---

## Qué ocupa

Ese sitio era una barra que decía *«pídele algo al asistente del negocio»* y
que, escribieras lo que escribieras, respondía siempre lo mismo: que todavía
no estaba conectada a ningún modelo, en castellano fijo, hablando de fases
internas y de claves de API.

Era el control más visible del producto —está en todas las pantallas— y lo
único que hacía era enseñarle a la gente que preguntar no sirve. Un negocio de
prueba llegó a escribirle; se llevó el párrafo de la clave de API.

Las rutas y la tabla `admin_assistant_messages` **siguen ahí** para cuando haya
un modelo de verdad. Lo que se ha quitado es la promesa vacía en pantalla.

---

## Por qué no lleva modelo

No es una limitación, es la elección:

- **Contesta siempre lo mismo.** Quien no sabe dónde va el número de TVQ
  necesita la respuesta correcta, no una redacción distinta cada vez.
- **No se inventa nada.** Un modelo sin contexto del producto se habría
  inventado pantallas que no existen, que es peor que no contestar.
- **Funciona en obra.** Dos toques y la respuesta, con una raya de cobertura.
- **No cuesta por pregunta**, así que nadie tiene que racionarla.

Todo pasa en el navegador: ninguna ruta nueva, ninguna escritura en la base.
Las conversaciones de ayuda **no** se guardan en `admin_assistant_messages` a
propósito — esa tabla es el historial que leerá el asistente de verdad cuando
exista, y llenarla de «¿cómo doy de alta un técnico?» sería envenenarlo.

---

## Cómo se usa

1. Se toca la barra de abajo.
2. Se elige la sección. **La de la pantalla donde estás sale la primera**, con
   la marca *(esta pantalla)*: quien pide ayuda desde Facturación pregunta por
   facturas, no por el idioma del panel.
3. Se elige el tema.
4. Sale la respuesta, y con ella tres salidas: **Llévame allí** (navega a la
   pantalla donde se hace), **Otra pregunta de esto**, y **Empezar de nuevo**.

La cabecera lleva atrás y reiniciar. Atrás quita un paso del camino, y el
camino es lo que se pinta como conversación — por eso el historial se lee
entero y no hay estados imposibles: el recorrido *es* el estado.

---

## Añadir un tema

Dos sitios, a propósito: la forma en TypeScript y las palabras en los idiomas.
Así se añade un tema sin tocar traducciones y se traduce sin tocar lógica.

1. En `arbolDeAyuda.ts`, añade el tema a su sección:

   ```ts
   { id: "miTema", parrafos: 2, nota: true, ruta: "/donde-se-hace" }
   ```

   `parrafos` dice cuántos párrafos tiene la respuesta; `nota` si cierra con un
   aviso corto; `ruta` es opcional y es lo que pone el botón *Llévame allí*.

2. Las claves, con el script que mantiene la paridad:

   ```
   help.topic.<seccion>.<tema>.title
   help.topic.<seccion>.<tema>.p1 … pN
   help.topic.<seccion>.<tema>.nota     (solo si nota: true)
   ```

   ```bash
   python3 scripts/i18n-add-keys.py claves.json
   ```

   El script exige los cuatro idiomas y aborta si rompes la paridad.

**Las respuestas salen de estas guías, no de la cabeza de nadie.** Si cambias
cómo funciona algo, el tema de ayuda que lo explica cambia con ello — si no,
el bot pasa a ser una fuente de mentiras con la autoridad de estar dentro del
producto.

### Nunca escribas el nombre de una pantalla

Para mandar a un sitio del menú, **interpola**; no lo copies:

```
"{{menuCampo}} → {{menuRegistro}}: una línea por número de trabajo…"
```

El componente los saca de `nav.*` y los pasa a `t()`, así que la ayuda nombra
cada sección exactamente como la nombra el menú, en el idioma que esté puesto.

Esto no es estilo. Pasó: el bot estaba traducido a los cuatro idiomas y aun
así, **en francés mandaba a «TERRAIN → Registre de travail» cuando el menú
dice CHANTIER → Suivi des travaux**, y en italiano a «CAMPO» cuando dice
CANTIERE. Cada idioma se escribió a mano por separado y divergió del producto
sin que nada fallara. Un texto correcto que te manda a una opción inexistente
es peor que no tener ayuda.

| Marcador | Sale de |
|---|---|
| `{{menuAjustes}}` `{{menuEmpresa}}` `{{menuTipos}}` `{{menuPagos}}` `{{menuMargenes}}` | Configuración |
| `{{menuCampo}}` `{{menuTecnicos}}` `{{menuOrdenes}}` `{{menuRegistro}}` `{{menuFichaje}}` | Campo |
| `{{menuFinanzas}}` `{{menuFacturacion}}` `{{menuInformes}}` | Finanzas |
| `{{menuCrm}}` `{{menuPortal}}` `{{menuProyectos}}` | El resto |

Lo vigila un script, que falla si alguien vuelve a copiarlo a mano:

```bash
python3 scripts/check-help-menu.py
```

### Secciones y a qué pantallas pertenecen

| Sección | Rutas que la abren por defecto |
|---|---|
| Empezar | *(ninguna: es la de arranque)* |
| Clientes y mensajes | `/crm`, `/client-portal`, `/communication` |
| Presupuestos | `/budgets`, `/materials` |
| Obras y trabajo | `/projects`, `/work-orders`, `/scheduling`, `/check-in`, `/work-log`, `/technicians`, `/gps-routing` |
| Dinero | `/invoicing`, `/payroll`, `/reports`, `/cost-tracking`, `/settings/payments` |
| Algo no funciona | *(ninguna)* |

La coincidencia es por prefijo y **gana la más larga**: `/settings/payments`
pertenece a Dinero, mientras que el resto de `/settings/…` no pertenece a
ninguna sección y abre el menú completo.

---

## Qué suele salir mal

**Sale `help.topic.algo.otro.p3` en pantalla.** El `parrafos` del árbol dice
más párrafos de los que hay claves. Cuadra el número o añade la clave que
falta.

**Un tema no aparece.** Está en el árbol pero en una sección que no es la que
estás mirando; el menú de secciones las lista todas, así que comprueba dentro
de cuál lo pusiste.

**El botón Llévame allí no lleva a ningún sitio.** La `ruta` tiene que existir
en `client/src/App.tsx`. No hay comprobación automática de eso.
