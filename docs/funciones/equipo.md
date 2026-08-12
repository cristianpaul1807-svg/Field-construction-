# El equipo: técnicos, subcontratistas y la app de campo

---

## Técnicos (empleados)

**Dónde:** menú → Campo → Técnicos
**Código:** `client/src/pages/Technicians.tsx`

### Para qué sirve

Tu gente en nómina: quién está disponible, quién está en obra y quién libra.

| Estado | Qué significa |
|---|---|
| `disponible` | Se le puede asignar trabajo |
| `en_proyecto` | Está en una obra |
| `descanso` | No disponible |

### Dar de alta

1. **Nuevo técnico**.
2. Nombre, teléfono y oficio.
3. **Crear**.

Al crearse se le abre automáticamente un canal de mensajería contigo, así que
puedes escribirle desde el primer momento sin configurar nada.

### Darle acceso a la app de campo

1. **Código PWA** en su tarjeta.
2. Se genera un código y se muestra **una sola vez**.
3. Cópialo y mándaselo por donde ya habláis.

Generar uno nuevo **invalida el anterior**: es la forma de quitarle el acceso
a alguien que ya no trabaja contigo.

---

## Subcontratistas

**Dónde:** menú → Campo → Subcontratistas
**Código:** `client/src/pages/Subcontractors.tsx`

### Para qué sirve

Los oficios que no llevas en nómina: el plomero, el electricista, el
techador. Guardas su oficio, su teléfono, tu valoración y en qué proyectos
están.

La valoración es tuya y sirve para lo que sirve de verdad: acordarte de a
quién volver a llamar.

### Dar de alta

1. **Nuevo subcontratista**.
2. Nombre, oficio y teléfono.
3. **Crear**.

Igual que con los técnicos, se crea su canal de mensajería.

### Su acceso a la app

El mismo botón de **Código PWA**. La etiqueta de su tarjeta te dice si ya
tiene código emitido o no.

Un subcontratista con código puede fichar entrada y salida, ver su agenda y
escribirte, exactamente igual que un empleado. La diferencia está en cómo se
le paga, no en cómo usa la aplicación.

### Sus precios

Los subcontratistas aparecen en el catálogo de [Materiales](materiales.md)
como *Cotiza por proyecto*: no llevan precio fijo porque su trabajo se cotiza
obra a obra. Se pueden insertar en plantillas de presupuesto igual que un
material.

---

## La app del trabajador

**Dónde:** el trabajador entra en `tu-dominio/campo`
**Código:** `client/src/pages/WorkerAccess.tsx`, `WorkerClock.tsx`,
`WorkerScheduleView.tsx`, `WorkerChat.tsx`

### Para qué sirve

Es lo que el trabajador lleva en el móvil. Tres cosas y nada más, porque en
una obra no se navega por menús:

1. **Agenda** — qué le toca hoy y esta semana.
2. **Fichaje** — entrada y salida.
3. **Mensajes** — hablar contigo.

### Cómo entra

1. Abre `tu-dominio/campo`.
2. Escribe el código que le diste.
3. Ya está. **No hay correo ni contraseña**, y no hay que instalar nada: es
   una web que se puede añadir a la pantalla de inicio.

### Fichar

1. Elige el proyecto.
2. **Entrada**. El móvil pide la ubicación — es obligatoria, porque es lo que
   convierte el fichaje en una prueba de que estuvo allí.
3. Marca si las horas son facturables y el tipo de servicio (instalación,
   mantenimiento, reparación, inspección).
4. Al terminar, **Salida**.

Si cambia de obra a media jornada, **Cambiar de proyecto** cierra el fichaje
anterior y abre el nuevo de una vez.

Las coordenadas del fichaje son las que alimentan el mapa de
[GPS y rutas](campo-gps-y-fichaje.md#gps-y-rutas).

### Qué ve y qué no

Ve su agenda, sus órdenes de trabajo y sus mensajes. **No ve** presupuestos,
precios, márgenes, otros clientes ni el trabajo de sus compañeros.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET · POST /api/employees` | Técnicos |
| `POST /api/employees/:id/access-token` | Su código |
| `GET · POST /api/subcontractors` | Subcontratistas |
| `POST /api/subcontractors/:id/access-token` | Su código |
| `POST /api/worker-auth/login` | Entrar con código |
| `GET /api/worker/schedule` · `/projects` | Su agenda y sus obras |
| `POST /api/worker/time-entries/check-in` · `/:id/check-out` | Fichaje |
| `POST /api/worker/time-entries/switch-project` | Cambio de obra |
| `GET · POST /api/worker/chat/…` | Mensajería |

**Un trabajador no tiene `auth.uid()`.** Sus rutas usan el cliente
administrador, que salta RLS, así que **filtran a mano** por `business_id` y
comprueban que cada fila es suya antes de tocarla. Ese filtro es lo único que
separa a los trabajadores de un negocio de los de otro: si escribes una ruta
de trabajador nueva, no es opcional.

Los códigos se guardan como hash SHA-256 en `access_token_hash`. El valor en
claro solo existe en el instante en que se genera, que es cuando se muestra en
pantalla.
