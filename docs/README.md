# Guías del sistema

Esta carpeta es el manual del producto. Si no sabes cómo hacer algo, abre el
archivo correspondiente y sigue el paso a paso: cada guía explica **para qué
sirve** la función, **cómo se usa** desde la pantalla, **qué toca por dentro**
(tablas y rutas de la API) y **qué suele salir mal**.

Todas las guías están escritas para dos lectores a la vez: la persona que usa
la plataforma para gestionar su empresa, y quien va a extender el código.

---

## Empieza por aquí

| Si quieres… | Abre |
|---|---|
| Entender cómo encaja todo | [arquitectura.md](arquitectura.md) |
| Añadir una función nueva de principio a fin | [desarrollo/anadir-una-funcion.md](desarrollo/anadir-una-funcion.md) |
| Añadir o corregir textos en los cuatro idiomas | [desarrollo/idiomas.md](desarrollo/idiomas.md) |
| Cambiar el esquema de la base de datos | [desarrollo/base-de-datos.md](desarrollo/base-de-datos.md) |
| Desplegar, o arreglar un despliegue caído | [desarrollo/despliegue.md](desarrollo/despliegue.md) |
| Diagnosticar un error que ya está pasando | [desarrollo/solucion-de-problemas.md](desarrollo/solucion-de-problemas.md) |

---

## Guías por función

Cada entrada del menú tiene su sección. La columna de la derecha lleva
directamente al paso a paso.

### Panel

| Menú | Guía |
|---|---|
| Panel | [funciones/panel.md](funciones/panel.md) |

### Clientes

| Menú | Guía |
|---|---|
| CRM | [funciones/clientes.md](funciones/clientes.md#crm) |
| Portal del cliente | [funciones/clientes.md](funciones/clientes.md#portal-del-cliente) |
| Comunicación | [funciones/comunicacion.md](funciones/comunicacion.md) |
| *(sin menú)* Chat público `/c/tu-negocio` | [funciones/chat-publico.md](funciones/chat-publico.md) |

### Proyectos

| Menú | Guía |
|---|---|
| Proyectos | [funciones/proyectos.md](funciones/proyectos.md) |
| Presupuestos | [funciones/presupuestos.md](funciones/presupuestos.md) |
| *(dentro de Presupuestos)* Plantillas | [funciones/presupuestos.md](funciones/presupuestos.md#plantillas-de-presupuesto) |
| *(dentro de Proyectos)* Órdenes de cambio | [funciones/proyectos.md](funciones/proyectos.md#órdenes-de-cambio) |
| *(dentro de Proyectos)* Orden de ejecución y estados | [funciones/proyectos.md](funciones/proyectos.md#el-orden-de-ejecución) |
| Materiales y costos | [funciones/materiales.md](funciones/materiales.md) |
| Control de costos | [funciones/control-de-costos.md](funciones/control-de-costos.md) |
| Contratos y documentos | [funciones/documentos-y-fotos.md](funciones/documentos-y-fotos.md#contratos-y-documentos) |
| Galería de fotos | [funciones/documentos-y-fotos.md](funciones/documentos-y-fotos.md#galería-de-fotos) |

### Campo

| Menú | Guía |
|---|---|
| Técnicos | [funciones/equipo.md](funciones/equipo.md#técnicos-empleados) |
| Subcontratistas | [funciones/equipo.md](funciones/equipo.md#subcontratistas) |
| *(sin menú)* App del trabajador `/campo` | [funciones/equipo.md](funciones/equipo.md#la-app-del-trabajador) |
| GPS y rutas | [funciones/campo-gps-y-fichaje.md](funciones/campo-gps-y-fichaje.md#gps-y-rutas) |
| Check-in / Check-out | [funciones/campo-gps-y-fichaje.md](funciones/campo-gps-y-fichaje.md#check-in-check-out) |
| Órdenes de trabajo | [funciones/ordenes-de-trabajo.md](funciones/ordenes-de-trabajo.md) |
| Agenda | [funciones/agenda.md](funciones/agenda.md) |

### Finanzas

| Menú | Guía |
|---|---|
| Facturación | [funciones/facturacion.md](funciones/facturacion.md) |
| *(dentro de Facturación)* Impuestos y retención | [funciones/impuestos-canada.md](funciones/impuestos-canada.md) |
| *(en varias pantallas)* PDF de presupuesto y factura | [funciones/documentos-pdf.md](funciones/documentos-pdf.md) |
| Nóminas | [funciones/nominas.md](funciones/nominas.md) |
| Reportes | [funciones/reportes.md](funciones/reportes.md) |

### Configuración

| Menú | Guía |
|---|---|
| Datos de la empresa | [funciones/configuracion.md](funciones/configuracion.md#datos-de-la-empresa) |
| Pagos (Stripe) | [funciones/pagos-stripe.md](funciones/pagos-stripe.md) |
| *(dentro de Pagos)* Plan de pagos por etapas | [funciones/facturacion.md](funciones/facturacion.md#el-plan-de-pagos) |
| Márgenes y reglas | [funciones/configuracion.md](funciones/configuracion.md#márgenes-y-reglas) |
| Usuarios y roles | [funciones/configuracion.md](funciones/configuracion.md#usuarios-y-roles) |
| Conexión WhatsApp | [funciones/configuracion.md](funciones/configuracion.md#conexión-whatsapp) |
| Automatizaciones | [funciones/configuracion.md](funciones/configuracion.md#automatizaciones) |

---

## Cómo mantener esta carpeta

Cuando añadas una función, añade también su paso a paso aquí, y enlázala
desde la tabla de arriba. Una función sin guía es una función que alguien va
a tener que reconstruir leyendo el código.
