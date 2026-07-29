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

// ---------- Projects ----------

apiRouter.get(
  "/projects",
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();

    const [projects, expenses, assignments] = await Promise.all([
      supabase
        .from("projects")
        .select("id, client_id, estimate_id, name, type, status, progress_percent, start_date, end_date, clients(name)")
        .eq("business_id", DEMO_BUSINESS_ID)
        .order("name"),
      supabase.from("expenses").select("project_id, amount").eq("business_id", DEMO_BUSINESS_ID),
      supabase
        .from("assignments")
        .select("project_id, employees(name), subcontractors(name)")
        .eq("business_id", DEMO_BUSINESS_ID),
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
    const supabase = getSupabaseAdmin();
    const projectId = req.params.id;

    const [project, estimateLines, expenses, documents, photos, scheduleEvents, assignments] = await Promise.all([
      supabase
        .from("projects")
        .select("id, client_id, estimate_id, name, type, status, progress_percent, start_date, end_date, clients(name)")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("id", projectId)
        .single(),
      supabase
        .from("estimate_lines")
        .select("id, zone, category, item_name, quantity, unit_cost, total, estimates!inner(id, project_id)")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("estimates.project_id", projectId),
      supabase
        .from("expenses")
        .select("id, category, description, amount, date")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("project_id", projectId),
      supabase
        .from("documents")
        .select("id, name, tag, uploaded_at")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("project_id", projectId),
      supabase
        .from("photos")
        .select("id, zone, visible_to_client, timestamp")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("project_id", projectId),
      supabase
        .from("schedule_events")
        .select("id, title, type, start_time")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("project_id", projectId),
      supabase
        .from("assignments")
        .select("employees(name), subcontractors(name)")
        .eq("business_id", DEMO_BUSINESS_ID)
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("documents")
      .select("id, name, tag, uploaded_at, project_id, projects(name)")
      .eq("business_id", DEMO_BUSINESS_ID)
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("photos")
      .select(
        "id, zone, timestamp, visible_to_client, project_id, projects(name), employees:uploaded_by_employee_id(name), subcontractors:uploaded_by_subcontractor_id(name)"
      )
      .eq("business_id", DEMO_BUSINESS_ID)
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();

    const [employees, assignments, timeEntries] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, role, phone, status")
        .eq("business_id", DEMO_BUSINESS_ID)
        .order("name"),
      supabase
        .from("assignments")
        .select("employee_id, projects(name)")
        .eq("business_id", DEMO_BUSINESS_ID)
        .not("employee_id", "is", null),
      supabase
        .from("time_entries")
        .select("employee_id, check_in_time, check_out_time")
        .eq("business_id", DEMO_BUSINESS_ID)
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

// ---------- Subcontractors ----------

apiRouter.get(
  "/subcontractors",
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();

    const [subcontractors, assignments] = await Promise.all([
      supabase
        .from("subcontractors")
        .select("id, name, trade, phone, rating, telegram_chat_id")
        .eq("business_id", DEMO_BUSINESS_ID)
        .order("name"),
      supabase
        .from("assignments")
        .select("subcontractor_id, projects(name)")
        .eq("business_id", DEMO_BUSINESS_ID)
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

// ---------- GPS & Routing ----------

apiRouter.get(
  "/gps",
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();

    const [employees, subcontractors, assignments] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, status")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("status", "en_proyecto"),
      supabase
        .from("subcontractors")
        .select("id, name")
        .eq("business_id", DEMO_BUSINESS_ID),
      supabase
        .from("assignments")
        .select("employee_id, subcontractor_id, projects(name)")
        .eq("business_id", DEMO_BUSINESS_ID),
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("time_entries")
      .select(
        "id, check_in_time, check_in_location, check_out_time, approved, projects(name), employees(name), subcontractors(name)"
      )
      .eq("business_id", DEMO_BUSINESS_ID)
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
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("time_entries")
      .update({ approved: true })
      .eq("business_id", DEMO_BUSINESS_ID)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Work Orders ----------

apiRouter.get(
  "/work-orders",
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("work_orders")
      .select("id, title, description, priority, status, projects(name), employees:assigned_employee_id(name), subcontractors:assigned_subcontractor_id(name)")
      .eq("business_id", DEMO_BUSINESS_ID);

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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("schedule_events")
      .select("id, title, type, start_time, project_id, projects(name)")
      .eq("business_id", DEMO_BUSINESS_ID)
      .order("start_time");

    if (error) throw error;

    res.json(
      data.map((s: any) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        startTime: s.start_time,
        projectId: s.project_id,
        projectName: s.projects?.name ?? null,
      }))
    );
  })
);

// ---------- Invoicing & Payments ----------

apiRouter.get(
  "/invoices",
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("invoices")
      .select("id, type, amount, status, due_date, projects(name), clients(name)")
      .eq("business_id", DEMO_BUSINESS_ID)
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();

    const [payments, expenses, projects, employees, timeEntries, materialLines] = await Promise.all([
      supabase.from("payments").select("amount, paid_at").eq("business_id", DEMO_BUSINESS_ID),
      supabase.from("expenses").select("amount, date").eq("business_id", DEMO_BUSINESS_ID),
      supabase.from("projects").select("status").eq("business_id", DEMO_BUSINESS_ID),
      supabase.from("employees").select("id, name").eq("business_id", DEMO_BUSINESS_ID),
      supabase
        .from("time_entries")
        .select("employee_id, check_in_time, check_out_time")
        .eq("business_id", DEMO_BUSINESS_ID)
        .not("check_out_time", "is", null),
      // "Materiales más usados" = counted from real estimate_lines references,
      // not a fabricated ranking.
      supabase
        .from("estimate_lines")
        .select("item_name, quantity, materials_catalog(unit)")
        .eq("business_id", DEMO_BUSINESS_ID)
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
    const supabase = getSupabaseAdmin();
    const clientId = req.params.clientId;

    const [client, project, estimate] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("id", clientId)
        .single(),
      supabase
        .from("projects")
        .select("id, name, progress_percent")
        .eq("business_id", DEMO_BUSINESS_ID)
        .eq("client_id", clientId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("estimates")
        .select("id, status, total")
        .eq("business_id", DEMO_BUSINESS_ID)
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
        .eq("business_id", DEMO_BUSINESS_ID)
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();

    const [conversations, messages] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, client_id, control_mode, clients(name, phone)")
        .eq("business_id", DEMO_BUSINESS_ID),
      supabase
        .from("conversation_messages")
        .select("conversation_id, content, timestamp")
        .eq("business_id", DEMO_BUSINESS_ID)
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
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("conversation_messages")
      .select("id, direction, content, sent_by, timestamp")
      .eq("business_id", DEMO_BUSINESS_ID)
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
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("conversations")
      .update({ control_mode: controlMode })
      .eq("business_id", DEMO_BUSINESS_ID)
      .eq("id", req.params.id);

    if (error) throw error;
    res.json({ ok: true });
  })
);

// ---------- Configuración ----------

apiRouter.get(
  "/settings/company",
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, license_number, tax_config")
      .eq("id", DEMO_BUSINESS_ID)
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

apiRouter.get(
  "/settings/margins",
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("business_settings")
      .select("default_margin_type, default_waste_percent")
      .eq("business_id", DEMO_BUSINESS_ID)
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
  route(async (_req, res) => {
    const supabase = getSupabaseAdmin();
    const [users, roles] = await Promise.all([
      supabase
        .from("users")
        .select("id, name, email, status, roles(name, permissions)")
        .eq("business_id", DEMO_BUSINESS_ID)
        .order("name"),
      supabase
        .from("roles")
        .select("name, permissions")
        .eq("business_id", DEMO_BUSINESS_ID),
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
