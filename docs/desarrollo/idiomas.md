# Idiomas (español, inglés, francés, italiano)

Todo el sistema está en los cuatro idiomas: el panel, el portal del cliente,
la app del trabajador, el chat público y los PDF. Ningún texto visible se
escribe directamente en el código.

---

## Dónde vive cada cosa

| Qué | Dónde | Por qué ahí |
|---|---|---|
| Interfaz (todo lo que se ve) | `client/src/i18n/locales/{es,en,fr,it}.json` | Se traduce al vuelo cuando cambias de idioma |
| Textos del bot del chat público | `server/flowMessages.ts` | Cada frase se **guarda** como mensaje real de la conversación |
| Textos de los PDF | `server/documents.ts` (`COPY`) | El PDF se genera en el servidor |
| Pantalla de error de arranque | `client/src/main.tsx` (`FATAL_COPY`) | Aparece cuando la app no llegó a montar, así que no puede usar i18next |

El bot está en el servidor a propósito. Si sus frases vivieran en el bundle,
cambiar de idioma reescribiría conversaciones pasadas. Como se guardan al
escribirlas, la transcripción conserva el idioma en el que se habló — igual
que una conversación entre personas.

---

## Añadir textos: el paso a paso

### 1. Escribe un archivo JSON con las claves

```json
{
  "materials.newMaterial": {
    "es": "Nuevo material",
    "en": "New material",
    "fr": "Nouveau matériau",
    "it": "Nuovo materiale"
  },
  "materials.deleteConfirm": {
    "es": "¿Eliminar esta línea del catálogo?",
    "en": "Delete this catalog entry?",
    "fr": "Supprimer cette entrée du catalogue ?",
    "it": "Eliminare questa voce dal catalogo?"
  }
}
```

Guárdalo donde quieras (es temporal, no va al repositorio).

### 2. Aplícalo

```bash
python3 scripts/i18n-add-keys.py mis-claves.json
```

Salida esperada:

```
ok — 760 keys in each of es, en, fr, it
```

El script se niega a escribir nada si falta un idioma o si algún valor está
vacío, y al terminar comprueba que los cuatro archivos tienen exactamente el
mismo conjunto de claves. Es lo que impide que se cuele un texto en un solo
idioma.

### 3. Úsalas

```tsx
const { t } = useTranslation();

<Button>{t("materials.newMaterial")}</Button>
```

Con valores dentro:

```tsx
t("costTracking.descriptionForProject", { project: selectedProject.name })
// es.json → "Presupuestado vs. gastado real — {{project}}"
```

---

## Valores guardados: se traducen al mostrar, nunca al guardar

Las columnas de estado guardan su valor en español (`en_progreso`,
`mano_obra`, `aceptado`). **Eso es el dato**, y no se traduce nunca al
escribir: si lo hicieras, cambiar de idioma rompería todas las consultas.

Se traduce solo al mostrarlo:

```tsx
<StatusBadge>{t(`projects.statuses.${project.status}`)}</StatusBadge>
```

Y en el JSON se agrupan por prefijo:

```json
"projects": {
  "statuses": {
    "planificacion": "Planificación",
    "en_progreso": "En progreso",
    "pausado": "Pausado",
    "completado": "Completado"
  }
}
```

Grupos que ya existen y hay que mantener completos en los cuatro idiomas:

```
budgets.estimateStatus      invoicing.status        settings.roles
budgets.lineCategories      invoicing.type          technicians.status
changeOrders.status         invoicing.typeLong      workOrders.priorities
communication.labels        payments.status         workOrders.statuses
contracts.tags              projects.statuses       worker.serviceTypes
costTracking.categories     scheduling.types
crm.status
```

Si añades un valor nuevo a una columna de estado, **añade también su clave en
los cuatro idiomas en el grupo correspondiente**, o la pantalla mostrará el
slug crudo.

---

## Comprobar que todo está bien

Paridad exacta y sin valores vacíos:

```bash
python3 - <<'PY'
import json
def flat(o, p=''):
    out = set()
    for k, v in o.items():
        out |= flat(v, f'{p}{k}.') if isinstance(v, dict) else {p + k}
    return out
sets = {l: flat(json.load(open(f'client/src/i18n/locales/{l}.json'))) for l in ['es','en','fr','it']}
base = sets['es']
print('paridad:', all(s == base for s in sets.values()), '|', len(base), 'claves')
PY
```

Claves usadas en el código que no existen en el JSON:

```bash
python3 - <<'PY'
import json, re, glob
def flat(o, p=''):
    out = set()
    for k, v in o.items():
        out |= flat(v, f'{p}{k}.') if isinstance(v, dict) else {p + k}
    return out
defined = flat(json.load(open('client/src/i18n/locales/es.json')))
used = set()
for f in glob.glob('client/src/**/*.tsx', recursive=True):
    used |= set(re.findall(r't\(\s*"([^"]+)"', open(f).read()))
missing = sorted(k for k in used if k not in defined and '.' in k)
print('faltan:', missing or 'ninguna')
PY
```

Y míralo en un navegador de verdad, con el idioma del navegador cambiado:

```js
const ctx = await browser.newContext({ locale: "fr-CA" });
```

Un texto puede existir en el JSON y aun así verse mal — desbordar un botón,
o quedar cortado. Eso solo se ve mirando.

---

## Detalles de cada idioma que conviene respetar

- **Francés (Quebec).** Espacio antes de `?`, `!` y `:` (`Mot de passe
  oublié ?`). Vocabulario de Quebec, no de Francia: *soumission* en vez de
  *devis*, *courriel* en vez de *e-mail*, *TPS/TVQ* en vez de *TVA*.
- **Inglés (Canadá).** *Licence* con c cuando es sustantivo. *Estimate*, no
  *quote*, para el documento que firma el cliente.
- **Italiano.** *Preventivo* para el presupuesto, *variante* para la orden de
  cambio.
- **Español.** El original del proyecto. *Presupuesto*, *orden de cambio*,
  *retención*.

Las cuatro traducciones de un mismo concepto tienen que decir lo mismo. Si
una versión suena más suave o promete algo distinto, es un error, no un
matiz.
