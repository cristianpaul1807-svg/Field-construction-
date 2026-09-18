import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const copy = {
  es: { d7: "Tu prueba termina en 7 días", d3: "Tu prueba termina en 3 días", d1: "Tu prueba termina mañana", blocked: "Tu acceso ha sido suspendido", body: (name: string, days: number) => `${name}: tu prueba termina en ${days} días. Entra en logiciel-construction.com y elige tu plan para mantener el acceso.`, blockedBody: (name: string) => `${name}: tu prueba terminó y el acceso operativo está suspendido. Tus datos se conservarán 30 días. Entra en logiciel-construction.com para suscribirte o contacta con soporte.` },
  en: { d7: "Your trial ends in 7 days", d3: "Your trial ends in 3 days", d1: "Your trial ends tomorrow", blocked: "Your access has been suspended", body: (name: string, days: number) => `${name}: your trial ends in ${days} days. Visit logiciel-construction.com and choose a plan to keep access.`, blockedBody: (name: string) => `${name}: your trial has ended and operational access is suspended. Your data will be kept for 30 days. Visit logiciel-construction.com or contact support.` },
  fr: { d7: "Votre essai se termine dans 7 jours", d3: "Votre essai se termine dans 3 jours", d1: "Votre essai se termine demain", blocked: "Votre accès est suspendu", body: (name: string, days: number) => `${name} : votre essai se termine dans ${days} jours. Visitez logiciel-construction.com et choisissez un forfait pour garder l'accès.`, blockedBody: (name: string) => `${name} : votre essai est terminé et l'accès opérationnel est suspendu. Vos données seront conservées 30 jours. Visitez logiciel-construction.com ou contactez le support.` },
  it: { d7: "La prova termina tra 7 giorni", d3: "La prova termina tra 3 giorni", d1: "La prova termina domani", blocked: "Il tuo accesso è stato sospeso", body: (name: string, days: number) => `${name}: la prova termina tra ${days} giorni. Visita logiciel-construction.com e scegli un piano per mantenere l'accesso.`, blockedBody: (name: string) => `${name}: la prova è terminata e l'accesso operativo è sospeso. I tuoi dati saranno conservati per 30 giorni. Visita logiciel-construction.com o contatta il supporto.` },
} as const;

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("SUBSCRIPTION_CRON_SECRET");
  if (!cronSecret || req.headers.get("x-subscription-cron-secret") !== cronSecret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") ?? "no-reply@logiciel-construction.com";
  const db = createClient(url, key);
  const now = new Date();
  const { data: businesses, error } = await db.from("businesses").select("id,name,email,subscription_status,subscription_language,trial_ends_at,subscription_data_retention_until").in("subscription_status", ["trialing", "suspended", "pending_deletion"]).not("email", "is", null).limit(500);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const results: string[] = [];
  for (const business of businesses ?? []) {
    const lang = (business.subscription_language in copy ? business.subscription_language : "es") as keyof typeof copy;
    const t = copy[lang];
    const trialEnd = business.trial_ends_at ? new Date(business.trial_ends_at) : null;
    if (business.subscription_status === "trialing" && trialEnd) {
      const days = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000);
      const keyName = days === 7 ? "trial_7_days" : days === 3 ? "trial_3_days" : days === 1 ? "trial_1_day" : null;
      if (keyName) {
        const { data: already } = await db.from("subscription_notifications").select("id").eq("business_id", business.id).eq("notification_key", keyName).maybeSingle();
        if (!already) {
          const subject = days === 7 ? t.d7 : days === 3 ? t.d3 : t.d1;
          if (resendKey) await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [business.email], subject, text: t.body(business.name, days), html: `<p>${t.body(business.name, days)}</p>` }) });
          await db.from("subscription_notifications").insert({ business_id: business.id, notification_key: keyName, metadata: { days } });
          results.push(`${business.id}:${keyName}`);
        }
      }
      if (trialEnd <= now) {
        const retention = new Date(now.getTime() + 30 * 86400000).toISOString();
        await db.from("businesses").update({ subscription_status: "suspended", subscription_block_reason: "trial_expired", subscription_data_retention_until: retention }).eq("id", business.id);
        const { data: already } = await db.from("subscription_notifications").select("id").eq("business_id", business.id).eq("notification_key", "trial_suspended").maybeSingle();
        if (!already) {
          if (resendKey) await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [business.email], subject: t.blocked, text: t.blockedBody(business.name), html: `<p>${t.blockedBody(business.name)}</p>` }) });
          await db.from("subscription_notifications").insert({ business_id: business.id, notification_key: "trial_suspended" });
        }
        results.push(`${business.id}:suspended`);
      }
    }
  }
  return Response.json({ ok: true, processed: businesses?.length ?? 0, actions: results, deletion_mode: "protected_no_delete" });
});
