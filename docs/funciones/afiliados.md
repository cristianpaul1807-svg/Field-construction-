# El programa de afiliados

**Dónde:** `logiciel-construction.com/afiliados` (puerta pública y alta),
`/afiliados/panel` (el panel del afiliado), `/afiliados/condiciones` (el
contrato). Una empresa cliente lo ve en Ajustes → **Gana recomendando**.
**Código:** `server/afiliados.ts` (las reglas), `server/afiliadosStripe.ts`
(Stripe), `client/src/pages/AfiliadosAcceso.tsx`, `AfiliadosPanel.tsx`,
`SettingsAfiliados.tsx`.

---

## Para qué sirve

Que cualquiera que tenga público entre contratistas —un youtuber de
reformas, un contable, un proveedor, un cliente contento— recomiende
Logiciel Construction con su enlace y cobre por ello.

| Regla | Valor | Dónde está |
|---|---|---|
| Comisión | **30 %** de lo que paga la empresa, sin impuestos | `COMISION_DEL_PROGRAMA` |
| Durante | Los **12 primeros meses** de esa empresa, desde su primer pago | `MESES_DE_COMISION` |
| Espera | **30 días** antes de poder retirarla | `DIAS_DE_ESPERA` |
| Mínimo para retirar | **50 $** | `MINIMO_PARA_RETIRAR_CAD` |
| Ventana de atribución | **90 días** desde que abrió el enlace | `client/src/lib/afiliado.ts`, `sitio/sitio.js` |

La página pública lee estas cifras de `/api/public/afiliados/programa`: lo que
se promete y lo que se aplica salen del mismo sitio.

Al cliente que llega por un enlace **no se le regala nada**: tiene la misma
prueba de 30 días que todo el mundo. Es una decisión: el afiliado vende con
su contenido, no con un descuento.

---

## Cómo se apunta alguien

1. Abre `/afiliados`. Ve el 30 %, los 12 meses y los tres pasos.
2. Correo, contraseña, su nombre o el de su canal, **dónde lo va a
   compartir** y su país.
3. **Firma el contrato.** En el mismo formulario está resumido en cinco
   puntos (cuánto, qué cuenta como suyo, la espera, el cobro, lo prohibido),
   con el texto entero a un clic. Firma escribiendo su nombre completo —y
   con el dedo si quiere— y marca la casilla, que no viene marcada. Sin
   firma el botón no se activa y el servidor tampoco la acepta
   (`afiliado_sin_firma`): el enlace se da después de firmar, nunca antes.
4. Le llega el código de 8 cifras —el mismo alta que una empresa—.
5. Al verificarlo ya tiene su enlace, en su panel, con la línea «Contrato
   firmado el … por …» al pie.

Quien **ya tiene cuenta** (una empresa cliente) entra con ella en
`/afiliados` y sólo rellena lo que falta. Su enlace queda a nombre de su
empresa, lo que impide que se refiera a sí misma.

Al apuntarse se guardan `contrato_en` (ahora), `condiciones_version`, y la
prueba de la firma: `firma_nombre`, `firma_imagen` (el trazo, si lo hizo),
`firma_ip` y `firma_agente`. Cambiar el texto de las condiciones es cambiar
`VERSION_DE_LAS_CONDICIONES`: así queda qué firmó cada uno.

## Dónde se anuncia

«Gana dinero recomendándonos» está en todo sitio por donde pasa alguien que
conoce a otros contratistas, siempre al final y nunca tapando lo suyo:

- **El sitio**: una franja encima del pie en las 32 páginas y un enlace en
  la columna «Empezar» del pie, a `/afiliados?lang=xx` para que la puerta
  abra en el idioma de la página.
- **La entrada** (`/`): una puerta más, junto a la del trabajador y la del
  cliente.
- **El panel de la empresa** (al final del inicio, hacia Ajustes), **la app
  del trabajador** y **el portal del cliente**: `AnuncioAfiliados`.
- **Las descripciones de los vídeos** de YouTube, que escribe
  `scripts/videos/grabar.mjs`.

---

## El enlace y la atribución

