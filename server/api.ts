import express, { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { randomUUID, randomBytes } from "crypto";
import { getSupabaseAdmin, SupabaseNotConfiguredError } from "./supabaseAdmin";
import {
  requireAuthenticatedUser,
  requireBusinessAuth,
  requireClientAuth,
  requireWorkerAuth,
  hashToken,
} from "./supabaseAuth";

export const apiRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const MAX_REFERENCE_DOCS_PER_CATEGORY = 5;

type Handler = (req: Request, res: Response) => Promise<void>;

// Wraps a handler so any thrown error (including a missing service-role key)
// becomes a clean JSON response instead of crashing the dev/prod server.
function route(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch((err) => {
      if (err instanceof SupabaseNotConfiguredError) {
        res.status(503).json({ error: err.message });
        return;
      }
      next(err);
    });
  };
}

// ---------- Auth: registration/provisioning + persona detection ----------
// These run BEFORE requireBusinessAuth is mounted below, since a brand-new
// authenticated user has no users/clients row yet — that's exactly what
// register-business and claim-client create. Fase C intentionally keeps
// registration to email/phone + password only; business name, address,
// license etc. are filled in afterwards in Settings -> Company Data.

// Bootstraps a brand-new Supabase Auth user into a business: creates the
// businesses/business_settings/roles/users rows for them. Service-role is
// the deliberate, narrow exception here — RLS can't self-bootstrap the very
// users row its own current_business_id() policy depends on.
apiRouter.post(
  "/auth/register-business",
  requireAuthenticatedUser,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("users")
      .select("business_id")
      .eq("auth_user_id", req.authUserId!)
      .maybeSingle();
    if (existing) {
      res.json({ businessId: existing.business_id });
      return;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(req.authUserId!);
    const email = authUser.user?.email ?? null;
    const phone = authUser.user?.phone ?? null;
    const label = email ? email.split("@")[0] : phone ?? "nuevo";

    const { data: business, error: businessError } = await admin
      .from("businesses")
      .insert({ name: `Negocio de ${label}` })
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
      auth_user_id: req.authUserId!,
      name: label,
      email,
      phone,
      role_id: roleResult.data.id,
    });
    if (userError) throw userError;

    res.status(201).json({ businessId: business.id });
  })
);

// Links a brand-new Supabase Auth user to an existing clients row (created
// by a business through CRM) by matching email or phone. The client never
// creates new data at signup — their project/estimate already exists,
// they're just claiming access to view it.
apiRouter.post(
  "/auth/claim-client",
  requireAuthenticatedUser,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();

    const { data: existing } = await admin
      .from("clients")
      .select("id")
      .eq("auth_user_id", req.authUserId!)
      .maybeSingle();
    if (existing) {
      res.json({ clientId: existing.id });
      return;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(req.authUserId!);
    const email = authUser.user?.email ?? null;
    const phone = authUser.user?.phone ?? null;
    if (!email && !phone) {
      res.status(400).json({ error: "No email or phone on this account" });
      return;
    }

    let query = admin.from("clients").select("id").is("auth_user_id", null);
    query = email && phone ? query.or(`email.eq.${email},phone.eq.${phone}`) : query.eq(email ? "email" : "phone", email ?? phone!);
    const { data: matches, error: matchError } = await query.order("created_at", { ascending: true }).limit(1);
    if (matchError) throw matchError;

    if (!matches || matches.length === 0) {
      res.status(404).json({
        error: "No encontramos ningún cliente con ese correo o teléfono. Pídele a tu contratista que te dé de alta primero.",
      });
      return;
    }

    const { error: updateError } = await admin
      .from("clients")
      .update({ auth_user_id: req.authUserId! })
      .eq("id", matches[0].id);
    if (updateError) throw updateError;

    res.status(201).json({ clientId: matches[0].id });
  })
);

// Called right after any login to decide where to redirect: business panel,
// client portal, or "finish setting up your account".
apiRouter.get(
  "/auth/me",
  requireAuthenticatedUser,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const [userRow, clientRow] = await Promise.all([
      admin.from("users").select("business_id").eq("auth_user_id", req.authUserId!).maybeSingle(),
      admin.from("clients").select("id").eq("auth_user_id", req.authUserId!).maybeSingle(),
    ]);

    if (userRow.data) {
      res.json({ persona: "business", businessId: userRow.data.business_id });
    } else if (clientRow.data) {
      res.json({ persona: "client", clientId: clientRow.data.id });
    } else {
      res.json({ persona: "none" });
    }
  })
);

// ---------- Worker PWA access (token-based, no Supabase Auth at all) ----------

apiRouter.post(
  "/worker-auth/login",
  route(async (req, res) => {
    const token = (req.body?.token ?? "").trim();
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }
    const hash = hashToken(token);
    const admin = getSupabaseAdmin();

    const [employee, subcontractor] = await Promise.all([
      admin.from("employees").select("id, name, business_id").eq("access_token_hash", hash).maybeSingle(),
      admin.from("subcontractors").select("id, name, business_id").eq("access_token_hash", hash).maybeSingle(),
    ]);

    const worker = employee.data ?? subcontractor.data;
    if (!worker) {
      res.status(401).json({ error: "Código inválido" });
      return;
    }

    res.json({
      id: worker.id,
      name: worker.name,
      businessId: worker.business_id,
      kind: employee.data ? "employee" : "subcontractor",
    });
  })
);

// Everything below is scoped to the calling worker (employee or
// subcontractor) via requireWorkerAuth, which resolves req.workerId /
// req.workerKind / req.workerBusinessId from the raw token — there's no
// auth.uid() in this flow, so every query filters manually instead of
// relying on RLS.
function workerColumn(req: Request): "assigned_employee_id" | "assigned_subcontractor_id" {
  return req.workerKind === "employee" ? "assigned_employee_id" : "assigned_subcontractor_id";
}

apiRouter.get(
  "/worker/schedule",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const column = workerColumn(req);

    const [events, workOrders] = await Promise.all([
      admin
        .from("schedule_events")
        .select("id, title, type, start_time, end_time, notes, project_id, projects(name)")
        .eq("business_id", req.workerBusinessId!)
        .eq(column, req.workerId!)
        .order("start_time"),
      admin
        .from("work_orders")
        .select("id, title, description, priority, status, project_id, projects(name)")
        .eq("business_id", req.workerBusinessId!)
        .eq(column, req.workerId!)
        .neq("status", "completada"),
    ]);

    if (events.error) throw events.error;
    if (workOrders.error) throw workOrders.error;

    res.json({
      events: events.data.map((e: any) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        startTime: e.start_time,
        endTime: e.end_time,
        notes: e.notes,
        projectId: e.project_id,
        projectName: e.projects?.name ?? null,
      })),
      workOrders: workOrders.data.map((w: any) => ({
        id: w.id,
        title: w.title,
        description: w.description,
        priority: w.priority,
        status: w.status,
        projectId: w.project_id,
        projectName: w.projects?.name ?? null,
      })),
    });
  })
);

apiRouter.get(
  "/worker/projects",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";

    const { data, error } = await admin
      .from("assignments")
      .select("projects(id, name)")
      .eq("business_id", req.workerBusinessId!)
      .eq(column, req.workerId!);
    if (error) throw error;

    const seen = new Set<string>();
    const projects = [];
    for (const row of data as any[]) {
      if (row.projects && !seen.has(row.projects.id)) {
        seen.add(row.projects.id);
        projects.push({ id: row.projects.id, name: row.projects.name });
      }
    }
    res.json(projects);
  })
);

apiRouter.get(
  "/worker/time-entries/active",
  requireWorkerAuth,
  route(async (req, res) => {
    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";

    const { data, error } = await admin
      .from("time_entries")
      .select("id, project_id, projects(name), check_in_time, billable, service_type")
      .eq("business_id", req.workerBusinessId!)
      .eq(column, req.workerId!)
      .is("check_out_time", null)
      .order("check_in_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    res.json(
      data
        ? {
            id: data.id,
            projectId: data.project_id,
            projectName: (data as any).projects?.name ?? null,
            checkInTime: data.check_in_time,
            billable: data.billable,
            serviceType: data.service_type,
          }
        : null
    );
  })
);

