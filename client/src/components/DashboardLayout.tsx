import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, Bell, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { AdminAssistantBar } from "@/components/AdminAssistantBar";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface NavItem {
  id: string;
  labelKey: string;
  icon: string;
  path: string;
}

interface NavSection {
  id: string;
  titleKey: string;
  icon: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: "home",
    titleKey: "nav.home",
    icon: "🏠",
    items: [{ id: "dashboard", labelKey: "nav.dashboard", icon: "📊", path: "/" }],
  },
  {
    id: "clients",
    titleKey: "nav.clients",
    icon: "👥",
    items: [
      { id: "crm", labelKey: "nav.crm", icon: "📇", path: "/crm" },
      { id: "client-portal", labelKey: "nav.clientPortal", icon: "🌐", path: "/client-portal" },
      { id: "communication", labelKey: "nav.communication", icon: "💬", path: "/communication" },
    ],
  },
  {
    id: "projects",
    titleKey: "nav.projects",
    icon: "📋",
    items: [
      { id: "projects", labelKey: "nav.projectsList", icon: "🏗️", path: "/projects" },
      { id: "budgets", labelKey: "nav.budgets", icon: "💰", path: "/budgets" },
      { id: "materials", labelKey: "nav.materials", icon: "📦", path: "/materials" },
      { id: "cost-tracking", labelKey: "nav.costTracking", icon: "📈", path: "/cost-tracking" },
      { id: "contracts", labelKey: "nav.contracts", icon: "📄", path: "/contracts" },
      { id: "photo-gallery", labelKey: "nav.photoGallery", icon: "📸", path: "/photo-gallery" },
    ],
  },
  {
    id: "field",
    titleKey: "nav.field",
    icon: "🔧",
    items: [
      { id: "technicians", labelKey: "nav.technicians", icon: "👨‍🔧", path: "/technicians" },
      { id: "subcontractors", labelKey: "nav.subcontractors", icon: "🤝", path: "/subcontractors" },
      { id: "gps-routing", labelKey: "nav.gpsRouting", icon: "📍", path: "/gps-routing" },
      { id: "check-in", labelKey: "nav.checkIn", icon: "✓", path: "/check-in" },
      { id: "work-orders", labelKey: "nav.workOrders", icon: "📋", path: "/work-orders" },
      { id: "scheduling", labelKey: "nav.scheduling", icon: "📅", path: "/scheduling" },
    ],
  },
  {
    id: "finance",
    titleKey: "nav.finance",
    icon: "💰",
    items: [
      { id: "invoicing", labelKey: "nav.invoicing", icon: "💳", path: "/invoicing" },
      { id: "reports", labelKey: "nav.reports", icon: "📊", path: "/reports" },
    ],
  },
  {
    id: "settings",
    titleKey: "nav.settings",
    icon: "⚙️",
    items: [
      { id: "company-data", labelKey: "nav.companyData", icon: "🏢", path: "/settings/company" },
      { id: "payments", labelKey: "nav.payments", icon: "💳", path: "/settings/payments" },
      { id: "margins-rules", labelKey: "nav.margins", icon: "⚖️", path: "/settings/margins" },
      { id: "users-roles", labelKey: "nav.users", icon: "👨‍💼", path: "/settings/users" },
      { id: "whatsapp-connection", labelKey: "nav.whatsapp", icon: "📱", path: "/settings/whatsapp" },
      { id: "automations", labelKey: "nav.automations", icon: "🔗", path: "/settings/automations" },
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
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { data: company } = useApi<{ name: string }>("/api/settings/company");
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
        <span>{t(item.labelKey)}</span>
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
                {company?.name ?? t("common.loading")}
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
                <span>{t(section.titleKey)}</span>
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
            <span>⚙️</span> {t("nav.settings")}
          </Link>
          <LanguageSwitcher variant="full" className="w-full" />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center text-xs font-semibold">
                  AT
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={signOut} className="gap-2 text-status-error-fg">
                  <LogOut size={14} /> {t("common.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 overflow-auto w-full">{children}</div>
        <AdminAssistantBar />
      </div>
    </div>
  );
}
