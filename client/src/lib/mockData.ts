// Sample data for the business panel prototype (Fase A — visual only, no backend yet).
// Shapes mirror the data model in Especificacion-Pantallas-v1: every record belongs to
// a single business_id (multi-tenant), included here even though there's only one business.

export const CURRENT_BUSINESS_ID = "biz_001";

export const business = {
  id: CURRENT_BUSINESS_ID,
  name: "Rodriguez Construction Group",
  logoUrl: "",
  licenseNumber: "LIC-48213-ON",
  taxConfig: { region: "Ontario", rate: 0.13 },
  subscriptionPlan: "pilot",
  status: "active",
};

export const businessSettings = {
  businessId: CURRENT_BUSINESS_ID,
  defaultMarginType: "global" as "global" | "section",
  defaultWastePercent: 8,
  currency: "CAD",
  timezone: "America/Toronto",
};

// ---------- CRM ----------
export type LeadStatus = "nuevo" | "cotizado" | "negociando" | "ganado" | "perdido";

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  leadStatus: LeadStatus;
  source: string;
  createdAt: string;
  lastActivity: string;
}

export const clients: Client[] = [
  {
    id: "cl_1",
    name: "John Smith",
    phone: "+1 416 555 0142",
    email: "john.smith@email.com",
    address: "128 Maple Ave, Toronto, ON",
    leadStatus: "cotizado",
    source: "WhatsApp",
    createdAt: "2026-06-02",
    lastActivity: "2026-07-27",
  },
  {
    id: "cl_2",
    name: "Sarah Johnson",
    phone: "+1 647 555 0117",
    email: "sarah.j@email.com",
    address: "45 King St W, Mississauga, ON",
    leadStatus: "ganado",
    source: "Referral",
    createdAt: "2026-04-11",
    lastActivity: "2026-07-20",
  },
  {
    id: "cl_3",
    name: "Mike Davis",
    phone: "+1 905 555 0198",
    email: "mdavis@email.com",
    address: "890 Bay St, Toronto, ON",
    leadStatus: "negociando",
    source: "Website",
    createdAt: "2026-07-08",
    lastActivity: "2026-07-29",
  },
  {
    id: "cl_4",
    name: "Lisa Chen",
    phone: "+1 416 555 0173",
    email: "lisa.chen@email.com",
    address: "22 Front St, Toronto, ON",
    leadStatus: "nuevo",
    source: "WhatsApp",
    createdAt: "2026-07-25",
    lastActivity: "2026-07-28",
  },
  {
    id: "cl_5",
    name: "Robert Taylor",
    phone: "+1 289 555 0164",
    email: "rtaylor@email.com",
    address: "310 Dundas St, Oakville, ON",
    leadStatus: "perdido",
    source: "Referral",
    createdAt: "2026-05-19",
    lastActivity: "2026-06-30",
  },
  {
    id: "cl_6",
    name: "Emily Wilson",
    phone: "+1 416 555 0189",
    email: "emily.w@email.com",
    address: "77 Queen St E, Toronto, ON",
    leadStatus: "ganado",
    source: "WhatsApp",
    createdAt: "2026-03-14",
    lastActivity: "2026-07-15",
  },
];

export interface Activity {
  id: string;
  clientId: string;
  type: "call" | "whatsapp" | "note" | "estimate_sent";
  content: string;
  createdBy: string;
  createdAt: string;
}