apiRouter.post(
  "/worker/time-entries/check-in",
  requireWorkerAuth,
  route(async (req, res) => {
    const { projectId, billable, serviceType, latitude, longitude } = req.body ?? {};
    if (!projectId || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "projectId, latitude and longitude are required" });
      return;
    }

    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";

    const { data, error } = await admin
      .from("time_entries")
      .insert({
        business_id: req.workerBusinessId!,
        project_id: projectId,
        [column]: req.workerId!,
        billable: billable ?? true,
        service_type: serviceType ?? null,
        check_in_location: `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`,
        check_in_lat: latitude,
        check_in_lng: longitude,
      })
      .select("id, check_in_time")
      .single();
    if (error) throw error;

    res.status(201).json({ id: data.id, checkInTime: data.check_in_time });
  })
);

apiRouter.post(
  "/worker/time-entries/:id/check-out",
  requireWorkerAuth,
  route(async (req, res) => {
    const { latitude, longitude } = req.body ?? {};
    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "latitude and longitude are required" });
      return;
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("time_entries")
      .update({
        check_out_time: new Date().toISOString(),
        check_out_location: `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`,
        check_out_lat: latitude,
        check_out_lng: longitude,
      })
      .eq("business_id", req.workerBusinessId!)
      .eq("id", req.params.id);
    if (error) throw error;

    res.json({ ok: true });
  })
);

