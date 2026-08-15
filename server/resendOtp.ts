import { getSupabaseAdmin } from "./supabaseAdmin";

interface PendingOTP {
  code: string;
  password: string;
  expiresAt: number;
}

async function generateUniqueSlug(admin: any, name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "negocio";

  let slug = base;
  let counter = 1;

  while (true) {
    const { data } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;
    slug = `${base}-${counter++}`;
  }
}

const pendingOTPs = new Map<string, PendingOTP>();

function generate8DigitCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

async function dispatchResendEmail(to: string, code: string): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const subject = `Tu código de verificación: ${code}`;
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
      <h2 style="color:#0f172a;margin-top:0;font-size:20px;font-weight:600;">Field Construction</h2>
      <p style="color:#475569;font-size:14px;line-height:1.5;">Tu código de verificación de 8 dígitos para crear tu cuenta de negocio es:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:6px;color:#2563eb;background:#f8fafc;padding:16px;text-align:center;border-radius:8px;margin:20px 0;border:1px dashed #cbd5e1;">
        ${code}
      </div>
      <p style="color:#64748b;font-size:12px;margin-bottom:0;">Si no has solicitado este código, puedes ignorar este mensaje de forma segura.</p>
    </div>
  `;

  if (!apiKey) {
    console.warn(`[OTP System] ⚠️ RESEND_API_KEY is not set in .env!`);
    console.log(`[OTP System] 🔑 8-digit verification code generated for ${to}: [ ${code} ]`);
  } else {
    try {
      console.log(`[Resend] Sending 8-digit OTP code to ${to} via Resend API...`);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
        }),
      });

      const bodyText = await res.text();
      if (res.ok) {
        console.log(`[Resend] ✅ Email successfully dispatched to ${to} via Resend API:`, bodyText);
        return { sent: true };
      } else {
        console.error(`[Resend] ❌ Resend API returned error ${res.status}:`, bodyText);
      }
    } catch (err) {
      console.error("[Resend] Network error calling Resend API:", err);
    }
  }

  // Fallback to Supabase resetPasswordForEmail
  try {
    const admin = getSupabaseAdmin();
    const { error: resetErr } = await admin.auth.resetPasswordForEmail(to);
    if (!resetErr) {
      console.log(`[Supabase] Sent verification code email to ${to} via Supabase Auth.`);
      return { sent: true };
    } else {
      console.warn(`[Supabase] Could not send via Supabase Auth:`, resetErr.message);
    }
  } catch (err) {
    console.warn("[Supabase] Error with resetPasswordForEmail:", err);
  }

  return { sent: false, reason: apiKey ? "Resend API error" : "RESEND_API_KEY is missing in .env" };
}

export async function sendRegistrationOTP(email: string, password: string): Promise<{ success: boolean; codeSent: boolean; message?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const code = generate8DigitCode();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

  pendingOTPs.set(cleanEmail, { code, password, expiresAt });

  console.log(`=======================================================`);
  console.log(`[OTP REGISTRATION] Email: ${cleanEmail}`);
  console.log(`[OTP REGISTRATION] 🔑 8-DIGIT CODE: ${code}`);
  console.log(`=======================================================`);

  const dispatchResult = await dispatchResendEmail(cleanEmail, code);
  return {
    success: true,
    codeSent: dispatchResult.sent,
    message: dispatchResult.sent ? "Código enviado a tu correo." : "RESEND_API_KEY no configurada en .env. Revisa la consola o añade RESEND_API_KEY a tu archivo .env.",
  };
}

export async function verifyRegistrationOTP(email: string, code: string): Promise<{ success: boolean; businessId?: string; authUserId?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const pending = pendingOTPs.get(cleanEmail);

  let isValid = false;
  let passwordToUse = pending?.password || "DefaultPassword123!";

  if (pending && pending.code === code.trim() && pending.expiresAt > Date.now()) {
    isValid = true;
  } else {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.auth.verifyOtp({ email: cleanEmail, token: code.trim(), type: "recovery" });
      if (!error && data.user) {
        isValid = true;
      }
    } catch {
      // Ignore fallback error
    }
  }

  if (!isValid) {
    throw new Error("Código de verificación incorrecto o expirado.");
  }

  pendingOTPs.delete(cleanEmail);

  const admin = getSupabaseAdmin();

  let userId: string | null = null;
  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: passwordToUse,
    email_confirm: true,
  });

  if (createError) {
    const { data: listData } = await admin.auth.admin.listUsers();
    const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (existingUser) {
      userId = existingUser.id;
      await admin.auth.admin.updateUserById(userId, { password: passwordToUse, email_confirm: true });
    } else {
      throw new Error(createError.message);
    }
  } else if (createdUser.user) {
    userId = createdUser.user.id;
  }

  if (!userId) {
    throw new Error("No se pudo obtener la cuenta de usuario.");
  }

  const { data: existing } = await admin
    .from("users")
    .select("business_id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  let businessId = existing?.business_id;

  if (!businessId) {
    const label = cleanEmail.split("@")[0] || "nuevo";
    const businessName = `Negocio de ${label}`;
    const slug = await generateUniqueSlug(admin, businessName);

    const { data: business, error: businessError } = await admin
      .from("businesses")
      .insert({ name: businessName, slug })
      .select("id")
      .single();
    if (businessError) throw businessError;

    const [, roleResult] = await Promise.all([
      admin.from("business_settings").insert({ business_id: business.id }),
      admin.from("roles").insert({ business_id: business.id, name: "admin" }).select("id").single(),
    ]);
    if (roleResult.error) throw roleResult.error;

    const { error: userError } = await admin.from("users").insert({
      business_id: business.id,
      auth_user_id: userId,
      name: label,
      email: cleanEmail,
      role_id: roleResult.data.id,
    });
    if (userError) throw userError;

    businessId = business.id;
  }

  return { success: true, businessId, authUserId: userId };
}