export const activities: Activity[] = [
  { id: "act_1", clientId: "cl_1", type: "whatsapp", content: "Cliente preguntó por el precio de los pisos de cocina", createdBy: "Bot", createdAt: "2026-07-27 14:02" },
  { id: "act_2", clientId: "cl_1", type: "estimate_sent", content: "Presupuesto #EST-1042 enviado ($18,400)", createdBy: "Ana Torres", createdAt: "2026-07-24 09:30" },
  { id: "act_3", clientId: "cl_1", type: "call", content: "Llamada de seguimiento, agendó visita", createdBy: "Ana Torres", createdAt: "2026-07-20 11:00" },
  { id: "act_4", clientId: "cl_2", type: "note", content: "Contrato firmado, depósito recibido", createdBy: "Ana Torres", createdAt: "2026-07-20 16:45" },
  { id: "act_5", clientId: "cl_3", type: "whatsapp", content: "Solicita ajustar presupuesto de subcontratista eléctrico", createdBy: "Cliente", createdAt: "2026-07-29 08:15" },
];

// ---------- Communication (WhatsApp inbox) ----------
export interface WhatsAppMessage {
  id: string;
  clientId: string;
  direction: "in" | "out";
  content: string;
  sentBy: "bot" | "human";
  timestamp: string;
}

export const whatsappMessages: WhatsAppMessage[] = [
  { id: "wa_1", clientId: "cl_1", direction: "in", content: "Hola, quisiera saber el precio aproximado de renovar mi cocina", sentBy: "bot", timestamp: "2026-07-27 13:58" },
  { id: "wa_2", clientId: "cl_1", direction: "out", content: "¡Hola! Con gusto te ayudo. ¿Podrías contarme el tamaño aproximado de la cocina y qué te gustaría cambiar?", sentBy: "bot", timestamp: "2026-07-27 13:59" },
  { id: "wa_3", clientId: "cl_1", direction: "in", content: "Son unos 15 m2, quiero cambiar pisos y encimeras", sentBy: "bot", timestamp: "2026-07-27 14:02" },
  { id: "wa_4", clientId: "cl_1", direction: "out", content: "Perfecto, te preparo un estimado con nuestro catálogo. Un asesor te contactará hoy mismo.", sentBy: "bot", timestamp: "2026-07-27 14:03" },
  { id: "wa_5", clientId: "cl_3", direction: "in", content: "¿Podemos ajustar el presupuesto del electricista? Nos parece alto", sentBy: "human", timestamp: "2026-07-29 08:15" },
  { id: "wa_6", clientId: "cl_3", direction: "out", content: "Claro Mike, reviso con el subcontratista y te confirmo un nuevo número mañana.", sentBy: "human", timestamp: "2026-07-29 09:40" },
  { id: "wa_7", clientId: "cl_4", direction: "in", content: "Hola, vi su anuncio de renovaciones de baño, ¿tienen disponibilidad este mes?", sentBy: "bot", timestamp: "2026-07-28 10:20" },
  { id: "wa_8", clientId: "cl_4", direction: "out", content: "¡Hola Lisa! Sí, tenemos disponibilidad. ¿Quieres agendar una visita para cotizar?", sentBy: "bot", timestamp: "2026-07-28 10:21" },
];

export const conversationControl: Record<string, "bot" | "human"> = {
  cl_1: "bot",
  cl_3: "human",
  cl_4: "bot",
};

// ---------- Projects ----------
export type ProjectStatus = "planificacion" | "en_progreso" | "confirmado" | "completado" | "pausado";

export interface Project {
  id: string;
  clientId: string;
  estimateId: string;
  name: string;
  type: string;
  status: ProjectStatus;
  progressPercent: number;
  budgetTotal: number;
  budgetUsed: number;
  startDate: string;
  endDate: string;
  team: string[];
}