// Closes the active entry and opens a new one against a different project
// in a single action, so the worker doesn't have to check out then in again.
apiRouter.post(
  "/worker/time-entries/switch-project",
  requireWorkerAuth,
  route(async (req, res) => {
    const { activeEntryId, projectId, billable, serviceType, latitude, longitude } = req.body ?? {};
    if (!activeEntryId || !projectId || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "activeEntryId, projectId, latitude and longitude are required" });
      return;
    }

    const admin = getSupabaseAdmin();
    const column = req.workerKind === "employee" ? "employee_id" : "subcontractor_id";
    const locationStr = `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;

    const { error: closeError } = await admin
      .from("time_entries")
      .update({
        check_out_time: new Date().toISOString(),
        check_out_location: locationStr,
        check_out_lat: latitude,
        check_out_lng: longitude,
      })
      .eq("business_id", req.workerBusinessId!)
      .eq("id", activeEntryId);
    if (closeError) throw closeError;

    const { data, error: openError } = await admin
      .from("time_entries")
      .insert({
        business_id: req.workerBusinessId!,
        project_id: projectId,
        [column]: req.workerId!,
        billable: billable ?? true,
        service_type: serviceType ?? null,
        check_in_location: locationStr,
        check_in_lat: latitude,
        check_in_lng: longitude,
      })
      .select("id, check_in_time")
      .single();
    if (openError) throw openError;

    res.status(201).json({ id: data.id, checkInTime: data.check_in_time });
  })
);

// ---------- Client Portal (self-service, client-authenticated) ----------

apiRouter.get(
  "/client-portal/me",
  requireClientAuth,
  route(async (req, res) => {
    const supabase = req.supabase!;
    const clientId = req.clientId!;

    const [client, project, estimate] = await Promise.all([
      supabase.from("clients").select("id, name").eq("id", clientId).single(),
      supabase
        .from("projects")
        .select("id, name, progress_percent")
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("estimates")
        .select("id, status, total")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (client.error) throw client.error;
    if (project.error) throw project.error;
    if (estimate.error) throw estimate.error;

    let visiblePhotos: { id: string }[] = [];
    if (project.data) {
      const { data, error } = await supabase
        .from("photos")
        .select("id")
        .eq("project_id", project.data.id)
        .eq("visible_to_client", true);
      if (error) throw error;
      visiblePhotos = data;
    }

    res.json({
      client: { id: client.data.id, name: client.data.name },
      project: project.data
        ? { id: project.data.id, name: project.data.name, progressPercent: Number(project.data.progress_percent) }
        : null,
      estimate: estimate.data
        ? { id: estimate.data.id, status: estimate.data.status, total: Number(estimate.data.total) }
        : null,
      visiblePhotos,
    });
  })
);

// Everything below this line is the business panel — every route resolves
// its business_id from the caller's own Supabase Auth session (never a
// hardcoded constant), and every query below runs through req.supabase,
// a client carrying that same session, so Postgres RLS is what actually
// enforces one business never sees another's rows.
apiRouter.use(requireBusinessAuth);

// ---------- Materials & Costs ----------
// Materials, labor rates and subcontractor trades live in three separate
// tables (per the Fase B schema) but the screen displays them as one
// combined catalog grouped by category, matching the Fase A mock UI.
apiRouter.get(
  "/materials",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [materials, laborRates, subcontractors] = await Promise.all([
      supabase
        .from("materials_catalog")
        .select("id, name, unit, price, category, supplier, is_reference_only")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("labor_rates")
        .select("id, name, hourly_rate")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("subcontractors")
        .select("id, name, trade, phone, rating, telegram_chat_id")
        .eq("business_id", req.businessId!)
        .order("name"),
    ]);

    if (materials.error) throw materials.error;
    if (laborRates.error) throw laborRates.error;
    if (subcontractors.error) throw subcontractors.error;

    res.json({
      materials: materials.data.map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        price: m.price,
        category: m.category,
        supplier: m.supplier,
        isReferenceOnly: m.is_reference_only,
      })),
      laborRates: laborRates.data.map((l) => ({
        id: l.id,
        name: l.name,
        hourlyRate: l.hourly_rate,
      })),
      subcontractors: subcontractors.data.map((s) => ({
        id: s.id,
        name: s.name,
        trade: s.trade,
        phone: s.phone,
        rating: s.rating,
        telegramLinked: Boolean(s.telegram_chat_id),
      })),
    });
  })
);

// ---------- Budgets & Estimates ----------

apiRouter.get(
  "/estimates",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("estimates")
      .select(
        "id, client_id, project_id, status, created_by, category_id, total, created_at, clients(name), budget_categories(name)"
      )
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((e: any) => ({
        id: e.id,
        clientId: e.client_id,
        clientName: e.clients?.name ?? null,
        projectId: e.project_id,
        status: e.status,
        createdBy: e.created_by,
        categoryId: e.category_id,
        categoryName: e.budget_categories?.name ?? null,
        total: Number(e.total),
        createdAt: e.created_at,
      }))
    );
  })
);

apiRouter.get(
  "/estimates/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [estimate, lines] = await Promise.all([
      supabase
        .from("estimates")
        .select(
          "id, client_id, project_id, status, created_by, category_id, margin_type, margin_percent, waste_percent, total, created_at, clients(name, address), budget_categories(name)"
        )
        .eq("business_id", req.businessId!)
        .eq("id", req.params.id)
        .single(),
      supabase
        .from("estimate_lines")
        .select("id, zone, category, item_name, quantity, unit_cost, total, visible_to_client")
        .eq("business_id", req.businessId!)
        .eq("estimate_id", req.params.id)
        .order("zone"),
    ]);

    if (estimate.error) throw estimate.error;
    if (lines.error) throw lines.error;

    const client = estimate.data.clients as unknown as { name: string; address: string } | null;

    res.json({
      id: estimate.data.id,
      clientId: estimate.data.client_id,
      clientName: client?.name ?? null,
      clientAddress: client?.address ?? null,
      projectId: estimate.data.project_id,
      status: estimate.data.status,
      createdBy: estimate.data.created_by,
      categoryId: estimate.data.category_id,
      categoryName: (estimate.data.budget_categories as any)?.name ?? null,
      marginType: estimate.data.margin_type,
      marginPercent: Number(estimate.data.margin_percent),
      wastePercent: Number(estimate.data.waste_percent),
      total: Number(estimate.data.total),
      createdAt: estimate.data.created_at,
      lines: lines.data.map((l) => ({
        id: l.id,
        zone: l.zone,
        category: l.category,
        item: l.item_name,
        quantity: Number(l.quantity),
        unitCost: Number(l.unit_cost),
        total: Number(l.total),
        visibleToClient: l.visible_to_client,
      })),
    });
  })
);

// Recomputes and persists estimates.total from its current lines + margin/waste,
// mirroring the client-side preview formula exactly. Called after every line
// mutation and every margin/waste save so the stored total never goes stale.
async function recalcEstimateTotal(supabase: ReturnType<typeof getSupabaseAdmin>, estimateId: string) {
  const [estimate, lines] = await Promise.all([
    supabase.from("estimates").select("margin_percent, waste_percent").eq("id", estimateId).single(),
    supabase.from("estimate_lines").select("total").eq("estimate_id", estimateId),
  ]);
  if (estimate.error) throw estimate.error;
  if (lines.error) throw lines.error;

  const subtotal = lines.data.reduce((sum, l) => sum + Number(l.total), 0);
  const wasteAmount = subtotal * (Number(estimate.data.waste_percent) / 100);
  const marginAmount = (subtotal + wasteAmount) * (Number(estimate.data.margin_percent) / 100);
  const total = subtotal + wasteAmount + marginAmount;

  const { error } = await supabase.from("estimates").update({ total }).eq("id", estimateId);
  if (error) throw error;
}

// Creates a brand-new empty estimate (not one of the seeded ones) so
// "New Budget" has something real to open the builder on.
apiRouter.post(
  "/estimates",
  route(async (req, res) => {
    const clientId = req.body?.clientId;
    if (!clientId) {
      res.status(400).json({ error: "clientId is required" });
      return;
    }

    const supabase = req.supabase!;
    const { data: settings } = await supabase
      .from("business_settings")
      .select("default_margin_type, default_waste_percent")
      .eq("business_id", req.businessId!)
      .single();

    const { data, error } = await supabase
      .from("estimates")
      .insert({
        business_id: req.businessId!,
        client_id: clientId,
        project_id: req.body?.projectId ?? null,
        category_id: req.body?.categoryId ?? null,
        margin_type: settings?.default_margin_type ?? "global",
        waste_percent: settings?.default_waste_percent ?? 0,
        margin_percent: 0,
        status: "borrador",
        created_by: "human",
      })
      .select("id")
      .single();

    if (error) throw error;
    res.json({ id: data.id });
  })
);

// Persists the margin/waste settings the admin edited locally in the
// builder (line and visibility edits already save immediately below).
apiRouter.patch(
  "/estimates/:id",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.marginType !== undefined) update.margin_type = body.marginType;
    if (body.marginPercent !== undefined) update.margin_percent = body.marginPercent;
    if (body.wastePercent !== undefined) update.waste_percent = body.wastePercent;

    const supabase = req.supabase!;
    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from("estimates")
        .update(update)
        .eq("business_id", req.businessId!)
        .eq("id", req.params.id);
      if (error) throw error;
    }

    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ ok: true });
  })
);

apiRouter.post(
  "/estimates/:id/lines",
  route(async (req, res) => {
    const body = req.body ?? {};
    if (!body.zone || !body.category || !body.itemName) {
      res.status(400).json({ error: "zone, category and itemName are required" });
      return;
    }

    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("estimate_lines")
      .insert({
        business_id: req.businessId!,
        estimate_id: req.params.id,
        zone: body.zone,
        category: body.category,
        item_name: body.itemName,
        quantity: body.quantity ?? 1,
        unit_cost: body.unitCost ?? 0,
        visible_to_client: body.visibleToClient ?? false,
      })
      .select("id")
      .single();

    if (error) throw error;
    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ id: data.id });
  })
);

apiRouter.patch(
  "/estimates/:id/lines/:lineId",
  route(async (req, res) => {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.zone !== undefined) update.zone = body.zone;
    if (body.category !== undefined) update.category = body.category;
    if (body.itemName !== undefined) update.item_name = body.itemName;
    if (body.quantity !== undefined) update.quantity = body.quantity;
    if (body.unitCost !== undefined) update.unit_cost = body.unitCost;
    if (body.visibleToClient !== undefined) update.visible_to_client = body.visibleToClient;

    const supabase = req.supabase!;
    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from("estimate_lines")
        .update(update)
        .eq("business_id", req.businessId!)
        .eq("id", req.params.lineId);
      if (error) throw error;
    }

    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ ok: true });
  })
);

apiRouter.delete(
  "/estimates/:id/lines/:lineId",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("estimate_lines")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.lineId);
    if (error) throw error;

    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ ok: true });
  })
);

// Bulk-inserts an Assembly Template's items as real lines under the given
// zone. Subcontractor items have no catalog cost (schema has none), so
// unit_cost lands on 0 and the admin adjusts it inline afterward.
apiRouter.post(
  "/estimates/:id/lines/from-template",
  route(async (req, res) => {
    const { templateId, zone } = req.body ?? {};
    if (!templateId || !zone) {
      res.status(400).json({ error: "templateId and zone are required" });
      return;
    }

    const supabase = req.supabase!;
    const { data: items, error: itemsError } = await supabase
      .from("assembly_items")
      .select(
        "quantity_default, materials_catalog(name, price), labor_rates(name, hourly_rate), subcontractors(name)"
      )
      .eq("business_id", req.businessId!)
      .eq("assembly_template_id", templateId);

    if (itemsError) throw itemsError;
    if (items.length === 0) {
      res.json({ inserted: 0 });
      return;
    }

    const rows = items.map((i: any) => {
      if (i.materials_catalog) {
        return {
          business_id: req.businessId!,
          estimate_id: req.params.id,
          zone,
          category: "Materiales",
          item_name: i.materials_catalog.name,
          quantity: Number(i.quantity_default),
          unit_cost: Number(i.materials_catalog.price ?? 0),
        };
      }
      if (i.labor_rates) {
        return {
          business_id: req.businessId!,
          estimate_id: req.params.id,
          zone,
          category: "Mano de obra",
          item_name: i.labor_rates.name,
          quantity: Number(i.quantity_default),
          unit_cost: Number(i.labor_rates.hourly_rate ?? 0),
        };
      }
      return {
        business_id: req.businessId!,
        estimate_id: req.params.id,
        zone,
        category: "Subcontratistas",
        item_name: i.subcontractors?.name ?? "Subcontratista",
        quantity: Number(i.quantity_default),
        unit_cost: 0,
      };
    });

    const { error: insertError } = await supabase.from("estimate_lines").insert(rows);
    if (insertError) throw insertError;

    await recalcEstimateTotal(supabase, req.params.id);
    res.json({ inserted: rows.length });
  })
);

// Admin approves (or rejects) a bot-drafted estimate before it reaches
// the client — moves 'pendiente_aprobacion' -> 'enviado' (or 'rechazado').
// Kept generic (not restricted to that one transition) since the admin
// can also manually move a draft forward without ever involving the bot.
apiRouter.patch(
  "/estimates/:id/status",
  route(async (req, res) => {
    const allowed = ["borrador", "pendiente_aprobacion", "enviado", "aceptado", "rechazado"];
    const status = req.body?.status;
    if (!allowed.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
      return;
    }

    const supabase = req.supabase!;
    const { error } = await supabase
      .from("estimates")
      .update({ status })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// Tags an estimate with a business-defined category (cocina, reforma...) so
// the future estimate-drafting AI can study same-category history for
// margins/structure. Every manually-created estimate should set this on save.
apiRouter.patch(
  "/estimates/:id/category",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("estimates")
      .update({ category_id: req.body?.categoryId ?? null })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Estimate work projection ----------
// Staged plan ("who works when, for how long") for an estimate that
// isn't a real project yet. Accepting the estimate (below) turns every
// pending item into a real schedule_events row.

apiRouter.get(
  "/estimates/:id/projection",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("estimate_projection_items")
      .select(
        "id, title, zone, planned_start, duration_minutes, notes, status, employees:assigned_employee_id(id, name), subcontractors:assigned_subcontractor_id(id, name)"
      )
      .eq("business_id", req.businessId!)
      .eq("estimate_id", req.params.id)
      .order("planned_start");

    if (error) throw error;

    res.json(
      data.map((i: any) => ({
        id: i.id,
        title: i.title,
        zone: i.zone,
        plannedStart: i.planned_start,
        durationMinutes: i.duration_minutes,
        notes: i.notes,
        status: i.status,
        assignedWorkerId: i.employees?.id ?? i.subcontractors?.id ?? null,
        assignedWorkerName: i.employees?.name ?? i.subcontractors?.name ?? null,
      }))
    );
  })
);

apiRouter.post(
  "/estimates/:id/projection",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const body = req.body ?? {};

    if (!body.title || !body.plannedStart) {
      res.status(400).json({ error: "title and plannedStart are required" });
      return;
    }
    if (body.assignedEmployeeId && body.assignedSubcontractorId) {
      res.status(400).json({ error: "Assign to only one worker, not both" });
      return;
    }

    const { data, error } = await supabase
      .from("estimate_projection_items")
      .insert({
        business_id: req.businessId!,
        estimate_id: req.params.id,
        title: body.title,
        zone: body.zone ?? null,
        planned_start: body.plannedStart,
        duration_minutes: body.durationMinutes ?? 60,
        notes: body.notes ?? null,
        assigned_employee_id: body.assignedEmployeeId ?? null,
        assigned_subcontractor_id: body.assignedSubcontractorId ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

apiRouter.delete(
  "/estimates/:id/projection/:itemId",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("estimate_projection_items")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("estimate_id", req.params.id)
      .eq("id", req.params.itemId);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// Accept an estimate: creates its project (if it doesn't have one yet)
// and materializes every pending projection item into a real,
// worker-anchored schedule_events row — this is the automatic
// "presupuesto aceptado -> calendario poblado" step the future AI
// integration (and the admin, manually, today) relies on.
apiRouter.post(
  "/estimates/:id/accept",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const estimateId = req.params.id;

    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, client_id, project_id, status")
      .eq("business_id", req.businessId!)
      .eq("id", estimateId)
      .single();
    if (estimateError) throw estimateError;

    let projectId = estimate.project_id as string | null;
    if (!projectId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          business_id: req.businessId!,
          client_id: estimate.client_id,
          estimate_id: estimateId,
          name: req.body?.projectName || "Nuevo proyecto",
          type: req.body?.projectType ?? null,
          status: "planificacion",
        })
        .select("id")
        .single();
      if (projectError) throw projectError;
      projectId = project.id;

      const { error: linkError } = await supabase
        .from("estimates")
        .update({ project_id: projectId })
        .eq("id", estimateId);
      if (linkError) throw linkError;
    }

    const { error: statusError } = await supabase
      .from("estimates")
      .update({ status: "aceptado" })
      .eq("id", estimateId);
    if (statusError) throw statusError;

    const { data: pendingItems, error: itemsError } = await supabase
      .from("estimate_projection_items")
      .select("id, title, zone, assigned_employee_id, assigned_subcontractor_id, planned_start, duration_minutes, notes")
      .eq("business_id", req.businessId!)
      .eq("estimate_id", estimateId)
      .eq("status", "pendiente");
    if (itemsError) throw itemsError;

    for (const item of pendingItems) {
      const start = new Date(item.planned_start);
      const end = new Date(start.getTime() + item.duration_minutes * 60000);
      const { error: insertError } = await supabase.from("schedule_events").insert({
        business_id: req.businessId!,
        project_id: projectId,
        estimate_id: estimateId,
        title: item.zone ? `${item.title} (${item.zone})` : item.title,
        type: "inicio",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes: item.notes,
        assigned_employee_id: item.assigned_employee_id,
        assigned_subcontractor_id: item.assigned_subcontractor_id,
        source: "proyeccion",
      });
      if (insertError) throw insertError;
    }

    if (pendingItems.length > 0) {
      const { error: markAppliedError } = await supabase
        .from("estimate_projection_items")
        .update({ status: "aplicado" })
        .eq("estimate_id", estimateId)
        .eq("status", "pendiente");
      if (markAppliedError) throw markAppliedError;
    }

    res.json({ projectId, scheduledCount: pendingItems.length });
  })
);

// ---------- Budget categories & reference documents ----------
// Admin-defined categories (cocina, reforma, construcción...) used to tag
// estimates, plus up to MAX_REFERENCE_DOCS_PER_CATEGORY old approved-budget
// files per category the admin can upload as grounding material for
// categories with no real in-system history yet. No AI reads these yet —
// this only stores real data + real files so Fase D has something to study.

apiRouter.get(
  "/budget-categories",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("budget_categories")
      .select("id, name, created_at")
      .eq("business_id", req.businessId!)
      .order("name");

    if (error) throw error;
    res.json(data.map((c) => ({ id: c.id, name: c.name, createdAt: c.created_at })));
  })
);

apiRouter.post(
  "/budget-categories",
  route(async (req, res) => {
    const name = (req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("budget_categories")
      .insert({ business_id: req.businessId!, name })
      .select("id, name, created_at")
      .single();

    if (error) throw error;
    res.json({ id: data.id, name: data.name, createdAt: data.created_at });
  })
);

apiRouter.delete(
  "/budget-categories/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("budget_categories")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.get(
  "/estimate-reference-documents",
  route(async (req, res) => {
    const supabase = req.supabase!;
    let query = supabase
      .from("estimate_reference_documents")
      .select("id, category_id, file_name, storage_path, file_size, uploaded_at, budget_categories(name)")
      .eq("business_id", req.businessId!)
      .order("uploaded_at", { ascending: false });

    if (req.query.categoryId) {
      query = query.eq("category_id", req.query.categoryId as string);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(
      data.map((d: any) => ({
        id: d.id,
        categoryId: d.category_id,
        categoryName: d.budget_categories?.name ?? null,
        fileName: d.file_name,
        fileSize: d.file_size,
        uploadedAt: d.uploaded_at,
      }))
    );
  })
);

apiRouter.post(
  "/estimate-reference-documents",
  upload.single("file"),
  route(async (req, res) => {
    const categoryId = req.body?.categoryId;
    const file = req.file;
    if (!categoryId || !file) {
      res.status(400).json({ error: "categoryId and file are required" });
      return;
    }

    const supabase = req.supabase!;

    const { count, error: countError } = await supabase
      .from("estimate_reference_documents")
      .select("id", { count: "exact", head: true })
      .eq("business_id", req.businessId!)
      .eq("category_id", categoryId);

    if (countError) throw countError;
    if ((count ?? 0) >= MAX_REFERENCE_DOCS_PER_CATEGORY) {
      res.status(400).json({
        error: `Esta categoría ya tiene ${MAX_REFERENCE_DOCS_PER_CATEGORY} presupuestos de referencia. Elimina uno antes de subir otro.`,
      });
      return;
    }

    const storagePath = `${req.businessId}/${categoryId}/${randomUUID()}-${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from("estimate-references")
      .upload(storagePath, file.buffer, { contentType: file.mimetype });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("estimate_reference_documents")
      .insert({
        business_id: req.businessId!,
        category_id: categoryId,
        file_name: file.originalname,
        storage_path: storagePath,
        file_size: file.size,
      })
      .select("id")
      .single();

    if (error) throw error;
    res.json({ id: data.id });
  })
);

