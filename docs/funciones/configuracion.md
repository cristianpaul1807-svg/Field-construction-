# Configuración

Seis pantallas. Las dos primeras hay que rellenarlas antes de emitir el primer
documento; el resto se ajusta con el tiempo.

---

## Datos de la empresa

**Dónde:** menú → Configuración → Datos de la empresa
**Código:** `client/src/pages/SettingsCompany.tsx`

Dos tarjetas.

### Identidad y enlace público

| Campo | Para qué |
|---|---|
| **Nombre del negocio** | Encabeza cada presupuesto y factura |
| **Número de licencia** | Tu RBQ en Quebec |
| **Link público** | El *slug* de tu chat público: `tu-dominio/c/este-valor` |
| **Provincia** | Determina qué impuesto se cobra ([guía](impuestos-canada.md)) |
| **Tasa de impuesto** | Solo si tienes un caso especial; normalmente la pone la provincia |

> **Cuidado con el slug.** Cambiarlo rompe todos los enlaces que ya hayas
> repartido: códigos QR en vehículos, el mensaje de bienvenida de WhatsApp,
> tu bio de Instagram. Quien tenga el enlace viejo deja de poder usarlo.
> Cámbialo pronto o no lo cambies.

### Datos para presupuestos y facturas

Esto es lo que se imprime en la cabecera de cada documento:

| Campo | Formato |
|---|---|
| Dirección | calle, ciudad, provincia, código postal |
| Teléfono y correo | los de contacto del negocio |
| **Número de TPS/GST** | `123456789 RT0001` |
| **Número de TVQ/QST** | `1234567890 TQ0001` |
| **Depósito por defecto (%)** | 30 suele ser lo habitual |
| **Retención por defecto (%)** | 10 en Quebec, 0 si no la aplicas |
| **Condiciones del presupuesto** | El texto legal que va al pie |

**En Quebec, los números de TPS y TVQ no son opcionales en una factura.**
Dejarlos vacíos produce un documento que el contador de tu cliente te
devuelve. Ver [impuestos-canada.md](impuestos-canada.md).

---

## Pagos

Conectar tu cuenta de Stripe para cobrar con tarjeta. Tiene guía propia:
[pagos-stripe.md](pagos-stripe.md).

---

## Márgenes y reglas

**Dónde:** menú → Configuración → Márgenes y reglas
**Código:** `client/src/pages/SettingsMargins.tsx`

Los valores por defecto de cada presupuesto nuevo.

**Tipo de margen**

- **Global** — un porcentaje para todo el presupuesto. Más simple.
- **Por sección** — ajustable zona a zona. Útil cuando una parte de la obra
  tiene más riesgo o menos competencia que otra.

**Factor de merma por defecto (0–25%)**

El material que se pierde en cortes, roturas y sobrantes. Se aplica solo al
crear un presupuesto, y se puede cambiar en cada uno.