export const projects: Project[] = [
  {
    id: "proj_1",
    clientId: "cl_2",
    estimateId: "est_2",
    name: "Downtown Office Renovation",
    type: "Comercial",
    status: "en_progreso",
    progressPercent: 65,
    budgetTotal: 150000,
    budgetUsed: 97500,
    startDate: "2026-05-01",
    endDate: "2026-09-15",
    team: ["John Smith", "Sarah Johnson", "Mike Davis", "Lisa Chen"],
  },
  {
    id: "proj_2",
    clientId: "cl_6",
    estimateId: "est_3",
    name: "Residential Kitchen Remodel",
    type: "Residencial",
    status: "en_progreso",
    progressPercent: 45,
    budgetTotal: 42000,
    budgetUsed: 18900,
    startDate: "2026-06-10",
    endDate: "2026-08-20",
    team: ["Carlos Mendez", "Priya Patel"],
  },
  {
    id: "proj_3",
    clientId: "cl_2",
    estimateId: "est_4",
    name: "Commercial HVAC Installation",
    type: "Comercial",
    status: "planificacion",
    progressPercent: 20,
    budgetTotal: 68000,
    budgetUsed: 13600,
    startDate: "2026-08-01",
    endDate: "2026-10-30",
    team: ["Carlos Mendez"],
  },
  {
    id: "proj_4",
    clientId: "cl_6",
    estimateId: "est_5",
    name: "Backyard Deck Construction",
    type: "Residencial",
    status: "completado",
    progressPercent: 100,
    budgetTotal: 15400,
    budgetUsed: 14950,
    startDate: "2026-03-05",
    endDate: "2026-04-18",
    team: ["Priya Patel"],
  },
];

// ---------- Materials & Assembly ----------
export interface Material {
  id: string;
  name: string;
  unit: string;
  price: number | null;
  category: "Materiales" | "Mano de obra" | "Subcontratistas";
  supplier: string;
  isReferenceOnly: boolean;
}

export const materialsCatalog: Material[] = [
  { id: "mat_1", name: "Piso laminado premium", unit: "m2", price: 42, category: "Materiales", supplier: "Home Depot Pro", isReferenceOnly: false },
  { id: "mat_2", name: "Encimera de cuarzo", unit: "m2", price: 310, category: "Materiales", supplier: "RONA", isReferenceOnly: false },
  { id: "mat_3", name: "Pintura interior (10L)", unit: "cubeta", price: 85, category: "Materiales", supplier: "Sherwin-Williams", isReferenceOnly: false },
  { id: "mat_4", name: "Gabinetes de cocina a medida", unit: "unidad", price: null, category: "Materiales", supplier: "Proveedor local", isReferenceOnly: true },
  { id: "mat_5", name: "Drywall 1/2\"", unit: "hoja", price: 14.5, category: "Materiales", supplier: "Home Depot Pro", isReferenceOnly: false },
  { id: "mat_6", name: "Carpintero", unit: "hora", price: 55, category: "Mano de obra", supplier: "—", isReferenceOnly: false },
  { id: "mat_7", name: "Pintor", unit: "hora", price: 45, category: "Mano de obra", supplier: "—", isReferenceOnly: false },
  { id: "mat_8", name: "Ayudante general", unit: "hora", price: 32, category: "Mano de obra", supplier: "—", isReferenceOnly: false },
  { id: "mat_9", name: "Electricista certificado", unit: "servicio", price: 1200, category: "Subcontratistas", supplier: "Bright Spark Electric", isReferenceOnly: false },
  { id: "mat_10", name: "Plomero", unit: "servicio", price: 950, category: "Subcontratistas", supplier: "FlowRight Plumbing", isReferenceOnly: false },
];

export interface AssemblyTemplate {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  laborHours: number;
}

export const assemblyTemplates: AssemblyTemplate[] = [
  { id: "asm_1", name: "Pared interior estándar", description: "Drywall + pintura + mano de obra", itemCount: 6, laborHours: 12 },
  { id: "asm_2", name: "Cocina completa", description: "Pisos, encimeras, gabinetes y electricidad", itemCount: 12, laborHours: 80 },
  { id: "asm_3", name: "Baño estándar", description: "Plomería, azulejo, sanitarios", itemCount: 9, laborHours: 40 },
  { id: "asm_4", name: "Instalación de piso laminado", description: "Piso + bases + mano de obra", itemCount: 5, laborHours: 16 },
];

// ---------- Estimates ----------
export type EstimateStatus = "borrador" | "enviado" | "aceptado" | "rechazado";