apiRouter.delete(
  "/estimate-reference-documents/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const { data: doc, error: fetchError } = await supabase
      .from("estimate_reference_documents")
      .select("storage_path")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw fetchError;

    const { error: deleteError } = await supabase
      .from("estimate_reference_documents")
      .delete()
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (deleteError) throw deleteError;

    if (doc?.storage_path) {
      await supabase.storage.from("estimate-references").remove([doc.storage_path]);
    }

    res.json({ ok: true });
  })
);

// ---------- Admin AI assistant (internal chat, separate from the
// client-facing WhatsApp bot) ----------
// No model is called here yet — this only stores the thread so the UI
// and data flow are ready the moment Fase D wires in the real Claude
// API call. The canned reply below is a clearly-labeled placeholder.

apiRouter.get(
  "/admin-assistant/messages",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("admin_assistant_messages")
      .select("id, role, content, actions_taken, created_at")
      .eq("business_id", req.businessId!)
      .order("created_at");

    if (error) throw error;

    res.json(
      data.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        actionsTaken: m.actions_taken,
        createdAt: m.created_at,
      }))
    );
  })
);

apiRouter.post(
  "/admin-assistant/messages",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const content = req.body?.content?.trim();
    if (!content) {
      res.status(400).json({ error: "content is required" });
      return;
    }

    const { error: insertUserError } = await supabase.from("admin_assistant_messages").insert({
      business_id: req.businessId!,
      role: "admin",
      content,
    });
    if (insertUserError) throw insertUserError;

    const { data: reply, error: replyError } = await supabase
      .from("admin_assistant_messages")
      .insert({
        business_id: req.businessId!,
        role: "assistant",
        content:
          "Todavía no estoy conectada a un modelo de IA real (eso es Fase D — hace falta configurar la Claude API key). " +
          "Por ahora solo guardo esta conversación para que, en cuanto se conecte, pueda leer todo el historial y actuar " +
          "sobre presupuestos, proyecciones y el calendario de cada proyecto.",
      })
      .select("id, role, content, actions_taken, created_at")
      .single();
    if (replyError) throw replyError;

    res.status(201).json({
      id: reply.id,
      role: reply.role,
      content: reply.content,
      actionsTaken: reply.actions_taken,
      createdAt: reply.created_at,
    });
  })
);

