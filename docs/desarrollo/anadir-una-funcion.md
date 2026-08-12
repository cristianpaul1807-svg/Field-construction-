# Añadir una función, de principio a fin

Esta es la receta completa. El ejemplo es real: añadir "gastos" a Control de
costos, que es exactamente como se hizo.

Los siete pasos, en orden. Saltarse el 6 es la causa más común de que algo
"funcione" en desarrollo y falle en producción.

---

## 1. ¿Necesitas tabla nueva o columna nueva?

Si la respuesta es sí, ve primero a
[base-de-datos.md](base-de-datos.md) y aplica la migración. Vuelve aquí
cuando la tabla exista.

Comprueba siempre el nombre real de las columnas antes de escribir la
consulta. Adivinar cuesta media hora de depuración:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'expenses'
order by ordinal_position;
```

---

## 2. Escribe la ruta en `server/api.ts`

Todas las rutas van envueltas en `route()`, que captura los errores y los
convierte en una respuesta JSON en vez de tumbar el proceso.

```ts
apiRouter.post(
  "/expenses",
  route(async (req, res) => {
    const { projectId, category, description, amount, date } = req.body ?? {};

    // Valida lo que hace falta para que la fila tenga sentido, y devuelve
    // 400 con un mensaje que explique qué falta.
    if (!projectId || amount === undefined || Number(amount) <= 0) {
      res.status(400).json({ error: "projectId and a positive amount are required" });
      return;
    }

    const supabase = req.supabase!;          // cliente con RLS del que llama
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        business_id: req.businessId!,        // siempre, en toda inserción
        project_id: projectId,
        category: category?.trim() || null,
        description: description?.trim() || null,
        amount: Number(amount),
        date: date || new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (error) throw error;

    res.status(201).json({ id: data.id });
  })
);
```

Reglas que no se negocian:

- **`business_id` en cada `insert`**, y `.eq("business_id", req.businessId!)`
  en cada `update`, `delete` y `select`. RLS lo respalda, pero el filtro
  explícito es lo que hace que la intención se lea en el código.
- **Valida los valores de estado contra una lista blanca.** Un `status`
  cualquiera que llegue del cliente puede romper una restricción de la base
  de datos y devolver un 500 en vez de un 400 claro.
- **Las marcas de tiempo de una transición las pone el servidor**, no el
  cliente. Si `status` pasa a `enviado`, el servidor escribe `sent_at`. Si lo
  aceptara del cuerpo de la petición, el historial se podría retrasar.
- **Coloca la ruta del lado correcto** de `apiRouter.use(requireBusinessAuth)`
  — ver [arquitectura.md](../arquitectura.md#el-orden-de-las-rutas-importa).

---

## 3. Comprueba que compila

```bash
npx tsc --noEmit
```

Silencio significa que va bien.

---

## 4. Conecta la pantalla

Leer datos y recargarlos después de escribir:

```tsx
const { data, loading, error, reload } = useApi<Expense[]>(
  selectedProjectId ? `/api/expenses?projectId=${selectedProjectId}` : null
);
```

Pasar `null` como ruta salta la petición — úsalo mientras esperas un
prerrequisito, como el proyecto seleccionado.

Escribir:

```tsx
const save = async () => {
  setSaving(true);
  setFormError(null);
  try {
    const res = await apiFetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: selectedProjectId, category, amount, date }),
    });
    if (!res.ok) {
      throw new Error((await res.json().catch(() => null))?.error || t("common.genericError"));
    }
    setOpen(false);
    reload();          // vuelve a pedir los datos; nada de tokens en la URL
  } catch (err) {
    setFormError(err instanceof Error ? err.message : t("common.genericError"));
  } finally {
    setSaving(false);
  }
};
```

`apiFetch` pone la cabecera `Authorization` sola — sirve tanto para una sesión
de Supabase como para un código de acceso de cliente. No la añadas a mano.

Cada estado tiene que verse: cargando, error, vacío, y con datos. Un `loading`
sin indicador parece una pantalla rota.

---

## 5. Añade los textos en los cuatro idiomas

Ningún texto visible se escribe directamente en el JSX. Ver
[idiomas.md](idiomas.md) para el script que los añade a los cuatro archivos a
la vez y comprueba la paridad.

---

## 6. Escribe la guía

Añade el paso a paso en `docs/funciones/` y enlázalo desde
[docs/README.md](../README.md). Una función sin guía es una función que
alguien va a tener que reconstruir leyendo el código.

---

## 7. Verifica de verdad

```bash
npx tsc --noEmit                      # en silencio
python3 scripts/check-route-gate.py   # cada ruta en su lado de la barrera
npm run build        # sin errores
```

Y luego míralo en un navegador. En este proyecto, mirar la pantalla ha
encontrado errores reales que el compilador jamás habría visto: un mapa que
no se centraba, una selección larga que se deseleccionaba sola, un pie de
página que caía fuera de la hoja.

```bash
npx vite --host --port 5188
```

Para una captura automática, ver el patrón en
[solucion-de-problemas.md](solucion-de-problemas.md#mirar-la-pantalla-de-verdad).

---

## Descargar un archivo desde una ruta autenticada

Un `<a download>` normal no sirve: el token va en una cabecera, y una
navegación por enlace no lleva cabeceras, así que el servidor responde 401.
Usa el ayudante:

```tsx
await downloadFile(
  `/api/estimates/${id}/pdf?download=1&lang=${i18n.language.slice(0, 2)}`,
  `Presupuesto-${id.slice(0, 8).toUpperCase()}.pdf`
);
```

---

## Errores que ya se han cometido aquí

| Síntoma | Causa |
|---|---|
| La ruta devuelve 401 solo para clientes | Quedó por debajo de `requireBusinessAuth` |
| El gasto nunca aparece en el presupuesto | Un lado guarda `mano_obra` y el otro compara `"Mano de obra"` |
| `[...new Set(x)]` no compila | Usa `Array.from(new Set(x))` |
| El import quedó dentro de otro import | Inserta después del último import completo, no por número de línea |
| Falta una clave en un idioma | No usaste el script de [idiomas.md](idiomas.md) |
