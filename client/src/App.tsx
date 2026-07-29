import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
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
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
