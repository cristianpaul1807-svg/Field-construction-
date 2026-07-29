import express, { Router, type Request, type Response, type NextFunction } from "express";
import { DEMO_BUSINESS_ID, getSupabaseAdmin, SupabaseNotConfiguredError } from "./supabaseAdmin";

export const apiRouter = Router();

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

// ---------- Materials & Costs ----------
// Materials, labor rates and subcontractor trades live in three separate
// tables (per the Fase B schema) but the screen displays them as one
// combined catalog grouped by category, matching the Fase A mock UI.
apiRouter.get(
  "/materials",
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();

    const [materials, laborRates, subcontractors] = await Promise.all([
      supabase
        .from("materials_catalog")
        .select("id, name, unit, price, category, supplier, is_reference_only")
        .eq("business_id", DEMO_BUSINESS_ID)
        .order("name"),
      supabase
        .from("labor_rates")
        .select("id, name, hourly_rate")
        .eq("business_id", DEMO_BUSINESS_ID)
        .order("name"),
      supabase
        .from("subcontractors")
        .select("id, name, trade, phone, rating, telegram_chat_id")
        .eq("business_id", DEMO_BUSINESS_ID)
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("estimates")
      .select("id, client_id, status, total, created_at, clients(name)")
      .eq("business_id", DEMO_BUSINESS_ID)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(
      data.map((e: any) => ({
        id: e.id,
        clientId: e.client_id,
        clientName: e.clients?.name ?? null,
        status: e.status,
        total: Number(e.total),
        createdAt: e.created_at,
      }))
    );
  })
);

apiRouter.get(
  "/estimates/:id",
  route(async (req, res) => {
    const supabase = getSupabaseAdmin();

    const [estimate, lines] = await Promise.all([
      supabase
        .from("estimates")
        .select("id, client_id, project_id, status, margin_type, margin_percent, waste_percent, total, created_at, clients(name, address)")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("id", req.params.id)
        .single(),
      supabase
        .from("estimate_lines")
        .select("id, zone, category, item_name, quantity, unit_cost, total, visible_to_client")
        .eq("business_id", DEMO_BUSINESS_ID)
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

// ---------- Assembly Templates ----------
// itemCount / laborHours are derived here (not stored) so the templates
// list always reflects the current composition of each recipe.
apiRouter.get(
  "/assembly-templates",
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();

    const [templates, items] = await Promise.all([
      supabase
        .from("assembly_templates")
        .select("id, name, description")
        .eq("business_id", DEMO_BUSINESS_ID)
        .order("name"),
      supabase
        .from("assembly_items")
        .select("assembly_template_id, labor_rate_id, quantity_default")
        .eq("business_id", DEMO_BUSINESS_ID),
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, phone, email, address, lead_status, source, created_at")
      .eq("business_id", DEMO_BUSINESS_ID)
      .order("name");

    if (error) throw error;

    // "Last activity" isn't stored on `clients` itself — derive it from the
    // most recent activities row per client (falls back to created_at).
    const { data: activities, error: activitiesError } = await supabase
      .from("activities")
      .select("client_id, created_at")
      .eq("business_id", DEMO_BUSINESS_ID)
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
    const supabase = getSupabaseAdmin();
    const clientId = req.params.id;

    const [client, activities, estimates, projects] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, phone, email, address, lead_status, source, created_at")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("id", clientId)
        .single(),
      supabase
        .from("activities")
        .select("id, type, content, created_by, created_at")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("estimates")
        .select("id, status, total, created_at")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name")
        .eq("business_id", DEMO_BUSINESS_ID)
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();

    const [projects, expenses] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, estimate_id")
        .eq("business_id", DEMO_BUSINESS_ID)
        .order("name"),
      supabase
        .from("expenses")
        .select("project_id, category, amount")
        .eq("business_id", DEMO_BUSINESS_ID),
    ]);

    if (projects.error) throw projects.error;
    if (expenses.error) throw expenses.error;

    const estimateIds = projects.data.map((p) => p.estimate_id).filter((id): id is string => Boolean(id));
    let lines: { estimate_id: string; category: string; total: number }[] = [];
    if (estimateIds.length > 0) {
      const { data, error } = await supabase
        .from("estimate_lines")
        .select("estimate_id, category, total")
        .eq("business_id", DEMO_BUSINESS_ID)
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

// A bare `Router()` mounted directly into a raw connect/http middleware
// stack (as Vite's dev server uses) never gets Express's response-object
// patching (res.status/res.json come from `express()` app dispatch, not
// from Router itself) — so we export a fully-formed app here and mount
// *that* both in the Vite dev plugin and the production server, instead
// of mounting the router directly in either place.
export const apiApp = express();
apiApp.use(express.json());
apiApp.use(apiRouter);
