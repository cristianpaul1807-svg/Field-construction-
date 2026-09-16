# El informe mensual de la CCQ

**Dónde:** menú → Finanzas → Reportes
**Código:** `server/ccq.ts` · `client/src/components/HojaCcq.tsx` · Ruta: `/api/ccq/monthly`

---

## Para qué sirve

En Quebec, un empleador de construcción sujeto a la **loi R-20** tiene que
mandar cada mes a la Commission de la construction du Québec quién trabajó, en
qué oficio, con qué estatuto, en qué sector y en qué región, y cuántas horas.

- Vence el **15 del mes siguiente**.
- Hay que mandarlo **aunque no se haya trabajado**.
- La penalización llega al **20 %**.

Esta pantalla no manda nada a la CCQ. Da la hoja ya sumada y clasificada para
copiarla en su formulario — que es el paso que de verdad cuesta una tarde:
reconstruir de las hojas de fichaje quién hizo cuántas horas y en qué.

---

## Qué enseña

Una línea **por persona y por semana**, no por mes.

La CCQ declara por semana de trabajo, de **domingo a sábado**. Un total
mensual por trabajador no se puede teclear en su formulario, así que sería una
cifra bonita e inútil.

| Columna | De dónde sale |
|---|---|
| Trabajador | El fichaje |
| Semana | El domingo de esa semana |
| Horas / Extra | Suma de los fichajes cerrados |
| Oficio, estatuto, sector, región | El **acuerdo de trabajo** de esa persona |

Las horas extra van **en su propia columna**, no sumadas a las normales: en el
formulario de la CCQ son una casilla distinta.

El mes que se ofrece por defecto es **el anterior**, porque la declaración
vence el 15: quien abre esto en septiembre viene a declarar agosto.

---

## Lo que falta se dice en su casilla

Cuando a alguien le falta el oficio, el estatuto, el sector o la región, esa
casilla pone **«falta»** en vez de quedarse en blanco. Se completa en el
acuerdo de trabajo de esa persona, en su ficha.

Se marca dentro de la tabla y no en un aviso aparte porque lo que hace falta
saber no es *cuántas* líneas están incompletas, es **a quién** hay que
completarle el acuerdo.

---

## Decisiones que importan

**Sólo empleados.** Un subcontratista factura y declara a los suyos él. Meter
sus horas aquí sería declarar dos veces a la misma gente.

**Sólo si el negocio se ha declarado sujeto a la CCQ**, en Configuración →
Datos de la empresa. Para quien no lo sea, la tarjeta no aparece: una pantalla
llena de cosas que no van contigo es cómo se deja de mirar la pantalla.

**Un fichaje sin cerrar no cuenta.** Un check-in sin check-out no son horas
trabajadas, son un trabajador que se olvidó de fichar la salida. Declararlo
como cero es correcto; inventarle una salida, no.

**El mes que no hubo obra sigue saliendo**, con el aviso de que hay que
declarar igualmente. Es justo el mes que se olvida.

---

## El archivo que la CCQ importa

**No se puede generar todavía.** La CCQ acepta que el informe se suba como un
archivo generado por el programa, pero **no publica el formato**: hay que
pedírselo como proveedor, y además lo están cambiando (los proveedores tienen
hasta el invierno de 2026 para adaptarse).

Cuando lo tengamos, se añade aquí y el botón pasa de «descargar la hoja» a
«descargar el archivo». Mientras tanto, el CSV se descarga con punto y coma y
BOM para que Excel en francés lo abra en columnas.

Para pedirlo: **1-877-973-5383**, *spécifications du fichier de rapport mensuel
pour éditeurs de logiciels*.

---

## Por dentro

`server/ccq.ts` tiene el vocabulario y el cálculo; la ruta sólo trae las filas.

| Función | Qué hace |
|---|---|
| `rangoDelMes(mes)` | Del día 1 al 1 del siguiente. Rechaza un mes inventado |
| `domingoDeLaSemana(fecha)` | El domingo al que pertenece un día |
| `horasDe(entrada, salida)` | Horas de un fichaje, al centésimo. Cero si no está cerrado |
| `armarLineas(fichajes, datos)` | Agrupa por persona y semana, separa las extra, marca lo que falta |

**Las listas de oficios y regiones son abiertas a propósito.** Se guarda lo que
el contratista escriba. Los oficios y las regiones de la CCQ cambian con los
convenios, y una lista cerrada que va por detrás impide declarar a alguien en
vez de ayudar — que es la peor forma de fallar en algo con multa. El sector y
el estatuto sí se validan: están en la ley.

Los valores de sector y estatuto se enseñan **en francés en los cuatro
idiomas**. Así se llaman en el formulario de la CCQ, y traducirlos obligaría a
des-traducirlos al teclearlos allí.

---

## Probarlo

```bash
node scripts/prueba-ccq/hoja.mjs
```

16 comprobaciones sobre lo que cuesta una multa: que las semanas se corten
donde las corta la CCQ, que las extra vayan a su casilla, que un fichaje sin
cerrar no cuente, y que a quien le falte el oficio salga señalado.
