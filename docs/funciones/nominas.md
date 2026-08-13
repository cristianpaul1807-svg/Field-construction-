# Nóminas y coste del equipo

**Dónde:** menú → Finanzas → Nóminas
**Código:** `server/payroll.ts`, `client/src/pages/Payroll.tsx`

---

## Para qué sirve

Los fichajes ya estaban ahí y ya se aprobaban, pero no se convertían en dinero:
podías ver que Luc trabajó 38 horas y seguir sin saber lo que costó la obra.
Esto cierra ese hueco.

**Todo es opcional.** Sin tarifa por hora no aparece nadie, no se calcula nada,
y Control de costos se comporta exactamente como antes. Quien quiera el control
pone tarifas y lo tiene.

**Nunca lo ve el trabajador.** Ni la app de campo ni ninguna ruta `/worker/*`
lee una tarifa ni una hoja de pago. Lo que gana cada uno es entre esa persona y
la oficina.

---

## Poner una tarifa

Equipo → **Técnicos** o **Subcontratistas**, columna *Tarifa por hora*. Se
escribe encima y se guarda al salir del campo.

Dejarlo vacío no es cero: es "no llevamos el control de lo que cuesta esta
persona". Un cero sí sería una tarifa, y valoraría sus horas en nada.

---

## Ver un periodo

Finanzas → **Nóminas** → pestaña *Periodo*. Por defecto la quincena que acaba de
pasar.

Para cada trabajador con horas **aprobadas** en ese rango sale su bruto, lo que
se le retiene, lo que le queda y lo que le cuesta a la empresa.

> Solo cuentan las horas aprobadas. Un fichaje sin aprobar es una afirmación, no
> un coste — y si se pagara sin revisar, el botón de aprobar sería decorativo.

**Emitir hoja** guarda ese cálculo tal cual y lo deja en *Emitidas*, de donde
sale el PDF. Se guarda congelado a propósito: las nóminas se discuten meses
después y "recalcúlalo con las tasas de hoy" es la respuesta equivocada, porque
las tasas cambiaron en enero.

---

## Las retenciones

Pestaña **Retenciones**. Cada línea tiene nombre, quién la paga (el trabajador
o la empresa), la tasa, la exención anual y el tope anual. Se añaden y se quitan
líneas.

Si tu negocio está en Quebec, vienen precargadas con las cifras publicadas para
2026:

| Línea | Quién paga | Tasa | Tope |
|---|---|---|---|
| RRQ | Trabajador | 6,30 % | 4 479,30 $ (exención 3 500 $) |
| RRQ — part de l'employeur | Empresa | 6,30 % | ídem |
| RQAP | Trabajador | 0,430 % | 442,90 $ |
| RQAP — part de l'employeur | Empresa | 0,602 % | 620,06 $ |
| AE (taux Québec) | Trabajador | 1,30 % | 895,70 $ |
| AE — part de l'employeur | Empresa | 1,82 % | 1 253,98 $ |
| Impôt retenu à la source | Trabajador | **la pones tú** | — |
| CNESST | Empresa | **la pones tú** | — |
| FSS | Empresa | **la pones tú** | — |

Las tres últimas salen a 0 a propósito. La retención de impuesto depende del
TP-1015.3-V y del TD1 de cada persona; la CNESST, de tu unidad de clasificación;
el FSS, de tu masa salarial y tu sector. Un número inventado ahí sería un número
equivocado con aspecto de correcto.

**Confírmalas antes de usarlas en serio.** Las tasas se actualizan cada enero.
Fuera de Quebec la lista sale vacía: es mejor que darte las cifras quebequenses
con otro nombre.

---

## Lo que este cálculo no es

- **No es una declaración oficial.** El PDF lo dice en su pie.
- **Prorratea por periodo.** Las exenciones y topes son anuales y aquí se
  reparten según los días del periodo. La nómina de verdad lleva el acumulado
  anual de cada persona y para de retener el día exacto en que se alcanza el
  tope. Para saber lo que cuesta una semana de obra, prorratear vale; para
  emitir un T4, no.
- **No calcula tramos de IRPF.** Ver arriba.
- **No presenta ni paga nada.** Las remesas a Revenu Québec y a la CRA las haces
  tú o tu contable. Stripe no interviene: no tiene producto de nómina, y ni
  siquiera para GST/QST presenta declaraciones en Canadá.

---

## Por dentro

| Ruta | Qué hace |
|---|---|
| `GET/PUT /api/payroll/deductions` | Las líneas de retención |
| `GET /api/payroll/hours?from&to` | Horas aprobadas + cálculo por trabajador |
| `POST /api/payroll/runs` | Congela y guarda una hoja |
| `GET /api/payroll/runs` | Las emitidas |
| `GET /api/payroll/runs/:id/pdf` | El PDF |
| `DELETE /api/payroll/runs/:id` | Borrar una emitida |

Las horas aprobadas también alimentan **mano de obra** en
[Control de costos](control-de-costos.md), que antes solo contaba gastos
tecleados a mano — con la partida más grande de casi toda obra ausente.