export interface EstimateLine {
  zone: string;
  category: "Materiales" | "Mano de obra" | "Subcontratistas";
  item: string;
  quantity: number;
  unitCost: number;
  visibleToClient: boolean;
}

export interface Estimate {
  id: string;
  clientId: string;
  projectId: string | null;
  status: EstimateStatus;
  marginType: "global" | "section";
  marginPercent: number;
  wastePercent: number;
  lines: EstimateLine[];
  createdAt: string;
}

export const estimates: Estimate[] = [
  {
    id: "est_1",
    clientId: "cl_1",
    projectId: null,
    status: "enviado",
    marginType: "global",
    marginPercent: 25,
    wastePercent: 8,
    createdAt: "2026-07-24",
    lines: [
      { zone: "Cocina", category: "Materiales", item: "Piso laminado premium (15 m2)", quantity: 15, unitCost: 42, visibleToClient: true },
      { zone: "Cocina", category: "Materiales", item: "Encimera de cuarzo (4 m2)", quantity: 4, unitCost: 310, visibleToClient: true },
      { zone: "Cocina", category: "Mano de obra", item: "Carpintero (40 hrs)", quantity: 40, unitCost: 55, visibleToClient: false },
      { zone: "Cocina", category: "Subcontratistas", item: "Electricista certificado", quantity: 1, unitCost: 1200, visibleToClient: true },
    ],
  },
  {
    id: "est_2",
    clientId: "cl_2",
    projectId: "proj_1",
    status: "aceptado",
    marginType: "section",
    marginPercent: 22,
    wastePercent: 6,
    createdAt: "2026-04-28",
    lines: [
      { zone: "Oficina - Planta 1", category: "Materiales", item: "Drywall 1/2\" (200 hojas)", quantity: 200, unitCost: 14.5, visibleToClient: true },
      { zone: "Oficina - Planta 1", category: "Mano de obra", item: "Ayudante general (300 hrs)", quantity: 300, unitCost: 32, visibleToClient: false },
      { zone: "Oficina - Planta 2", category: "Subcontratistas", item: "Electricista certificado", quantity: 3, unitCost: 1200, visibleToClient: true },
    ],
  },
];

// ---------- Cost tracking ----------
export interface ExpenseRow {
  projectId: string;
  category: string;
  budgeted: number;
  actual: number;
}

export const expensesByProject: ExpenseRow[] = [
  { projectId: "proj_1", category: "Materiales", budgeted: 65000, actual: 68500 },
  { projectId: "proj_1", category: "Mano de obra", budgeted: 50000, actual: 48200 },
  { projectId: "proj_1", category: "Subcontratistas", budgeted: 35000, actual: 37800 },
  { projectId: "proj_2", category: "Materiales", budgeted: 22000, actual: 12400 },
  { projectId: "proj_2", category: "Mano de obra", budgeted: 15000, actual: 5300 },
  { projectId: "proj_2", category: "Subcontratistas", budgeted: 5000, actual: 1200 },
];

export const marginTrend = [
  { month: "Mar", proyectado: 24, real: 22 },
  { month: "Abr", proyectado: 25, real: 23 },
  { month: "May", proyectado: 25, real: 26 },
  { month: "Jun", proyectado: 24, real: 21 },
  { month: "Jul", proyectado: 25, real: 24 },
];

// ---------- Documents & Photos ----------
export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  tag: "contrato" | "permiso" | "plano" | "garantia";
  uploadedAt: string;
  sizeKb: number;
}

