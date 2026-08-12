# Presupuestos y facturas en PDF

**Código:** `server/documents.ts` · Rutas: `/api/estimates/:id/pdf`,
`/api/invoices/:id/pdf` y sus equivalentes en `/api/client-portal/`

---

## Para qué sirve

Son los dos documentos que una empresa de construcción entrega de verdad a su
cliente. Se generan como **PDF real** en el servidor: un archivo que puedes
adjuntar a un correo, guardar para tu contabilidad y entregar firmado. En
Quebec, además, la factura es un documento legal.

Salen en el **idioma en que tengas el panel**, con tu cabecera completa.

---

## Descargarlos

**Presupuesto**
- Presupuestos → **Generar PDF** → vista previa → **Descargar PDF**
- Proyecto → pestaña Presupuesto → **Ver PDF**
- El cliente, desde su portal → **Descargar presupuesto**

**Factura**
- Facturación → **Descargar factura** en cualquier fila

---

## Qué lleva el presupuesto

```
┌─────────────────────────────────────────────────────┐
│ TU EMPRESA                            SOUMISSION    │
│ dirección · teléfono · correo         Nº EST-3F2A…  │
│ Licencia RBQ · Nº TPS · Nº TVQ        Fecha         │
│                                       Válido hasta  │
├─────────────────────────────────────────────────────┤
│ CLIENTE                    PROYECTO                 │
│ nombre, dirección…         nombre de la obra        │
│                                                     │
│ descripción del proyecto                            │
├─────────────────────────────────────────────────────┤
│ Cocina                                              │
│   Demoler armarios          1     1 850 $   1 850 $ │
│   Placas de yeso 4x8       24        46 $   1 116 $ │
│ Baño                                                │
│   Cerámica 12x24           38        35 $   1 320 $ │
├─────────────────────────────────────────────────────┤
│                          Subtotal           9 411 $ │
│                          TPS                  470 $ │
│                          TVQ                  938 $ │
│                          TOTAL             10 820 $ │
├─────────────────────────────────────────────────────┤
│ Forma de pago                                       │
│  · Depósito inicial (50 %)          7 277,65 $      │
│  · Avance de obra (25 %)            3 638,82 $      │
│  · Entrega final (25 %)             3 638,82 $      │
│ Se retiene un 10 % de cada pago parcial…            │
│ tus condiciones                                     │
│                                                     │
│ ____________________      ____________________      │
│ Firma del cliente         Fecha                     │
└─────────────────────────────────────────────────────┘
```

Detalles que importan:

- **Solo salen las líneas que marcaste como visibles.** Tu desglose interno de
  costes no es asunto del cliente.
- **Merma y margen no aparecen como líneas.** Van repartidos dentro de cada
  precio unitario: son tu aritmética, no algo que el cliente deba leer.
- **Válido 30 días.** Un presupuesto sin caducidad es un precio al que te
  quedas atado cuando suban los materiales.
- **Forma de pago completa, no solo el depósito.** Si tienes un
  [plan de pagos](facturacion.md#el-plan-de-pagos), el presupuesto imprime las
  etapas con su porcentaje y su importe sobre el total con impuestos. Firmar es
  aceptar el calendario entero, no el primer cheque, así que ahí está escrito.
  Sin plan, sale la línea de depósito de siempre.
- **Las etapas suman exactamente el total.** Redondear cada una por su cuenta
  deja un céntimo suelto — tres tercios de 100 $ dan 99,99 $ — y el cliente que
  sume la columna antes de firmar lo encuentra. La última etapa se lleva el
  resto en vez de su propio porcentaje redondeado.
- **Retención** se anuncia desde el principio, no en la primera factura.
- **Materiales y programación** son opcionales, por negocio: Configuración →
  Datos de la empresa.
- **Hueco de firma.** Es lo que convierte el documento en un acuerdo.

---

## Qué lleva la factura

La misma cabecera, y además:

- El número, la fecha y el **vencimiento**.
- Si está pagada, **Pagada el …** en verde.
- El desglose de impuestos por líneas separadas (TPS y TVQ, o HST).
- La **retención como línea negativa** antes del total, para que se vea el
  importe facturado, el retenido y el que hay que pagar.

Ver [impuestos-canada.md](impuestos-canada.md).

---

## Qué configurar antes

Todo lo de la cabecera sale de **Configuración → Datos de la empresa**. Si
está vacío, el PDF sale sin ello:

- Dirección, teléfono y correo
- Licencia RBQ
- Números de TPS y TVQ — **obligatorios en una factura de Quebec**
- Porcentaje de depósito y de retención
- Condiciones del presupuesto

---

## Por dentro

Se generan con **pdfkit**, en el servidor. La fuente incorporada (Helvetica)
cubre WinAnsi, que incluye todos los acentos de los cuatro idiomas, así que no
hace falta empaquetar ninguna tipografía.

Los textos están en `COPY` dentro de `server/documents.ts`, con una entrada
por idioma. Para cambiar una palabra del documento, edítala **en los cuatro**.

Decisiones de maquetación que conviene no romper:

- **Columnas de posición fija.** Un nombre de artículo largo se parte dentro de
  su columna en vez de empujar los importes y descuadrar la tabla.
- **Cada fila se mide antes de dibujarse** (`ensureRoom`), para que un salto de
  página no corte una línea por la mitad.
- **El número de página solo aparece si hay más de una.** Un presupuesto de una
  hoja que dice "Página 1" es ruido.
- **`bufferPages`** mantiene las páginas en memoria para poder numerarlas
  cuando ya se sabe cuántas hay.

### Descargar desde el cliente

Un `<a download>` normal no funciona: el token va en una cabecera, y una
navegación por enlace no lleva cabeceras, así que el servidor responde 401.
Usa el ayudante de `client/src/lib/api.ts`:

```tsx
await downloadFile(
  `/api/estimates/${id}/pdf?download=1&lang=${i18n.language.slice(0, 2)}`,
  `Presupuesto-${id.slice(0, 8).toUpperCase()}.pdf`
);
```

`?download=1` fuerza la descarga; sin él, el PDF se abre en el navegador.

### Revisar un cambio en el PDF

Míralo. Un texto que se sale de su caja o un pie que cae fuera de la hoja no
los detecta ningún compilador. Ver
[../desarrollo/solucion-de-problemas.md](../desarrollo/solucion-de-problemas.md#revisar-un-pdf-generado).