// ---------- Assembly Templates ----------
// itemCount / laborHours are derived here (not stored) so the templates
// list always reflects the current composition of each recipe.
apiRouter.get(
  "/assembly-templates",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [templates, items] = await Promise.all([
      supabase
        .from("assembly_templates")
        .select("id, name, description")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("assembly_items")
        .select("assembly_template_id, labor_rate_id, quantity_default")
        .eq("business_id", req.businessId!),
    ]);

    if (templates.error) throw templates.error;
    if (items.error) throw items.error;

    res.json(
      templates.data.map((t) => {
        const templateItems = items.data.filter((i) => i.assembly_template_id === t.id);
        const laborHours = templateItems
          .filter((i) => i.labor_rate_id)
          .reduce((sum, i) => sum + Number(i.quantity_default), 0);
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          itemCount: templateItems.length,
          laborHours,
        };
      })
    );
  })
);

// ---------- CRM ----------

apiRouter.get(
  "/clients",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, phone, email, address, lead_status, source, created_at")
      .eq("business_id", req.businessId!)
      .order("name");

    if (error) throw error;

    // "Last activity" isn't stored on `clients` itself — derive it from the
    // most recent activities row per client (falls back to created_at).
    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select("client_id, created_at")
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false });
    if (activitiesError) throw activitiesError;

    const lastActivityByClient = new Map<string, string>();
    for (const a of activities) {
      if (!lastActivityByClient.has(a.client_id)) {
        lastActivityByClient.set(a.client_id, a.created_at);
      }
    }

    res.json(
      data.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        leadStatus: c.lead_status,
        source: c.source,
        createdAt: c.created_at,
        lastActivity: lastActivityByClient.get(c.id) ?? c.created_at,
      }))
    );
  })
);

apiRouter.get(
  "/clients/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const clientId = req.params.id;

    const [client, activities, estimates, projects] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, phone, email, address, lead_status, source, created_at")
        .eq("business_id", req.businessId!)
        .eq("id", clientId)
        .single(),
      supabase
        .from("activities")
        .select("id, type, content, created_by, created_at")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("estimates")
        .select("id, status, total, created_at")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .order("name"),
    ]);

    if (client.error) throw client.error;
    if (activities.error) throw activities.error;
    if (estimates.error) throw estimates.error;
    if (projects.error) throw projects.error;

    res.json({
      id: client.data.id,
      name: client.data.name,
      phone: client.data.phone,
      email: client.data.email,
      address: client.data.address,
      leadStatus: client.data.lead_status,
      source: client.data.source,
      createdAt: client.data.created_at,
      activities: activities.data.map((a) => ({
        id: a.id,
        type: a.type,
        content: a.content,
        createdBy: a.created_by,
        createdAt: a.created_at,
      })),
      estimates: estimates.data.map((e) => ({
        id: e.id,
        status: e.status,
        total: Number(e.total),
        createdAt: e.created_at,
      })),
      projects: projects.data,
    });
  })
);

// ---------- Cost Tracking ----------
// Budgeted comes from estimate_lines on the project's linked estimate (if
// any); actual comes from real expenses rows. Both are grouped by category
// per project — nothing here is a stored/precomputed aggregate.
apiRouter.get(
  "/cost-tracking",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [projects, expenses] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, estimate_id")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("expenses")
        .select("project_id, category, amount")
        .eq("business_id", req.businessId!),
    ]);

    if (projects.error) throw projects.error;
    if (expenses.error) throw expenses.error;

    const estimateIds = projects.data.map((p) => p.estimate_id).filter((id): id is string => Boolean(id));
    let lines: { estimate_id: string; category: string; total: number }[] = [];
    if (estimateIds.length > 0) {
      const { data, error } = await supabase
        .from("estimate_lines")
        .select("estimate_id, category, total")
        .eq("business_id", req.businessId!)
        .in("estimate_id", estimateIds);
      if (error) throw error;
      lines = data;
    }

    const result = projects.data.map((project) => {
      const categories = ["Materiales", "Mano de obra", "Subcontratistas"] as const;
      const rows = categories
        .map((category) => {
          const budgeted = lines
            .filter((l) => l.estimate_id === project.estimate_id && l.category === category)
            .reduce((sum, l) => sum + Number(l.total), 0);
          const actual = expenses.data
            .filter((e) => e.project_id === project.id && e.category === category)
            .reduce((sum, e) => sum + Number(e.amount), 0);
          return { category, budgeted, actual };
        })
        .filter((r) => r.budgeted > 0 || r.actual > 0);

      return { projectId: project.id, projectName: project.name, rows };
    });

    res.json(result.filter((p) => p.rows.length > 0));
  })
);

// ---------- Projects ----------

apiRouter.get(
  "/projects",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [projects, expenses, assignments] = await Promise.all([
      supabase
        .from("projects")
        .select("id, client_id, estimate_id, name, type, status, progress_percent, start_date, end_date, clients(name)")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase.from("expenses").select("project_id, amount").eq("business_id", req.businessId!),
      supabase
        .from("assignments")
        .select("project_id, employees(name), subcontractors(name)")
        .eq("business_id", req.businessId!),
    ]);

    if (projects.error) throw projects.error;
    if (expenses.error) throw expenses.error;
    if (assignments.error) throw assignments.error;

    // budget_total isn't a stored column — it's the project's linked
    // estimate total, fetched separately since not every project has one.
    const estimateIds = projects.data.map((p) => p.estimate_id).filter((id): id is string => Boolean(id));
    let estimateTotals = new Map<string, number>();
    if (estimateIds.length > 0) {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, total")
        .in("id", estimateIds);
      if (error) throw error;
      estimateTotals = new Map(data.map((e) => [e.id, Number(e.total)]));
    }

    res.json(
      projects.data.map((p: any) => ({
        id: p.id,
        clientId: p.client_id,
        clientName: p.clients?.name ?? null,
        name: p.name,
        type: p.type,
        status: p.status,
        progressPercent: Number(p.progress_percent),
        startDate: p.start_date,
        endDate: p.end_date,
        budgetTotal: p.estimate_id ? (estimateTotals.get(p.estimate_id) ?? 0) : 0,
        budgetUsed: expenses.data
          .filter((e) => e.project_id === p.id)
          .reduce((sum, e) => sum + Number(e.amount), 0),
        team: assignments.data
          .filter((a: any) => a.project_id === p.id)
          .map((a: any) => a.employees?.name ?? a.subcontractors?.name)
          .filter(Boolean),
      }))
    );
  })
);