Ninguno de los dos es una decisión permanente: son el punto de partida. Ver
[presupuestos.md](presupuestos.md#merma-y-margen).

**Guardar cambios** para aplicar.

---

## Usuarios y roles

**Dónde:** menú → Configuración → Usuarios y roles
**Código:** `client/src/pages/SettingsUsers.tsx`

Quién entra al panel y con qué permisos.

### Añadir a alguien del equipo

1. **Invitar usuario**.
2. Nombre, correo, teléfono y rol.
3. **Guardar**.

**No se envía ningún correo.** La persona entra registrándose con **ese mismo
correo**, y su cuenta se enlaza sola con la fila que acabas de crear.

Es intencional: nada en este producto depende de que un correo se entregue.
Los correos de invitación se pierden en spam, caducan, y dejan a alguien
esperando algo que nunca llega. Si le dices "regístrate con tu correo del
trabajo", funciona siempre.

### Los roles

| Rol | Para quién |
|---|---|
| Admin | El dueño. Todo |
| Oficina | Administración: presupuestos, facturas, clientes |
| Técnico | Personal de campo |
| Subcontratista | Acceso limitado |

Los permisos de cada rol se ven en la tarjeta de abajo.

---

## Conexión WhatsApp

**Dónde:** menú → Configuración → Conexión WhatsApp
**Código:** `client/src/pages/SettingsWhatsapp.tsx`

Esta pantalla te da **tu enlace de chat público** y te explica dónde ponerlo,
porque eso es lo que funciona hoy: sin aprobación de Meta y sin pagar por
mensaje.

Ver [chat-publico.md](chat-publico.md#dónde-poner-tu-enlace).

### Por qué no hay un botón de "conectar WhatsApp"

La API de WhatsApp Business no se puede activar desde aquí: Meta exige que la
empresa complete **su propia** verificación, con su Business Manager y su app
de desarrollador. Esta plataforma no puede hacer eso en tu nombre.

Antes esta pantalla tenía un botón *Iniciar Embedded Signup* que no hacía
nada. Se quitó. Un botón que no funciona es peor que no tener botón: te hace
perder el tiempo y no te deja saber qué sí funciona.

Lo que hace falta para una conexión directa, cuando lo tengas, está listado en
la propia pantalla.

---

## Automatizaciones

**Dónde:** menú → Configuración → Automatizaciones
**Código:** `client/src/pages/SettingsAutomations.tsx`

Tu enlace público y el **texto sugerido para el Mensaje de Bienvenida** de
WhatsApp Business, ya redactado con el nombre de tu negocio y tu enlace
dentro, en el idioma que tengas el panel.

Cópialo y pégalo en WhatsApp Business → *Herramientas para la empresa* →
*Mensaje de bienvenida*.

Con eso montado, cualquiera que te escriba por primera vez recibe al instante
un enlace que recoge sus datos y te los entrega listos para presupuestar, sin
que tú toques nada. Es la automatización que más trabajo ahorra de todo el
sistema.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET · PATCH /api/settings/company` | Datos de la empresa |
| `GET · PATCH /api/settings/margins` | Márgenes y merma |
| `GET · POST /api/settings/users[/:id]` | Usuarios |
| `GET /api/canada-tax-rates` | Tasas por provincia |
| `GET /api/stripe/connect/status` | Estado de Stripe |

La unicidad del slug se comprueba contra **todos** los negocios, no solo los
que RLS deja ver, así que esa comprobación usa el cliente administrador. La
escritura sigue pasando por `req.supabase`, para que RLS siga garantizando que
solo tocas tu propia fila.

---

## El logo

Se sube en **Configuración → Datos de la empresa**, en la tarjeta de arriba.

1. **Cambiar logo** → elige el archivo (PNG, JPG, WebP o SVG).
2. Aparece al momento, y desde ese instante encabeza cada presupuesto y cada
   factura que generes.
3. **Eliminar** vuelve a la inicial del nombre.

El nombre del negocio sigue apareciendo debajo del logo, siempre. Un logo cuyo
texto no se lee a tamaño pequeño dejaría el documento sin identificar, y un
presupuesto sin nombre de empresa no vale como oferta.

Los logos se guardan en un bucket **público**, a diferencia de las fotos y los
contratos. Es deliberado: el generador de PDF lo vuelve a leer meses después,
y un enlace firmado que caduca dejaría un presupuesto archivado sin su propia
cabecera.

---

## La campana de notificaciones

En la barra superior, a la derecha. Reúne lo que espera una decisión tuya:

| Aviso | Lleva a |
|---|---|
| Presupuesto por aprobar | Presupuestos |
| Factura vencida | Facturación |
| Solicitud de cita | Comunicación |
| Orden de cambio esperando al cliente | Proyectos |

No hay una tabla de notificaciones: la lista se calcula de las filas reales
en cada consulta. Una tabla habría que escribirla en cada punto donde algo
cambia, y se desincronizaría la primera vez que se olvidara uno.