export const documents: ProjectDocument[] = [
  { id: "doc_1", projectId: "proj_1", name: "Contrato firmado - Downtown Office.pdf", tag: "contrato", uploadedAt: "2026-04-29", sizeKb: 812 },
  { id: "doc_2", projectId: "proj_1", name: "Permiso de construcción #4471.pdf", tag: "permiso", uploadedAt: "2026-05-02", sizeKb: 340 },
  { id: "doc_3", projectId: "proj_1", name: "Plano eléctrico - Planta 2.pdf", tag: "plano", uploadedAt: "2026-05-10", sizeKb: 1204 },
  { id: "doc_4", projectId: "proj_2", name: "Garantía gabinetes de cocina.pdf", tag: "garantia", uploadedAt: "2026-06-15", sizeKb: 210 },
  { id: "doc_5", projectId: "proj_2", name: "Contrato firmado - Kitchen Remodel.pdf", tag: "contrato", uploadedAt: "2026-06-11", sizeKb: 690 },
];

export interface ProjectPhoto {
  id: string;
  projectId: string;
  zone: string;
  uploadedBy: string;
  timestamp: string;
  visibleToClient: boolean;
  color: string;
}

export const photos: ProjectPhoto[] = [
  { id: "ph_1", projectId: "proj_1", zone: "Planta 1", uploadedBy: "John Smith", timestamp: "2026-07-25", visibleToClient: true, color: "oklch(0.75 0.08 60)" },
  { id: "ph_2", projectId: "proj_1", zone: "Planta 1", uploadedBy: "Sarah Johnson", timestamp: "2026-07-22", visibleToClient: true, color: "oklch(0.7 0.06 230)" },
  { id: "ph_3", projectId: "proj_1", zone: "Planta 2", uploadedBy: "Mike Davis", timestamp: "2026-07-18", visibleToClient: false, color: "oklch(0.72 0.07 150)" },
  { id: "ph_4", projectId: "proj_2", zone: "Cocina", uploadedBy: "Carlos Mendez", timestamp: "2026-07-20", visibleToClient: true, color: "oklch(0.76 0.09 40)" },
  { id: "ph_5", projectId: "proj_2", zone: "Cocina", uploadedBy: "Priya Patel", timestamp: "2026-07-14", visibleToClient: false, color: "oklch(0.7 0.05 300)" },
  { id: "ph_6", projectId: "proj_1", zone: "Exterior", uploadedBy: "John Smith", timestamp: "2026-07-10", visibleToClient: true, color: "oklch(0.68 0.06 200)" },
];

// ---------- Field (FSM) ----------
export interface Employee {
  id: string;
  name: string;
  role: string;
  phone: string;
  status: "disponible" | "en_proyecto" | "descanso";
  currentProject: string | null;
  hoursThisPeriod: number;
}

export const employees: Employee[] = [
  { id: "emp_1", name: "John Smith", role: "Carpintero jefe", phone: "+1 416 555 0201", status: "en_proyecto", currentProject: "Downtown Office Renovation", hoursThisPeriod: 78 },
  { id: "emp_2", name: "Sarah Johnson", role: "Supervisora de obra", phone: "+1 416 555 0202", status: "en_proyecto", currentProject: "Downtown Office Renovation", hoursThisPeriod: 82 },
  { id: "emp_3", name: "Mike Davis", role: "Electricista interno", phone: "+1 416 555 0203", status: "en_proyecto", currentProject: "Downtown Office Renovation", hoursThisPeriod: 65 },
  { id: "emp_4", name: "Carlos Mendez", role: "Técnico HVAC", phone: "+1 416 555 0204", status: "en_proyecto", currentProject: "Residential Kitchen Remodel", hoursThisPeriod: 74 },
  { id: "emp_5", name: "Priya Patel", role: "Acabados", phone: "+1 416 555 0205", status: "disponible", currentProject: null, hoursThisPeriod: 40 },
];

export interface Subcontractor {
  id: string;
  name: string;
  trade: string;
  phone: string;
  rating: number;
  assignedProjects: string[];
  telegramLinked: boolean;
}

