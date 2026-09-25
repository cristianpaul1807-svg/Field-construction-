import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import { RequireBusinessAuth } from "@/components/RequireBusinessAuth";
import { RequireClientAuth } from "@/components/RequireClientAuth";
import { ServerUnreachable } from "@/components/ServerUnreachable";
import { getWorkerSession } from "@/lib/workerSession";
import { getClientSession } from "@/lib/clientSession";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SelectedProjectProvider } from "./contexts/SelectedProjectContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { Suspense } from "react";
import { perezosa } from "@/lib/perezosa";

const Landing = perezosa(() => import("@/pages/Landing"));
const AuthBusiness = perezosa(() => import("@/pages/AuthBusiness"));
const AuthClient = perezosa(() => import("@/pages/AuthClient"));
const AuthLogin = perezosa(() => import("@/pages/AuthLogin"));
const AuthForgotPassword = perezosa(() => import("@/pages/AuthForgotPassword"));
const WorkerAccess = perezosa(() => import("@/pages/WorkerAccess"));
const PublicBusinessChat = perezosa(() => import("@/pages/PublicBusinessChat"));
const ClientPortalMe = perezosa(() => import("@/pages/ClientPortalMe"));
const PaginaLegal = perezosa(() => import("@/pages/PaginaLegal"));
const Suscripcion = perezosa(() => import("@/pages/Suscripcion"));
const Dashboard = perezosa(() => import("@/pages/Dashboard"));
const Crm = perezosa(() => import("@/pages/Crm"));
const ClientDetail = perezosa(() => import("@/pages/ClientDetail"));
const ClientPortal = perezosa(() => import("@/pages/ClientPortal"));
const Communication = perezosa(() => import("@/pages/Communication"));
const Projects = perezosa(() => import("@/pages/Projects"));
const ProjectDetail = perezosa(() => import("@/pages/ProjectDetail"));
const Budgets = perezosa(() => import("@/pages/Budgets"));
const Materials = perezosa(() => import("@/pages/Materials"));
const CostTracking = perezosa(() => import("@/pages/CostTracking"));
const Contracts = perezosa(() => import("@/pages/Contracts"));
const PhotoGallery = perezosa(() => import("@/pages/PhotoGallery"));
const Technicians = perezosa(() => import("@/pages/Technicians"));
const Subcontractors = perezosa(() => import("@/pages/Subcontractors"));
const GpsRouting = perezosa(() => import("@/pages/GpsRouting"));
const CheckIn = perezosa(() => import("@/pages/CheckIn"));
const WorkOrders = perezosa(() => import("@/pages/WorkOrders"));
const WorkLog = perezosa(() => import("@/pages/WorkLog"));
const TimeOff = perezosa(() => import("@/pages/TimeOff"));
const Scheduling = perezosa(() => import("@/pages/Scheduling"));
const Invoicing = perezosa(() => import("@/pages/Invoicing"));
const Payroll = perezosa(() => import("@/pages/Payroll"));
const Reports = perezosa(() => import("@/pages/Reports"));
const SettingsCompany = perezosa(() => import("@/pages/SettingsCompany"));
const SettingsServiceTypes = perezosa(() => import("@/pages/SettingsServiceTypes"));
const SettingsPayments = perezosa(() => import("@/pages/SettingsPayments"));
const SettingsQuickBooks = perezosa(() => import("@/pages/SettingsQuickBooks"));
const SettingsMargins = perezosa(() => import("@/pages/SettingsMargins"));
const SettingsUsers = perezosa(() => import("@/pages/SettingsUsers"));
const SettingsWhatsapp = perezosa(() => import("@/pages/SettingsWhatsapp"));
const SettingsMcpConnections = perezosa(() => import("@/pages/SettingsMcpConnections"));
const SettingsAfiliados = perezosa(() => import("@/pages/SettingsAfiliados"));

/** Lo que se ve el instante en que baja el trozo de la pantalla. */
function Cargando() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner className="size-4" /> {t("common.loading")}
    </div>
  );
}