El enlace es `logiciel-construction.com/?ref=CODIGO`. Esa dirección abre la
**web de presentación**, que es estática: por eso `sitio/sitio.js` guarda el
código, con la misma clave y forma que la aplicación. Antes sólo lo guardaba
la aplicación, y un enlace que caía en la web perdía el código antes del
alta.

Al crear la empresa, `atribuirNegocio` la apunta a ese afiliado:

- Un código que no existe o está cancelado no atribuye.
- Una empresa se atribuye **una sola vez**: el primer enlace se la queda.
- **Nadie se refiere a sí mismo**: ni la empresa dueña del enlace ni la misma
  cuenta de acceso creando una empresa con su propio enlace.

---

## De dónde sale cada comisión

`invoice.payment_succeeded` → `anotarComision`:

- Sobre lo cobrado **sin impuestos**, en **dólares canadienses**: una
  suscripción en euros cuenta por lo que de verdad entró en la plataforma
  tras la conversión de Stripe (`baseDelCobroEnCad`). Si no se puede saber,
  no se apunta y se grita en el registro.
- Pasados los 12 meses desde el primer pago de esa empresa, no se apunta.
- Nace con `disponible_en` = cobro + 30 días.
- `stripe_invoice` es único: un webhook repetido no paga dos veces.

`charge.refunded` y `charge.dispute.created` → `anularComisionDelCobro`: si la
comisión de ese cobro sigue sin pagar, se anula. Si ya se pagó, se apunta en
el registro para resolverlo a mano.

> Esto destapó un fallo que no era de afiliados: el webhook buscaba la
> suscripción de la factura en `invoice.subscription`, un campo que Stripe
> quitó en 2025 (ahora está en `invoice.parent.subscription_details`). Cada
> renovación llegaba y no hacía nada. Lo arregla `suscripcionDeLaFactura`, con
> su prueba en `scripts/prueba-suscripcion/mapeo.mjs`.

**Los dos eventos nuevos hay que pedírselos a Stripe**: después de desplegar,
pulsa de nuevo el botón que configura el webhook (Ajustes → Pagos). Ahora
también añade los eventos que falten a los destinos que ya existían.

---

## Cómo cobra el afiliado

1. En su panel elige el país de su cuenta bancaria y pulsa **Conectar mi
   cuenta de cobro**. Se crea una cuenta de Stripe **sólo para recibir
   transferencias** (configuración `recipient`, panel Express) a su nombre, y
   Stripe le pide identidad y banco. Nosotros no los vemos.
2. Con 50 $ o más disponibles, pulsa **Retirar**.
3. `reservarParaPagar` apunta el pago y le cuelga las comisiones *antes* de
   transferir: dos clics no pagan dos veces. Si Stripe rechaza la
   transferencia, `liberar` las devuelve a disponibles y se le dice.

El dinero sale del saldo de la plataforma en Stripe, en CAD. **Un afiliado de
fuera de Canadá** depende de que Stripe permita transferencias a su país
desde una plataforma canadiense; si no, la creación de su cuenta o la
transferencia fallan con un mensaje claro y su saldo no se toca.

---

## Qué ve y qué no

El afiliado ve su enlace, cuántas empresas trajo (en prueba y pagando), sus
comisiones en espera, disponibles y cobradas, y sus pagos. **No ve los nombres**
de esas empresas: son clientes nuestros. Tampoco ve nada de otros afiliados.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/public/afiliados/programa` | Las cifras del programa |
| `POST /api/afiliados/alta` | Apuntarse (cuenta ya verificada, sin fila aún) |
| `GET /api/afiliados/panel` | Su panel |
| `POST /api/afiliados/cobro/enlace` | Crear/completar su cuenta de cobro en Stripe |
| `POST /api/afiliados/retirar` | Retirar lo disponible |
| `GET /api/settings/afiliados` | Lo esencial, para una empresa que además es afiliada |

Todas las de `/afiliados/` van **por encima** de la puerta del panel, con
`requireAffiliateAuth`, y leen con la clave de servicio filtrando por
`req.afiliadoId`: las tablas `afiliados`, `referidos`, `comisiones` y
`pagos_afiliados` son nuestras y tienen RLS sin políticas.

`/api/auth/me` devuelve `persona: "affiliate"` a quien sólo es afiliado, para
mandarle a su panel y no al alta de una empresa.
