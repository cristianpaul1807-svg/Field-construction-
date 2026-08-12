# Base de datos y seguridad por filas (RLS)

Postgres alojado en Supabase. **No hay base de datos local ni archivos de
migración en el repositorio**: el esquema vive en el proyecto de Supabase y se
cambia con las herramientas MCP de Supabase.

Proyecto: `trqdwkknvbfxdljnisya`

---

## Mirar antes de tocar

```sql
-- ¿Qué columnas tiene realmente esta tabla?
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'invoices'
order by ordinal_position;
```

Adivinar el nombre de una columna es la forma más rápida de perder media hora.
Míralo siempre.

---

## Cambiar el esquema

Usa `apply_migration` (no `execute_sql`) para cualquier DDL: queda registrada
con nombre y se puede revisar después.

```sql
-- name: change_orders
create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  amount numeric not null default 0,
  status text not null default 'borrador',
  created_at timestamptz not null default now(),
  constraint change_orders_status_check
    check (status in ('borrador', 'enviado', 'aprobado', 'rechazado'))
);
```

Reglas de la casa:

- **`business_id` siempre**, con `on delete cascade`. Es la columna sobre la
  que se apoya todo el aislamiento entre negocios.
- **`check` para los estados.** Es lo que impide que un `status` inventado
  entre por una ruta que se te olvidó validar.
- **Índice sobre `business_id`** y sobre cualquier clave foránea por la que
  vayas a filtrar.
- **`comment on column`** cuando el nombre no baste. `holdback_amount` sin
  comentario no dice que `amount` ya viene neto de él.
- **Los comentarios de la migración explican el porqué**, no el qué. El SQL
  ya dice qué hace.

---

## Activar RLS: obligatorio, sin excepciones

Toda tabla en `public` queda expuesta por PostgREST. Una tabla sin RLS es una
tabla que la clave anónima puede leer **y escribir** desde cualquier
navegador.

Esto pasó de verdad en este proyecto: `canada_tax_rates` se creó sin RLS.
Como es una tabla de referencia, parecía inofensivo — pero cualquiera podía
haber reescrito las tasas de impuestos con las que se calcula cada factura
del sistema.

```sql
alter table public.change_orders enable row level security;

-- El personal del negocio: acceso completo a sus propias filas.
create policy change_orders_business_all on public.change_orders
  for all
  using (business_id = private.current_business_id())
  with check (business_id = private.current_business_id());

-- El cliente: solo lectura, y solo de sus propios proyectos.
create policy change_orders_client_read on public.change_orders
  for select
  using (
    project_id in (
      select id from public.projects where client_id = private.current_client_id()
    )
  );
```

Para una tabla de referencia pública, lectura para todos y escritura solo por
service role (que salta RLS):

```sql
alter table public.canada_tax_rates enable row level security;
create policy canada_tax_rates_read on public.canada_tax_rates
  for select using (true);
```

### Comprueba con el linter

Después de **cada** cambio de esquema:

```
get_advisors(project_id, type: "security")
```

Un `rls_disabled_in_public` de nivel ERROR se arregla antes de seguir.

---

## Las dos funciones de identidad

```
private.current_business_id()   → el negocio de quien llama
private.current_client_id()     → el cliente de quien llama
```

Ambas resuelven desde `auth.uid()`. Por eso solo funcionan cuando la petición
lleva una sesión de Supabase Auth.

**Un trabajador nunca tiene `auth.uid()`**, y un cliente que entró con código
de acceso tampoco. Sus rutas usan `getSupabaseAdmin()`, que salta RLS por
completo, y por eso tienen que:

1. filtrar a mano con `.eq("business_id", …)`, y
2. comprobar que la fila pertenece a quien llama **antes** de tocarla.

```ts
// Patrón obligatorio en cualquier ruta de trabajador o de cliente por código.
const { data: owned } = await admin
  .from("estimates")
  .select("id, business_id")
  .eq("id", req.params.id)
  .eq("client_id", req.clientId!)      // ← esto es lo único que separa un cliente de otro
  .maybeSingle();
if (!owned) {
  res.status(404).json({ error: "estimate not found" });
  return;
}
```

Devuelve 404, no 403: confirmar que un recurso existe pero no es tuyo ya es
filtrar información.

---

## Códigos de acceso

Trabajadores y clientes entran con un código, sin correo ni contraseña. El
código se guarda como hash SHA-256 en `access_token_hash`; el valor en claro
solo existe en el momento de generarlo, que es cuando se le enseña al negocio
para que lo comparta.

```ts
.eq("access_token_hash", hashToken(token))
```

Generar uno nuevo invalida el anterior. Eso es intencional: es la forma de
revocar el acceso de alguien que ya no trabaja en la empresa.

---

## Tablas principales

| Tabla | Para qué |
|---|---|
| `businesses` | El negocio: nombre, slug público, licencia RBQ, números de TPS/TVQ, provincia, % de depósito y de retención |
| `business_settings` | Márgenes y merma por defecto |
| `users`, `roles` | Quién entra al panel y con qué permisos |
| `clients` | Clientes y leads, con su estado en el embudo |
| `projects` | La obra: estado, avance, fechas, presupuesto vinculado |
| `estimates`, `estimate_lines` | Presupuesto y sus partidas |
| `assembly_templates`, `assembly_items` | Plantillas reutilizables de presupuesto |
| `change_orders` | Órdenes de cambio (avenants) |
| `budget_categories` | Categorías del negocio, con documentos de referencia |
| `materials_catalog`, `labor_rates` | Catálogo de precios |
| `expenses` | Gasto real, para comparar contra lo presupuestado |
| `invoices` | Facturas, con subtotal, impuesto, desglose y retención |
| `employees`, `subcontractors` | El equipo |
| `assignments`, `work_orders`, `schedule_events` | Quién hace qué y cuándo |
| `time_entries` | Fichajes con coordenadas |
| `documents`, `photos` | Archivos por proyecto |
| `chat_channels`, `chat_messages` | Mensajería interna y pública |
| `conversations`, `messages` | El chat público antes de que exista cliente |
| `canada_tax_rates` | Tasas por provincia (referencia fija) |

---

## Escribir consultas contra el esquema

Cuando pidas relaciones, Supabase las anida:

```ts
.select("id, amount, projects(name), clients(name, email)")
```

Y llegan como objeto anidado, que hay que aplanar al responder:

```ts
res.json(data.map((row: any) => ({
  id: row.id,
  amount: Number(row.amount),
  projectName: row.projects?.name ?? null,
})));
```

`numeric` de Postgres llega como **string** en JavaScript. Envuélvelo siempre
en `Number()`, o `1000 + 500` acabará siendo `"1000500"`.
