# Activar suscripciones, correos y proceso diario

La migración de suscripciones ya está aplicada en el proyecto Supabase `Field-Construtionsn` y la función `subscription-daily` está desplegada. El proceso de borrado automático permanece desactivado.

## 1. Secretos de la función Edge

En Supabase, abre **Project Settings → Edge Functions → Secrets** y añade:

| Nombre | Valor |
|---|---|
| `RESEND_API_KEY` | La clave API de Resend que ya utiliza el servidor |
| `RESEND_FROM` | `no-reply@logiciel-construction.com` o el remitente verificado |
| `SUBSCRIPTION_CRON_SECRET` | Una cadena larga y aleatoria que solo se usará para llamar a esta función |

Supabase proporciona automáticamente `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a la función Edge.

## 2. Activar el programador de Supabase

En **Database → Extensions**, activa la extensión **pg_cron** si todavía aparece disponible para activar. La API de Supabase confirmó que el paquete está disponible, pero el esquema `cron` aún no está creado en el proyecto.

Después, ejecuta en **SQL Editor** el siguiente SQL sustituyendo `TU_SECRETO` por el valor exacto de `SUBSCRIPTION_CRON_SECRET`:

```sql
select cron.schedule(
  'subscription-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://trqdwkknvbfxdljnisya.supabase.co/functions/v1/subscription-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-subscription-cron-secret', 'TU_SECRETO'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

La expresión `0 9 * * *` significa todos los días a las 09:00 UTC. Para comprobarlo:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'subscription-daily';
```

## 3. Webhook de Stripe

En Stripe Live, abre **Developers → Webhooks → Add endpoint** y usa:

```text
https://logiciel-construction.com/api/stripe/webhook
```

Activa estos eventos:

- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copia el signing secret del endpoint al secreto que el servidor usa como `STRIPE_WEBHOOK_SECRET`. No lo pegues en el chat ni en GitHub.

## 4. Verificación

Primero verifica una cuenta nueva en prueba. La función debe responder con `401` si se llama sin el secreto del cron. Con el cron configurado, debe devolver un JSON con `ok: true` y `deletion_mode: "protected_no_delete"`.

No debe eliminar datos todavía. Antes de activar la eliminación definitiva habrá que revisar manualmente el flujo de cancelación, exportación y soporte.
