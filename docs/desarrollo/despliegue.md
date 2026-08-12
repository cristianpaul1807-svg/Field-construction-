# Despliegue y variables de entorno

El despliegue lee de la rama `main`. Cuando el trabajo está verificado, se
fusiona ahí y se redespliega.

---

## Variables de entorno

Se configuran en el panel del hosting (EasyPanel), **una por línea**, cada una
en su propio campo.

| Variable | Para qué | Formato |
|---|---|---|
| `SUPABASE_URL` | Proyecto de Supabase | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso administrativo del servidor | empieza por `sb_secret_`, o es un JWT con tres partes separadas por puntos |
| `SUPABASE_ANON_KEY` | Clave que el navegador usa | empieza por `sb_publishable_` |
| `STRIPE_SECRET_KEY` | Cobros | `sk_live_…` o `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Verificar los webhooks de Stripe | `whsec_…` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe en el navegador | `pk_live_…` o `pk_test_…` |

Sobre `SUPABASE_ANON_KEY`: el servidor también acepta
`VITE_SUPABASE_ANON_KEY` y `SUPABASE_PUBLISHABLE_KEY`, porque esa clave ha
viajado con esos tres nombres a lo largo del proyecto. Cualquiera de los tres
vale. Es una clave **pública**: está diseñada para ir dentro del bundle del
navegador, y no da acceso a nada que RLS no permita.

La `SUPABASE_SERVICE_ROLE_KEY`, en cambio, **salta RLS por completo**. Quien
la tenga puede leer y escribir los datos de todos los negocios. No se pega en
un chat, ni en un ticket, ni en una captura.

---

## Por qué la clave del navegador la sirve el servidor

Las variables `VITE_*` se congelan dentro del bundle al compilar. En un
hosting que inyecta variables solo en tiempo de ejecución, eso significa que
quedarían vacías para siempre — y ningún reinicio lo arreglaría, porque el
archivo JavaScript ya está escrito.

Por eso el navegador pide `GET /api/public/config` al arrancar y el servidor
lee sus variables en ese momento. Es la razón de que ahora baste con cambiar
una variable y redesplegar, sin recompilar.

---

## Comprobar un despliegue

```bash
curl -s https://tu-dominio/api/health | python3 -m json.tool
```

Cuando está todo bien:

```json
{
  "ok": true,
  "supabaseReachable": true,
  "problems": []
}
```

Cuando no, `problems` explica en texto llano qué falta, qué efecto tiene, y
qué forma debería tener el valor correcto. Nunca imprime una clave.

---

## Síntomas y causas

**"Error de configuración" al abrir la app**
Falta `SUPABASE_ANON_KEY`. El navegador no pudo obtener su configuración, así
que la app ni siquiera montó. Añádela y redespliega.

**La app carga pero todo devuelve 500**
`SUPABASE_SERVICE_ROLE_KEY` incorrecta o revocada. Mira
`serviceRoleKeyLength`, `serviceRoleKeyLooksLikeJwt` y
`serviceRoleKeyLooksLikeSecret` en `/api/health`: si el largo es raro y
ninguna de las dos formas coincide, se pegó el valor equivocado. Cópiala de
Supabase → Project Settings → API keys.

**`serviceRoleKeyHasWhitespace: true`**
Se pegó con un salto de línea o un espacio. El servidor limpia los espacios al
leerla, pero el aviso indica que el valor guardado está sucio; vale la pena
volver a pegarlo limpio.

**El pago no cambia el estado de la factura**
Falta `STRIPE_WEBHOOK_SECRET`, o el endpoint del webhook en Stripe no apunta a
`https://tu-dominio/api/public/stripe/webhook`. Ver
[../funciones/pagos-stripe.md](../funciones/pagos-stripe.md).

**El proyecto de Supabase no es el que esperabas**
`supabaseProjectRef` en `/api/health` es el subdominio real al que está
hablando el servidor. Compáralo con el que usa el navegador
(`/api/public/config`). Si no coinciden, el frontend y el backend están
mirando a dos bases de datos distintas.

---

## Publicar cambios

```bash
npx tsc --noEmit          # en silencio
npm run build             # sin errores

git add -A
git commit                # mensaje que explique por qué, no qué
git push -u origin <rama>

git checkout main
git merge --ff-only <rama>
git push origin main
git checkout <rama>
```

Después del despliegue, vuelve a mirar `/api/health`. Es de lectura pública y
no revela nada: está pensado justo para abrirlo cuando algo va mal.
