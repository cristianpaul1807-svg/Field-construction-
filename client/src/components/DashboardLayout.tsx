import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, Bell } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";
import { business } from "@/lib/mockData";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { AdminAssistantBar } from "@/components/AdminAssistantBar";

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

interface NavSection {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: "home",
    title: "INICIO",
    icon: "🏠",
    items: [{ id: "dashboard", label: "Dashboard", icon: "📊", path: "/" }],
  },
  {
    id: "clients",
    title: "CLIENTES",
    icon: "👥",
    items: [
      { id: "crm", label: "CRM", icon: "📇", path: "/crm" },
      { id: "client-portal", label: "Client Portal", icon: "🌐", path: "/client-portal" },
      { id: "communication", label: "Communication", icon: "💬", path: "/communication" },
    ],
  },
  {
    id: "projects",
    title: "PROYECTOS",
    icon: "📋",
    items: [
      { id: "projects", label: "Projects", icon: "🏗️", path: "/projects" },
      { id: "budgets", label: "Budgets & Estimates", icon: "💰", path: "/budgets" },
      { id: "materials", label: "Materials & Costs", icon: "📦", path: "/materials" },
      { id: "cost-tracking", label: "Cost Tracking", icon: "📈", path: "/cost-tracking" },
      { id: "contracts", label: "Contracts & Documents", icon: "📄", path: "/contracts" },
      { id: "photo-gallery", label: "Photo Gallery", icon: "📸", path: "/photo-gallery" },
    ],
  },
  {
    id: "field",
    title: "CAMPO",
    icon: "🔧",
    items: [
      { id: "technicians", label: "Technicians & Crew", icon: "👨‍🔧", path: "/technicians" },
      { id: "subcontractors", label: "Subcontractors", icon: "🤝", path: "/subcontractors" },
      { id: "gps-routing", label: "GPS & Routing", icon: "📍", path: "/gps-routing" },
      { id: "check-in", label: "Check-in/Check-out", icon: "✓", path: "/check-in" },
      { id: "work-orders", label: "Work Orders", icon: "📋", path: "/work-orders" },
      { id: "scheduling", label: "Scheduling", icon: "📅", path: "/scheduling" },
    ],
  },
  {
    id: "finance",
    title: "FINANZAS",
    icon: "💰",
    items: [
      { id: "invoicing", label: "Invoicing & Payments", icon: "💳", path: "/invoicing" },
      { id: "reports", label: "Reports & Analytics", icon: "📊", path: "/reports" },
    ],
  },
  {
    id: "settings",
    title: "CONFIGURACIÓN",
    icon: "⚙️",
    items: [
      { id: "company-data", label: "Company Data", icon: "🏢", path: "/settings/company" },
      { id: "margins-rules", label: "Margins & Rules", icon: "⚖️", path: "/settings/margins" },
      { id: "users-roles", label: "Users & Roles", icon: "👨‍💼", path: "/settings/users" },
      { id: "whatsapp-connection", label: "WhatsApp Connection", icon: "📱", path: "/settings/whatsapp" },
    ],
  },
];

function isActivePath(current: string, path: string) {
  if (path === "/") return current === "/";
  return current === path || current.startsWith(`${path}/`);
}

function sectionContainsActive(section: NavSection, current: string) {
  return section.items.some((item) => isActivePath(current, item.path));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navSections.map((s) => [s.id, true]))
  );

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location, isMobile]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const active = isActivePath(location, item.path);
    return (
      <Link
        href={item.path}
        onClick={() => isMobile && setSidebarOpen(false)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors",
          active
            ? "bg-primary text-primary-foreground font-medium"
            : "text-foreground hover:bg-secondary"
        )}
      >
        <span className="text-base leading-none">{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "transition-all duration-200 border-r border-sidebar-border bg-sidebar flex flex-col fixed sm:relative h-full z-50",
          isMobile
            ? sidebarOpen
              ? "w-72"
              : "-translate-x-full w-72"
            : sidebarOpen
              ? "w-64"
              : "w-0 overflow-hidden"
        )}
      >
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-semibold text-sm flex-shrink-0">
              R
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="font-semibold text-sidebar-foreground truncate text-sm">
                {business.name}
              </h1>
              <p className="text-xs text-muted-foreground">FSM &amp; Construction Hub</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {navSections.map((section) => (
            <div key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{section.title}</span>
                <ChevronDown
                  size={14}
                  className={cn("transition-transform", expandedSections[section.id] ? "rotate-180" : "")}
                />
              </button>

              {expandedSections[section.id] && (
                <div className="space-y-0.5 mt-1 mb-2">
                  {section.items.map((item) => (
                    <NavItemComponent key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-sidebar-border space-y-0.5">
          <Link
            href="/settings/company"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary transition-colors text-foreground"
          >
            <span>⚙️</span> Settings
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full sm:w-auto min-w-0">
        <div className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-foreground"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
          <div className="flex items-center gap-3">
            <ProjectSwitcher />
            <button className="w-8 h-8 rounded-full bg-secondary hover:bg-muted transition-colors flex items-center justify-center">
              <Bell size={15} className="text-foreground" />
            </button>
            <button className="w-8 h-8 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center text-xs font-semibold">
              AT
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto w-full">{children}</div>
        <AdminAssistantBar />
      </div>
    </div>
  );
}