apiRouter.get(
  "/projects/:id",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const projectId = req.params.id;

    const [project, estimateLines, expenses, documents, photos, scheduleEvents, assignments] = await Promise.all([
      supabase
        .from("projects")
        .select("id, client_id, estimate_id, name, type, status, progress_percent, start_date, end_date, clients(name)")
        .eq("business_id", req.businessId!)
        .eq("id", projectId)
        .single(),
      supabase
        .from("estimate_lines")
        .select("id, zone, category, item_name, quantity, unit_cost, total, estimates!inner(id, project_id)")
        .eq("business_id", req.businessId!)
        .eq("estimates.project_id", projectId),
      supabase
        .from("expenses")
        .select("id, category, description, amount, date")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
      supabase
        .from("documents")
        .select("id, name, tag, uploaded_at")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
      supabase
        .from("photos")
        .select("id, zone, visible_to_client, timestamp")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
      supabase
        .from("schedule_events")
        .select("id, title, type, start_time")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
      supabase
        .from("assignments")
        .select("employees(name), subcontractors(name)")
        .eq("business_id", req.businessId!)
        .eq("project_id", projectId),
    ]);

    if (project.error) throw project.error;
    if (estimateLines.error) throw estimateLines.error;
    if (expenses.error) throw expenses.error;
    if (documents.error) throw documents.error;
    if (photos.error) throw photos.error;
    if (scheduleEvents.error) throw scheduleEvents.error;
    if (assignments.error) throw assignments.error;

    const client = (project.data as any).clients as { name: string } | null;

    res.json({
      id: project.data.id,
      clientName: client?.name ?? null,
      name: project.data.name,
      type: project.data.type,
      status: project.data.status,
      progressPercent: Number(project.data.progress_percent),
      startDate: project.data.start_date,
      endDate: project.data.end_date,
      team: (assignments.data as any[])
        .map((a) => a.employees?.name ?? a.subcontractors?.name)
        .filter(Boolean),
      estimateLines: estimateLines.data.map((l: any) => ({
        id: l.id,
        zone: l.zone,
        category: l.category,
        item: l.item_name,
        total: Number(l.total),
      })),
      expenses: expenses.data.map((e) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        date: e.date,
      })),
      documents: documents.data.map((d) => ({
        id: d.id,
        name: d.name,
        tag: d.tag,
        uploadedAt: d.uploaded_at,
      })),
      photos: photos.data.map((p) => ({
        id: p.id,
        zone: p.zone,
        visibleToClient: p.visible_to_client,
        timestamp: p.timestamp,
      })),
      scheduleEvents: scheduleEvents.data.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        startTime: s.start_time,
      })),
    });
  })
);

// ---------- Contracts & Documents ----------

apiRouter.get(
  "/documents",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, tag, uploaded_at, project_id, projects(name)")
      .eq("business_id", req.businessId!)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((d: any) => ({
        id: d.id,
        name: d.name,
        tag: d.tag,
        uploadedAt: d.uploaded_at,
        projectId: d.project_id,
        projectName: d.projects?.name ?? null,
      }))
    );
  })
);

// ---------- Photo Gallery ----------

apiRouter.get(
  "/photos",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("photos")
      .select(
        "id, zone, timestamp, visible_to_client, project_id, projects(name), employees:uploaded_by_employee_id(name), subcontractors:uploaded_by_subcontractor_id(name)"
      )
      .eq("business_id", req.businessId!)
      .order("timestamp", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((p: any) => ({
        id: p.id,
        projectId: p.project_id,
        projectName: p.projects?.name ?? null,
        zone: p.zone,
        timestamp: p.timestamp,
        visibleToClient: p.visible_to_client,
        uploadedBy: p.employees?.name ?? p.subcontractors?.name ?? null,
      }))
    );
  })
);

// ---------- Technicians & Crew ----------

apiRouter.get(
  "/employees",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [employees, assignments, timeEntries] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, role, phone, status")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("assignments")
        .select("employee_id, projects(name)")
        .eq("business_id", req.businessId!)
        .not("employee_id", "is", null),
      supabase
        .from("time_entries")
        .select("employee_id, check_in_time, check_out_time")
        .eq("business_id", req.businessId!)
        .not("employee_id", "is", null),
    ]);

    if (employees.error) throw employees.error;
    if (assignments.error) throw assignments.error;
    if (timeEntries.error) throw timeEntries.error;

    res.json(
      employees.data.map((e) => {
        const currentProject = (assignments.data as any[]).find((a) => a.employee_id === e.id)?.projects?.name ?? null;
        const hoursThisPeriod = (timeEntries.data as any[])
          .filter((t) => t.employee_id === e.id && t.check_out_time)
          .reduce((sum, t) => {
            const ms = new Date(t.check_out_time).getTime() - new Date(t.check_in_time).getTime();
            return sum + ms / 3600000;
          }, 0);
        return {
          id: e.id,
          name: e.name,
          role: e.role,
          phone: e.phone,
          status: e.status,
          currentProject,
          hoursThisPeriod: Math.round(hoursThisPeriod),
        };
      })
    );
  })
);

// Issues a fresh access token for the worker PWA (/campo) login — only the
// hash is stored, so the raw token is shown to the admin exactly once here.
apiRouter.post(
  "/employees/:id/access-token",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const token = randomBytes(9).toString("base64url");
    const { error } = await supabase
      .from("employees")
      .update({ access_token_hash: hashToken(token) })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ token });
  })
);

// ---------- Subcontractors ----------

apiRouter.get(
  "/subcontractors",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [subcontractors, assignments] = await Promise.all([
      supabase
        .from("subcontractors")
        .select("id, name, trade, phone, rating, telegram_chat_id")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("assignments")
        .select("subcontractor_id, projects(name)")
        .eq("business_id", req.businessId!)
        .not("subcontractor_id", "is", null),
    ]);

    if (subcontractors.error) throw subcontractors.error;
    if (assignments.error) throw assignments.error;

    res.json(
      subcontractors.data.map((s) => ({
        id: s.id,
        name: s.name,
        trade: s.trade,
        phone: s.phone,
        rating: s.rating,
        telegramLinked: Boolean(s.telegram_chat_id),
        assignedProjects: (assignments.data as any[])
          .filter((a) => a.subcontractor_id === s.id)
          .map((a) => a.projects?.name)
          .filter(Boolean),
      }))
    );
  })
);

apiRouter.post(
  "/subcontractors/:id/access-token",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const token = randomBytes(9).toString("base64url");
    const { error } = await supabase
      .from("subcontractors")
      .update({ access_token_hash: hashToken(token) })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (error) throw error;
    res.json({ token });
  })
);

// ---------- GPS & Routing ----------

apiRouter.get(
  "/gps",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [employees, subcontractors, assignments] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, status")
        .eq("business_id", req.businessId!)
        .eq("status", "en_proyecto"),
      supabase
        .from("subcontractors")
        .select("id, name")
        .eq("business_id", req.businessId!),
      supabase
        .from("assignments")
        .select("employee_id, subcontractor_id, projects(name)")
        .eq("business_id", req.businessId!),
    ]);

    if (employees.error) throw employees.error;
    if (subcontractors.error) throw subcontractors.error;
    if (assignments.error) throw assignments.error;

    const activeEmployees = employees.data.map((e) => ({
      id: e.id,
      name: e.name,
      kind: "employee" as const,
      currentProject: (assignments.data as any[]).find((a) => a.employee_id === e.id)?.projects?.name ?? null,
    }));

    const assignedSubIds = new Set((assignments.data as any[]).filter((a) => a.subcontractor_id).map((a) => a.subcontractor_id));
    const activeSubcontractors = subcontractors.data
      .filter((s) => assignedSubIds.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: "subcontractor" as const,
        currentProject: (assignments.data as any[]).find((a) => a.subcontractor_id === s.id)?.projects?.name ?? null,
      }));

    res.json([...activeEmployees, ...activeSubcontractors]);
  })
);