export const subcontractors: Subcontractor[] = [
  { id: "sub_1", name: "Bright Spark Electric", trade: "Electricidad", phone: "+1 416 555 0311", rating: 4.8, assignedProjects: ["Downtown Office Renovation"], telegramLinked: true },
  { id: "sub_2", name: "FlowRight Plumbing", trade: "Plomería", phone: "+1 416 555 0322", rating: 4.6, assignedProjects: ["Residential Kitchen Remodel"], telegramLinked: true },
  { id: "sub_3", name: "ClearView Glass & Windows", trade: "Ventanas", phone: "+1 416 555 0333", rating: 4.9, assignedProjects: [], telegramLinked: false },
  { id: "sub_4", name: "Solid Ground Concrete", trade: "Cimentación", phone: "+1 416 555 0344", rating: 4.4, assignedProjects: ["Backyard Deck Construction"], telegramLinked: true },
];

export interface WorkOrder {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assignedTo: string;
  priority: "baja" | "media" | "alta";
  status: "pendiente" | "en_progreso" | "completada";
}

export const workOrders: WorkOrder[] = [
  { id: "wo_1", projectId: "proj_1", title: "Instalar cableado planta 2", description: "Completar circuitos antes de inspección", assignedTo: "Mike Davis", priority: "alta", status: "en_progreso" },
  { id: "wo_2", projectId: "proj_1", title: "Reparar dren exterior", description: "Filtración detectada en esquina noreste", assignedTo: "Bright Spark Electric", priority: "media", status: "pendiente" },
  { id: "wo_3", projectId: "proj_2", title: "Instalar encimera de cuarzo", description: "Confirmar medidas antes de corte", assignedTo: "Carlos Mendez", priority: "alta", status: "pendiente" },
  { id: "wo_4", projectId: "proj_2", title: "Pintura final de gabinetes", description: "Segunda capa acabado mate", assignedTo: "Priya Patel", priority: "baja", status: "completada" },
];

export interface ScheduleEvent {
  id: string;
  title: string;
  type: "visita" | "llamada" | "reunion" | "inicio" | "fin";
  projectId: string | null;
  date: string;
  time: string;
}

export const scheduleEvents: ScheduleEvent[] = [
  { id: "se_1", title: "Visita técnica - Lisa Chen", type: "visita", projectId: null, date: "2026-07-29", time: "14:30" },
  { id: "se_2", title: "Revisión de presupuesto - Sarah Johnson", type: "reunion", projectId: "proj_1", date: "2026-07-30", time: "10:00" },
  { id: "se_3", title: "Inicio de obra - Kitchen Remodel", type: "inicio", projectId: "proj_2", date: "2026-07-31", time: "08:00" },
  { id: "se_4", title: "Llamada de seguimiento - Mike Davis", type: "llamada", projectId: null, date: "2026-08-01", time: "15:00" },
  { id: "se_5", title: "Entrega final - Backyard Deck", type: "fin", projectId: "proj_4", date: "2026-08-03", time: "11:00" },
];

export interface TimeEntry {
  id: string;
  employeeId: string;
  projectId: string;
  checkIn: string;
  checkOut: string | null;
  location: string;
  approved: boolean;
}

export const timeEntries: TimeEntry[] = [
  { id: "te_1", employeeId: "emp_1", projectId: "proj_1", checkIn: "2026-07-29 07:58", checkOut: "2026-07-29 16:05", location: "128 Front St W, Toronto", approved: true },
  { id: "te_2", employeeId: "emp_2", projectId: "proj_1", checkIn: "2026-07-29 08:02", checkOut: null, location: "128 Front St W, Toronto", approved: false },
  { id: "te_3", employeeId: "emp_3", projectId: "proj_1", checkIn: "2026-07-29 07:55", checkOut: "2026-07-29 15:50", location: "128 Front St W, Toronto", approved: false },
  { id: "te_4", employeeId: "emp_4", projectId: "proj_2", checkIn: "2026-07-29 08:10", checkOut: null, location: "45 King St W, Mississauga", approved: false },
];

