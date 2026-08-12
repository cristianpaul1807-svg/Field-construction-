# Chat público — la puerta de entrada de clientes nuevos

**Dónde:** `tu-dominio/c/tu-negocio` · sin menú, es público
**Código:** `client/src/pages/PublicBusinessChat.tsx`, `server/flowMessages.ts`

---

## Para qué sirve

Es por donde entra un cliente que todavía no existe en tu sistema. No hay
formulario que rellenar ni cuenta que crear: el visitante responde a botones,
y al terminar te llega una solicitud lista para presupuestar, con sus datos ya
cargados.

Funciona **sin aprobación de Meta y sin pagar por mensaje**, a diferencia de
la API de WhatsApp Business. Ese es el punto: el enlace es tuyo y lo pones
donde ya te escriben.

---

## Cómo lo usa el cliente

1. Abre tu enlace. El bot le saluda con el nombre de tu negocio.
2. Pulsa **Empezar**.
3. Elige el tipo de servicio de una lista de botones — **son tus categorías**,
   cargadas desde tu negocio según el enlace que usó.
4. Escribe una descripción breve del proyecto.
5. Escribe la dirección de la obra.
6. Escribe su nombre, su teléfono y su correo.
7. Ve un resumen de todo y confirma.

Solo se escribe a mano donde no hay alternativa: descripción, dirección y
datos de contacto. Todo lo demás son botones. Es, literalmente, rellenar un
formulario a base de clics.

---

## Cómo llega a ti

Al confirmar, el sistema crea de una vez:

- un **cliente** en tu CRM, con estado `nuevo`,
- un **presupuesto en borrador** con los datos recogidos,
- una **conversación** con toda la transcripción.

Lo ves en **Presupuestos → Solicitudes y presupuestos**, marcado como listo
para presupuestar, y en **Comunicación → Sistema público**.

No tienes que copiar nada a mano.

---

## Dónde poner tu enlace

Lo encuentras en **Configuración → Automatizaciones**, junto con el texto
sugerido para el Mensaje de Bienvenida.

1. En el **Mensaje de Bienvenida automático de WhatsApp Business** — el
   cliente lo recibe la primera vez que te escribe, sin que tú hagas nada.
2. En la bio de Instagram o Facebook, y en el botón *Contactar* de tu ficha
   de Google.
3. Como **código QR** en vehículos, carteles de obra y tarjetas.

Cambiar tu slug en **Configuración → Datos de la empresa** rompe todos los
enlaces que ya hayas repartido. La pantalla te avisa; hazle caso.

---

## Citas

Si el visitante pide una cita, queda como solicitud pendiente. La confirmas o
la rechazas desde el panel, y al confirmarla se crea el evento en la agenda.

Rutas: `POST /api/public/conversations/:id/appointment-requests`,
`PATCH /api/appointment-requests/:id/confirm` · `/reject`.

---

## Por dentro

El flujo es una **máquina de estados determinista**, no un modelo de lenguaje.
Cada paso sabe qué pregunta hace y qué respuestas acepta, así que no
improvisa, no se desvía y no promete nada que tú no hayas configurado.

```
welcome → select_service → describe_project → address
        → name → phone → email → summary → done
```

| Ruta | Qué hace |
|---|---|
| `GET /api/public/businesses/:slug` | Datos del negocio para la cabecera |
| `POST /api/public/businesses/:slug/leads` | Abre la conversación |
| `GET /api/public/conversations/:id/flow` | Paso actual y sus botones |
| `POST /api/public/conversations/:id/flow/answer` | Responde y avanza |
| `GET /api/public/conversations/:id/messages` | La transcripción |

Los textos del bot están en **`server/flowMessages.ts`**, no en el bundle del
navegador. Cada frase se guarda como un mensaje real en el momento en que se
dice, así que la conversación conserva el idioma en el que se habló. Si
estuvieran en el cliente, cambiar de idioma reescribiría el pasado.

Para cambiar una pregunta, edita `FLOW_COPY` en los cuatro idiomas. Para
añadir un paso, añade el `FlowStepId`, su vista en `flowStepView()`, y la
transición en el manejador de respuestas.