// ---------- Check-in / Check-out ----------

apiRouter.get(
  "/time-entries",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("time_entries")
      .select(
        "id, check_in_time, check_in_location, check_out_time, approved, projects(name), employees(name), subcontractors(name)"
      )
      .eq("business_id", req.businessId!)
      .order("check_in_time", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((t: any) => ({
        id: t.id,
        projectName: t.projects?.name ?? null,
        workerName: t.employees?.name ?? t.subcontractors?.name ?? null,
        checkInTime: t.check_in_time,
        checkInLocation: t.check_in_location,
        checkOutTime: t.check_out_time,
        approved: t.approved,
      }))
    );
  })
);

apiRouter.patch(
  "/time-entries/:id/approve",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("time_entries")
      .update({ approved: true })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Work Orders ----------

apiRouter.get(
  "/work-orders",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("work_orders")
      .select("id, title, description, priority, status, projects(name), employees:assigned_employee_id(name), subcontractors:assigned_subcontractor_id(name)")
      .eq("business_id", req.businessId!);

    if (error) throw error;

    res.json(
      data.map((w: any) => ({
        id: w.id,
        title: w.title,
        description: w.description,
        priority: w.priority,
        status: w.status,
        projectName: w.projects?.name ?? null,
        assignedTo: w.employees?.name ?? w.subcontractors?.name ?? null,
      }))
    );
  })
);

// ---------- Scheduling ----------

apiRouter.get(
  "/schedule-events",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("schedule_events")
      .select(
        "id, title, type, start_time, end_time, notes, project_id, projects(name), employees:assigned_employee_id(id, name), subcontractors:assigned_subcontractor_id(id, name)"
      )
      .eq("business_id", req.businessId!)
      .order("start_time");

    if (error) throw error;

    res.json(
      data.map((s: any) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        startTime: s.start_time,
        endTime: s.end_time,
        notes: s.notes,
        projectId: s.project_id,
        projectName: s.projects?.name ?? null,
        assignedWorkerId: s.employees?.id ?? s.subcontractors?.id ?? null,
        assignedWorkerName: s.employees?.name ?? s.subcontractors?.name ?? null,
      }))
    );
  })
);

apiRouter.post(
  "/schedule-events",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const body = req.body ?? {};

    if (!body.projectId || !body.title || !body.startTime || !body.endTime) {
      res.status(400).json({ error: "projectId, title, startTime and endTime are required" });
      return;
    }
    if (body.assignedEmployeeId && body.assignedSubcontractorId) {
      res.status(400).json({ error: "Assign to only one worker, not both" });
      return;
    }

    const { data, error } = await supabase
      .from("schedule_events")
      .insert({
        business_id: req.businessId!,
        project_id: body.projectId,
        title: body.title,
        type: body.type ?? "reunion",
        start_time: body.startTime,
        end_time: body.endTime,
        notes: body.notes ?? null,
        assigned_employee_id: body.assignedEmployeeId ?? null,
        assigned_subcontractor_id: body.assignedSubcontractorId ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

// ---------- Appointment requests (hybrid chat, scoped free text) ----------
// A client's "Agendar cita" bubble opens two scoped free-text questions
// (when + why), never a real slot pick — this is the pending request that
// results in. Confirming here is the only thing that ever writes a real
// schedule_events row for it; rejecting just closes the request. The
// public chat UI that creates these doesn't exist yet (Fase D) — this is
// the admin-side half plus the data model, buildable and testable now.

apiRouter.get(
  "/appointment-requests",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("appointment_requests")
      .select("id, client_id, requested_datetime_text, reason_text, status, schedule_event_id, created_at, clients(name)")
      .eq("business_id", req.businessId!)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((r: any) => ({
        id: r.id,
        clientId: r.client_id,
        clientName: r.clients?.name ?? null,
        requestedDatetimeText: r.requested_datetime_text,
        reasonText: r.reason_text,
        status: r.status,
        scheduleEventId: r.schedule_event_id,
        createdAt: r.created_at,
      }))
    );
  })
);

// Exposed for the future public chat to call once it exists (Fase D) —
// exercised today via direct API calls / tests, not yet from any UI.
apiRouter.post(
  "/appointment-requests",
  route(async (req, res) => {
    const { clientId, requestedDatetimeText, reasonText } = req.body ?? {};
    if (!clientId || !requestedDatetimeText) {
      res.status(400).json({ error: "clientId and requestedDatetimeText are required" });
      return;
    }

    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("appointment_requests")
      .insert({
        business_id: req.businessId!,
        client_id: clientId,
        requested_datetime_text: requestedDatetimeText,
        reason_text: reasonText ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    res.status(201).json({ id: data.id });
  })
);

// Admin picks the real slot — this is the only path that ever creates a
// schedule_events row for a client-requested appointment.
apiRouter.patch(
  "/appointment-requests/:id/confirm",
  route(async (req, res) => {
    const { startTime, durationMinutes, assignedEmployeeId, assignedSubcontractorId } = req.body ?? {};
    if (!startTime || !durationMinutes) {
      res.status(400).json({ error: "startTime and durationMinutes are required" });
      return;
    }
    if (assignedEmployeeId && assignedSubcontractorId) {
      res.status(400).json({ error: "Assign to only one worker, not both" });
      return;
    }

    const supabase = req.supabase!;
    const { data: reqRow, error: reqError } = await supabase
      .from("appointment_requests")
      .select("client_id, reason_text, clients(name)")
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id)
      .single();
    if (reqError) throw reqError;

    const endTime = new Date(new Date(startTime).getTime() + durationMinutes * 60000).toISOString();
    const clientName = (reqRow.clients as any)?.name ?? "Cliente";

    const { data: event, error: eventError } = await supabase
      .from("schedule_events")
      .insert({
        business_id: req.businessId!,
        project_id: null,
        title: `Cita con ${clientName}`,
        type: "reunion",
        start_time: startTime,
        end_time: endTime,
        notes: reqRow.reason_text,
        assigned_employee_id: assignedEmployeeId ?? null,
        assigned_subcontractor_id: assignedSubcontractorId ?? null,
        source: "chat_cliente",
      })
      .select("id")
      .single();
    if (eventError) throw eventError;

    const { error: updateError } = await supabase
      .from("appointment_requests")
      .update({ status: "confirmada", schedule_event_id: event.id })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);
    if (updateError) throw updateError;

    res.json({ ok: true, scheduleEventId: event.id });
  })
);

apiRouter.patch(
  "/appointment-requests/:id/reject",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("appointment_requests")
      .update({ status: "rechazada" })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Invoicing & Payments ----------

apiRouter.get(
  "/invoices",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("invoices")
      .select("id, type, amount, status, due_date, projects(name), clients(name)")
      .eq("business_id", req.businessId!)
      .order("due_date");

    if (error) throw error;

    res.json(
      data.map((i: any) => ({
        id: i.id,
        type: i.type,
        amount: Number(i.amount),
        status: i.status,
        dueDate: i.due_date,
        projectName: i.projects?.name ?? null,
        clientName: i.clients?.name ?? null,
      }))
    );
  })
);