// ---------- Finance ----------
export interface Invoice {
  id: string;
  projectId: string;
  clientId: string;
  type: "deposito" | "parcial" | "final";
  amount: number;
  status: "pendiente" | "pagado" | "vencido";
  dueDate: string;
}

export const invoices: Invoice[] = [
  { id: "inv_1", projectId: "proj_1", clientId: "cl_2", type: "deposito", amount: 45000, status: "pagado", dueDate: "2026-05-01" },
  { id: "inv_2", projectId: "proj_1", clientId: "cl_2", type: "parcial", amount: 52500, status: "pagado", dueDate: "2026-06-15" },
  { id: "inv_3", projectId: "proj_1", clientId: "cl_2", type: "parcial", amount: 30000, status: "pendiente", dueDate: "2026-08-05" },
  { id: "inv_4", projectId: "proj_2", clientId: "cl_6", type: "deposito", amount: 12600, status: "pagado", dueDate: "2026-06-10" },
  { id: "inv_5", projectId: "proj_2", clientId: "cl_6", type: "parcial", amount: 15400, status: "vencido", dueDate: "2026-07-20" },
  { id: "inv_6", projectId: "proj_4", clientId: "cl_6", type: "final", amount: 15400, status: "pagado", dueDate: "2026-04-18" },
];

export const revenueVsExpense = [
  { month: "Feb", ingresos: 32000, gastos: 24000 },
  { month: "Mar", ingresos: 41000, gastos: 30500 },
  { month: "Abr", ingresos: 58000, gastos: 44200 },
  { month: "May", ingresos: 62500, gastos: 47800 },
  { month: "Jun", ingresos: 54000, gastos: 41200 },
  { month: "Jul", ingresos: 45200, gastos: 33900 },
];

// ---------- Users & roles ----------
export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "oficina" | "tecnico" | "subcontratista";
  status: "activo" | "invitado";
}

export const appUsers: AppUser[] = [
  { id: "usr_1", name: "Ana Torres", email: "ana@rodriguezconstruction.com", role: "admin", status: "activo" },
  { id: "usr_2", name: "David Kim", email: "david@rodriguezconstruction.com", role: "oficina", status: "activo" },
  { id: "usr_3", name: "John Smith", email: "john.smith.crew@rodriguezconstruction.com", role: "tecnico", status: "activo" },
  { id: "usr_4", name: "Bright Spark Electric", email: "ops@brightspark.ca", role: "subcontratista", status: "invitado" },
];

export const rolePermissions: Record<AppUser["role"], string[]> = {
  admin: ["Acceso total", "Facturación", "Configuración del negocio", "Gestión de usuarios"],
  oficina: ["CRM", "Presupuestos", "Facturación", "Documentos"],
  tecnico: ["Órdenes de trabajo asignadas", "Check-in/Check-out", "Fotos"],
  subcontratista: ["Sus proyectos asignados", "Check-in/Check-out", "Chat vía Telegram"],
};

// ---------- Helpers ----------
export const findClient = (id: string) => clients.find((c) => c.id === id);
export const findProject = (id: string) => projects.find((p) => p.id === id);

// Exact, to the cent. This is an invoicing product: nearly every figure on
// screen is a price somebody pays, a line a customer checks against a quote,
// or a catalogue rate. Rounding $5,748.75 to "$5,749" on a payment schedule
// is a small lie that costs trust the first time the card is charged.
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);

// For headline totals, where the cents are noise and the shape of the number
// is the point. Only for aggregates — never for anything owed.
export const formatCurrencyRounded = (value: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);

export const leadStatusLabel: Record<LeadStatus, string> = {
  nuevo: "Nuevo",
  cotizado: "Cotizado",
  negociando: "Negociando",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const projectStatusLabel: Record<ProjectStatus, string> = {
  planificacion: "Planificación",
  en_progreso: "En progreso",
  confirmado: "Confirmado",
  completado: "Completado",
  pausado: "Pausado",
};
