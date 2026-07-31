import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import { RequireBusinessAuth } from "@/components/RequireBusinessAuth";
import { RequireClientAuth } from "@/components/RequireClientAuth";
import Landing from "@/pages/Landing";
import AuthBusiness from "@/pages/AuthBusiness";
import AuthClient from "@/pages/AuthClient";
import AuthLogin from "@/pages/AuthLogin";
import AuthForgotPassword from "@/pages/AuthForgotPassword";
import WorkerAccess from "@/pages/WorkerAccess";
import ClientPortalMe from "@/pages/ClientPortalMe";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/Dashboard";
import Crm from "@/pages/Crm";
import ClientDetail from "@/pages/ClientDetail";
import ClientPortal from "@/pages/ClientPortal";
import Communication from "@/pages/Communication";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Budgets from "@/pages/Budgets";
import Materials from "@/pages/Materials";
import CostTracking from "@/pages/CostTracking";
import Contracts from "@/pages/Contracts";
import PhotoGallery from "@/pages/PhotoGallery";
import Technicians from "@/pages/Technicians";
import Subcontractors from "@/pages/Subcontractors";
import GpsRouting from "@/pages/GpsRouting";
import CheckIn from "@/pages/CheckIn";
import WorkOrders from "@/pages/WorkOrders";
import Scheduling from "@/pages/Scheduling";
import Invoicing from "@/pages/Invoicing";
import Reports from "@/pages/Reports";
import SettingsCompany from "@/pages/SettingsCompany";
import SettingsMargins from "@/pages/SettingsMargins";
import SettingsUsers from "@/pages/SettingsUsers";
import SettingsWhatsapp from "@/pages/SettingsWhatsapp";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SelectedProjectProvider } from "./contexts/SelectedProjectContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";

function BusinessPanel() {
  return (
    <RequireBusinessAuth>
      <DashboardLayout>
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
        <Route path={"/scheduling"} component={Scheduling} />
        <Route path={"/invoicing"} component={Invoicing} />
        <Route path={"/reports"} component={Reports} />
        <Route path={"/settings/company"} component={SettingsCompany} />
        <Route path={"/settings/margins"} component={SettingsMargins} />
        <Route path={"/settings/users"} component={SettingsUsers} />
        <Route path={"/settings/whatsapp"} component={SettingsWhatsapp} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
        </Switch>
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
  const { session, loading, persona } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> Cargando...
      </div>
    );
  }
  if (!session) return <Landing />;
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
    <Switch>
      <Route path={"/"} component={RootRoute} />
      <Route path={"/negocio/acceso"} component={AuthBusiness} />
      <Route path={"/cliente/acceso"} component={AuthClient} />
      <Route path={"/iniciar-sesion"} component={AuthLogin} />
      <Route path={"/recuperar-password"} component={AuthForgotPassword} />
      <Route path={"/campo"} component={WorkerAccess} />
      <Route path={"/portal"} component={ClientPortalRoute} />
      {/* Everything else is the authenticated business panel */}
      <Route component={BusinessPanel} />
    </Switch>
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