// ---------- Reports & Analytics ----------
// The month-by-month revenue/expense series is grouped from real payment
// and expense dates (not a stored aggregate, and not a fabricated series
// like the Fase A mock's hardcoded 6 months).
apiRouter.get(
  "/reports",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [payments, expenses, projects, employees, timeEntries, materialLines] = await Promise.all([
      supabase.from("payments").select("amount, paid_at").eq("business_id", req.businessId!),
      supabase.from("expenses").select("amount, date").eq("business_id", req.businessId!),
      supabase.from("projects").select("status").eq("business_id", req.businessId!),
      supabase.from("employees").select("id, name").eq("business_id", req.businessId!),
      supabase
        .from("time_entries")
        .select("employee_id, check_in_time, check_out_time")
        .eq("business_id", req.businessId!)
        .not("check_out_time", "is", null),
      // "Materiales más usados" = counted from real estimate_lines references,
      // not a fabricated ranking.
      supabase
        .from("estimate_lines")
        .select("item_name, quantity, materials_catalog(unit)")
        .eq("business_id", req.businessId!)
        .not("material_id", "is", null),
    ]);

    if (payments.error) throw payments.error;
    if (expenses.error) throw expenses.error;
    if (projects.error) throw projects.error;
    if (employees.error) throw employees.error;
    if (timeEntries.error) throw timeEntries.error;
    if (materialLines.error) throw materialLines.error;

    const monthKey = (iso: string) => iso.slice(0, 7); // "YYYY-MM"
    const months = new Set<string>();
    for (const p of payments.data) if (p.paid_at) months.add(monthKey(p.paid_at));
    for (const e of expenses.data) months.add(monthKey(e.date));

    const revenueByMonth = Array.from(months)
      .sort()
      .map((month) => ({
        month,
        ingresos: payments.data
          .filter((p) => p.paid_at && monthKey(p.paid_at) === month)
          .reduce((sum, p) => sum + Number(p.amount), 0),
        gastos: expenses.data
          .filter((e) => monthKey(e.date) === month)
          .reduce((sum, e) => sum + Number(e.amount), 0),
      }));

    const totalRevenue = payments.data.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalExpense = expenses.data.reduce((sum, e) => sum + Number(e.amount), 0);

    const hoursByEmployee = employees.data.map((e) => ({
      name: e.name.split(" ")[0],
      horas: Math.round(
        timeEntries.data
          .filter((t) => t.employee_id === e.id)
          .reduce((sum, t) => sum + (new Date(t.check_out_time!).getTime() - new Date(t.check_in_time).getTime()) / 3600000, 0)
      ),
    }));

    const usageByMaterial = new Map<string, { unit: string; timesUsed: number; totalQuantity: number }>();
    for (const line of materialLines.data as any[]) {
      const key = line.item_name;
      const existing = usageByMaterial.get(key) ?? { unit: line.materials_catalog?.unit ?? "", timesUsed: 0, totalQuantity: 0 };
      existing.timesUsed += 1;
      existing.totalQuantity += Number(line.quantity);
      usageByMaterial.set(key, existing);
    }
    const topMaterials = Array.from(usageByMaterial.entries())
      .sort((a, b) => b[1].timesUsed - a[1].timesUsed)
      .slice(0, 5)
      .map(([name, info]) => ({ name, unit: info.unit, totalQuantity: info.totalQuantity }));

    res.json({
      revenueByMonth,
      totalRevenue,
      totalExpense,
      profit: totalRevenue - totalExpense,
      activeProjects: projects.data.filter((p) => p.status === "en_progreso").length,
      completedProjects: projects.data.filter((p) => p.status === "completado").length,
      hoursByEmployee,
      topMaterials,
    });
  })
);

// ---------- Client Portal ----------

apiRouter.get(
  "/client-portal/:clientId",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const clientId = req.params.clientId;

    const [client, project, estimate] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name")
        .eq("business_id", req.businessId!)
        .eq("id", clientId)
        .single(),
      supabase
        .from("projects")
        .select("id, name, progress_percent")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("estimates")
        .select("id, status, total")
        .eq("business_id", req.businessId!)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (client.error) throw client.error;
    if (project.error) throw project.error;
    if (estimate.error) throw estimate.error;

    let visiblePhotos: { id: string }[] = [];
    if (project.data) {
      const { data, error } = await supabase
        .from("photos")
        .select("id")
        .eq("business_id", req.businessId!)
        .eq("project_id", project.data.id)
        .eq("visible_to_client", true);
      if (error) throw error;
      visiblePhotos = data;
    }

    res.json({
      client: { id: client.data.id, name: client.data.name },
      project: project.data
        ? { id: project.data.id, name: project.data.name, progressPercent: Number(project.data.progress_percent) }
        : null,
      estimate: estimate.data
        ? { id: estimate.data.id, status: estimate.data.status, total: Number(estimate.data.total) }
        : null,
      visiblePhotos,
    });
  })
);

// ---------- Communication ----------

apiRouter.get(
  "/conversations",
  route(async (req, res) => {
    const supabase = req.supabase!;

    const [conversations, messages] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, client_id, control_mode, clients(name, phone)")
        .eq("business_id", req.businessId!),
      supabase
        .from("conversation_messages")
        .select("conversation_id, content, timestamp")
        .eq("business_id", req.businessId!)
        .order("timestamp", { ascending: false }),
    ]);

    if (conversations.error) throw conversations.error;
    if (messages.error) throw messages.error;

    res.json(
      conversations.data.map((c: any) => ({
        id: c.id,
        clientId: c.client_id,
        clientName: c.clients?.name ?? null,
        clientPhone: c.clients?.phone ?? null,
        controlMode: c.control_mode,
        lastMessage: (messages.data as any[]).find((m) => m.conversation_id === c.id)?.content ?? null,
      }))
    );
  })
);

apiRouter.get(
  "/conversations/:id/messages",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("conversation_messages")
      .select("id, direction, content, sent_by, timestamp")
      .eq("business_id", req.businessId!)
      .eq("conversation_id", req.params.id)
      .order("timestamp");

    if (error) throw error;

    res.json(
      data.map((m) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        sentBy: m.sent_by,
        timestamp: m.timestamp,
      }))
    );
  })
);

apiRouter.patch(
  "/conversations/:id",
  route(async (req, res) => {
    const controlMode = req.body?.controlMode;
    if (controlMode !== "bot" && controlMode !== "human") {
      res.status(400).json({ error: "controlMode must be 'bot' or 'human'" });
      return;
    }
    const supabase = req.supabase!;
    const { error } = await supabase
      .from("conversations")
      .update({ control_mode: controlMode })
      .eq("business_id", req.businessId!)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Configuración ----------

apiRouter.get(
  "/settings/company",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, license_number, tax_config")
      .eq("id", req.businessId!)
      .single();

    if (error) throw error;

    res.json({
      id: data.id,
      name: data.name,
      licenseNumber: data.license_number,
      taxConfig: data.tax_config,
    });
  })
);

// Where a brand-new business fills in everything registration deliberately
// didn't ask for (name, license, tax region/rate) — registration only ever
// collects email/phone + password.
apiRouter.patch(
  "/settings/company",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.name !== undefined) update.name = body.name;
    if (body.licenseNumber !== undefined) update.license_number = body.licenseNumber;
    if (body.taxConfig !== undefined) update.tax_config = body.taxConfig;

    const { error } = await supabase.from("businesses").update(update).eq("id", req.businessId!);
    if (error) throw error;
    res.json({ ok: true });
  })
);

apiRouter.get(
  "/settings/margins",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const { data, error } = await supabase
      .from("business_settings")
      .select("default_margin_type, default_waste_percent")
      .eq("business_id", req.businessId!)
      .single();

    if (error) throw error;

    res.json({
      defaultMarginType: data.default_margin_type,
      defaultWastePercent: Number(data.default_waste_percent),
    });
  })
);

apiRouter.get(
  "/settings/users",
  route(async (req, res) => {
    const supabase = req.supabase!;
    const [users, roles] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, email, status, roles(name, permissions)")
        .eq("business_id", req.businessId!)
        .order("name"),
      supabase
        .from("roles")
        .select("name, permissions")
        .eq("business_id", req.businessId!),
    ]);

    if (users.error) throw users.error;
    if (roles.error) throw roles.error;

    res.json({
      users: users.data.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        status: u.status,
        role: u.roles?.name ?? null,
      })),
      roles: roles.data.map((r) => ({ name: r.name, permissions: r.permissions })),
    });
  })
);

// A bare `Router()` mounted directly into a raw connect/http middleware
// stack (as Vite's dev server uses) never gets Express's response-object
// patching (res.status/res.json come from `express()` app dispatch, not
// from Router itself) — so we export a fully-formed app here and mount
// *that* both in the Vite dev plugin and the production server, instead
// of mounting the router directly in either place.
export const apiApp = express();
apiApp.use(express.json());
apiApp.use(apiRouter);
