# Finanzas: cobros, rentabilidad y contabilidad

**Dónde:** menú → Finanzas → Reportes
**Código:** `server/receivables.ts`, `server/profitability.ts`,
`server/accountingExport.ts` y sus paneles en `client/src/components/`

---

## Cuentas por cobrar

### Para qué sirve

Quién te debe y desde cuándo. La mayoría de las facturas impagadas de una
constructora pequeña **no están en disputa: están olvidadas**, por un cliente
que pensaba pagar y por un contratista sin una lista que mirar.

Los tramos son los de siempre:

| Tramo | Qué es |
|---|---|
| Aún no vence | La fecha de pago todavía no ha llegado |
| 1-30 días | Se pasó, pero es normal |
| 31-60 días | Toca llamar |
| 61-90 días | Toca insistir |
| Más de 90 | En rojo, y con razón |

### Desde cuándo se cuenta

Desde el **vencimiento**, que es el día en que el dinero se retrasó. Una
factura sin fecha de vencimiento se cuenta desde que se emitió: era pagadera a
la recepción, así que ahí empezó el reloj.

Vencer hoy **no** es estar vencido. La comparación ignora la hora del día, o
media empresa amanecería en mora.

### El orden importa

Primero el cliente cuya factura más antigua lleva más tiempo vencida. Está
pensado para quien va a hacer llamadas, no para quien mira un total: esa es la
llamada que más pesa y la que nadie quiere hacer.

### La retención va aparte

No entra en los tramos. Es dinero que se te debe pero que el contrato retiene
hasta cerrar la obra: perseguirlo sería un error, y no enseñarlo te dejaría
creyendo que se te debe menos de lo que se te debe.

---

## Rentabilidad por obra

### Para qué sirve

Cuatro números por obra: **contrato, coste, facturado y cobrado**. Ya existían
todos por separado — el presupuesto, los gastos, las facturas, los pagos — y
nunca en la misma fila, así que responder "¿esta obra da dinero?" pedía abrir
cuatro pantallas y hacer cuentas. Casi nadie las hace, y se entera al final.

### Por qué cuatro y no una nota

Una obra puede ser **rentable y estar sin cobrar**, o **cobrada y perdiendo
dinero**. Una sola nota de salud llamaría igual a las dos, y son dos urgencias
distintas.

Debajo aparecen las dos brechas sobre las que se puede actuar hoy: lo que
queda por facturar y lo que está facturado sin cobrar.

### De dónde sale cada número

| Número | De dónde |
|---|---|
| Contrato | El presupuesto aceptado **más las órdenes de cambio aprobadas** |
| Coste | Gastos de la obra + mano de obra de las horas aprobadas |
| Facturado | Todas las facturas de la obra, pagadas o no |
| Cobrado | Sólo las pagadas |

Si no has configurado tarifas de los trabajadores, la mano de obra sale a cero
**y el panel lo dice**. Un cero callado haría parecer la obra más barata de lo
que es.

Facturar por encima del contrato no da un "queda por facturar" negativo: son
extras acordados, no una deuda al revés.

---

## Dinero en Stripe

### Para qué sirve

Dónde está el dinero **entre que el cliente paga y el banco lo enseña**. La
aplicación sabe lo que se facturó y lo que Stripe dice que se pagó; lo que no
sabía es lo que llegó al banco. Entre las dos cosas están la comisión y el
calendario de depósitos.

Un contratista que lee "cobrado 10.000 $" y ve 9.600 $ en el extracto necesita
poder comprobar que la diferencia es normal sin llamar a nadie.

| Número | Qué es |
|---|---|
| Liquidándose | Cobrado pero todavía no disponible |
| Disponible | Listo para salir hacia el banco |
| Cobrado (90 días) | Lo que pagaron los clientes, antes de comisiones |
| Comisiones | Lo que se llevó Stripe, del libro mayor de tu cuenta |

Debajo, los depósitos que ya han salido y la fecha en que el banco los tiene.

### De dónde salen las cifras

Del **libro mayor de la cuenta conectada**, que es la única fuente honesta de
lo que Stripe cobró: la comisión no está en la factura, y reconstruirla a
partir de las tarifas publicadas se desviaría el día que esas tarifas cambien.

Todo se lee de la cuenta del contratista, que es donde está el dinero. El
saldo de esta plataforma no interviene en nada.

### Si Stripe retiene los depósitos

Sale dicho en la misma tarjeta que el saldo. Dinero parado en Stripe sin
explicación es de las cosas que un negocio descubre en el peor momento.

---

## Exportar para el contable

### Para qué sirve

Cuando lleves el año a tu contable, te va a pedir QuickBooks o Sage. Si le das
PDFs, alguien teclea a precio de hora. **Ese coste es tuyo** y es motivo
suficiente para no cambiarse de software.

Tres ficheros CSV, uno por tipo: **facturas, pagos y gastos**. Uno por tipo
porque un contable mapea las columnas una vez y reutiliza el mapeo cada
trimestre; una hoja mezclándolo todo no se puede mapear.

### Por qué CSV y no el formato de QuickBooks

Todos los programas de contabilidad del mundo importan CSV. Los formatos
nativos son distintos por fabricante, por versión, y se rompen. Esto cubre la
mayor parte de la necesidad con una fracción del trabajo.

### Detalles que importan

- **El TPS y el TVQ van en columnas separadas.** Un contable los necesita por
  separado para declarar; una sola columna de "impuesto" lo devolvería a los
  PDFs, que es justo lo que esto evita.
- **El fichero lleva BOM y saltos CRLF.** Sin eso, Excel abre un UTF-8 como
  Latin-1 y convierte cada nombre acentuado en garabatos — que en Quebec son
  casi todos.
- **Las celdas que empiezan por `=`, `+`, `-` o `@` llevan un tabulador
  delante.** Esos caracteres hacen que una hoja de cálculo trate la celda como
  fórmula: además de estropear el dato, con una descripción preparada a
  propósito es una forma de ejecutar algo en el ordenador del contable.

### Por dentro

| Ruta | Qué hace |
|---|---|
| `GET /api/reports/receivables` | Antigüedad de cobros |
| `GET /api/reports/profitability` | Rentabilidad por obra |
| `GET /api/reports/accounting-export?kind&from&to` | CSV de facturas, pagos o gastos |

La descarga va por `fetch` y no por un enlace normal: la petición necesita la
cabecera de sesión, y un `<a href>` pelado llegaría sin autenticar y devolvería
una página de login con nombre de hoja de cálculo.