function BusinessPanel() {
  return (
    <RequireBusinessAuth>
      <DashboardLayout>
        {/* Dentro del marco y no fuera: al cambiar de pantalla el menú se
            queda quieto y sólo parpadea el contenido. */}
        <Suspense fallback={<Cargando />}>
        <Switch>
        <Route path={"/"} component={Dashboard} />
        <Route path={"/crm"} component={Crm} />
        <Route path={"/crm/:id"} component={ClientDetail} />
        <Route path={"/client-portal"} component={ClientPortal} />
        <Route path={"/communication"} component={Communication} />
        <Route path={"/projects"} component={Projects} />
        <Route path={"/projects/:id"} component={ProjectDetail} />
        <Route path={"/budgets"} component={Budgets} />
        <Route path={"/materials"} component={Materials} />
        <Route path={"/cost-tracking"} component={CostTracking} />
        <Route path={"/contracts"} component={Contracts} />
        <Route path={"/photo-gallery"} component={PhotoGallery} />
        <Route path={"/technicians"} component={Technicians} />
        <Route path={"/subcontractors"} component={Subcontractors} />
        <Route path={"/gps-routing"} component={GpsRouting} />
        <Route path={"/check-in"} component={CheckIn} />
        <Route path={"/work-orders"} component={WorkOrders} />
        <Route path={"/work-log"} component={WorkLog} />
        <Route path={"/time-off"} component={TimeOff} />
        <Route path={"/scheduling"} component={Scheduling} />
        <Route path={"/invoicing"} component={Invoicing} />
        <Route path={"/payroll"} component={Payroll} />
        <Route path={"/reports"} component={Reports} />
        <Route path={"/settings/company"} component={SettingsCompany} />
        <Route path={"/settings/service-types"} component={SettingsServiceTypes} />
        <Route path={"/settings/payments"} component={SettingsPayments} />
        <Route path={"/settings/quickbooks"} component={SettingsQuickBooks} />
        <Route path={"/settings/margins"} component={SettingsMargins} />
        <Route path={"/settings/users"} component={SettingsUsers} />
        <Route path={"/settings/mcp-connections"} component={SettingsMcpConnections} />
        {/* Enrutada y fuera del menú: el programa de afiliados no se ha
            encendido y los enlaces se dan uno a uno. Ver SettingsAfiliados. */}
        <Route path={"/settings/afiliados"} component={SettingsAfiliados} />
      <Route path={"/settings/whatsapp"} component={SettingsWhatsapp} />
      <Route path={"/suscripcion"} component={Suscripcion} />
      <Route path={"/settings/subscription"} component={Suscripcion} />
        {/* Era una pantalla aparte que enseñaba el mismo link que la de
            WhatsApp. Al fusionarlas, quien tuviera esto guardado o llegara
            desde un enlace viejo aterrizaría en el 404. */}
        <Route path={"/settings/automations"}>{() => <Redirect to="/settings/whatsapp" />}</Route>
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
        </Switch>
        </Suspense>
      </DashboardLayout>
    </RequireBusinessAuth>
  );
}

function ClientPortalRoute() {
  return (
    <RequireClientAuth>
      <ClientPortalMe />
    </RequireClientAuth>
  );
}

// "/" is ambiguous on purpose: it's the public landing page for a visitor,
// and the business dashboard's home once logged in — this decides which.
function RootRoute() {
  const { t } = useTranslation();
  const { session, loading, persona, personaError } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t("common.loading")}
      </div>
    );
  }

  // Installed as an app, this is the launch screen, and a PWA manifest can
  // only name one start_url. A worker or a code-entry client has no Supabase
  // session, so without this they relaunch straight into the marketing page —
  // which on a phone is indistinguishable from the app having dumped them in
  // the browser. Their stored session is what says which door they came in by.
  if (!session) {
    if (getWorkerSession()) return <Redirect to="/campo" />;
    if (getClientSession()) return <Redirect to="/portal" />;
    return <Landing />;
  }
  // The server didn't tell us who this is. That is not the same as "you have
  // no business yet", so it must not fall through to the signup redirect
  // below — it would look like the account had vanished.
  if (personaError) return <ServerUnreachable message={personaError} />;
  // An orphaned session (confirmed and authenticated, but never finished
  // linking a business — e.g. the old link-based confirmation email opened
  // to an unreachable localhost redirect) still has a perfectly valid,
  // already-confirmed account. Send it to /negocio/acceso, whose own effect
  // finishes provisioning with the existing session — no new email/code
  // needed. Deliberately leaving via "Volver" is what signs the user out.
  if (persona === "none") return <Redirect to="/negocio/acceso" />;
  if (persona === "client") return <ClientPortalRoute />;
  return <BusinessPanel />;
}

function Router() {
  return (
    <Suspense fallback={<Cargando />}>
    <Switch>
      <Route path={"/"} component={RootRoute} />
      <Route path={"/negocio/acceso"} component={AuthBusiness} />
      <Route path={"/cliente/acceso"} component={AuthClient} />
      <Route path={"/iniciar-sesion"} component={AuthLogin} />
      <Route path={"/recuperar-password"} component={AuthForgotPassword} />
      <Route path={"/campo"} component={WorkerAccess} />
      <Route path={"/c/:slug"} component={PublicBusinessChat} />
      <Route path={"/portal"} component={ClientPortalRoute} />
      {/* Sin sesión a propósito: Intuit y Stripe las abren desde fuera para
          revisarlas, y la Ley 25 exige que cualquiera pueda leer qué se hace
          con sus datos sin tener que entrar en ninguna parte. */}
      <Route path={"/privacy"}>{() => <PaginaLegal cual="privacy" />}</Route>
      <Route path={"/terms"}>{() => <PaginaLegal cual="terms" />}</Route>
      {/* Everything else is the authenticated business panel */}
      <Route component={BusinessPanel} />
    </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <AuthProvider>
            <SelectedProjectProvider>
              <Router />
            </SelectedProjectProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
