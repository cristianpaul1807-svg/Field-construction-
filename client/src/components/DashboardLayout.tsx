import { useState, useEffect } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

interface NavSection {
  id: string;
  title: string;
  icon: string;
  items: NavItem[];
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  onNavClick?: (itemId: string) => void;
  activeSection?: string;
}

export default function DashboardLayout({
  children,
  onNavClick,
  activeSection = "dashboard",
}: DashboardLayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [expandedSections, setExpandedSections] = useState({
    home: true,
    clients: true,
    projects: true,
    field: true,
    finance: true,
    settings: false,
  });

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [activeSection, isMobile]);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const navSections: NavSection[] = [
    {
      id: "home",
      title: "INICIO",
      icon: "🏠",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          icon: "📊",
          active: activeSection === "dashboard",
        },
      ],
    },
    {
      id: "clients",
      title: "CLIENTES",
      icon: "👥",
      items: [
        {
          id: "crm",
          label: "CRM",
          icon: "📇",
          active: activeSection === "crm",
        },
        {
          id: "client-portal",
          label: "Client Portal",
          icon: "🌐",
          active: activeSection === "client-portal",
        },
        {
          id: "communication",
          label: "Communication",
          icon: "💬",
          active: activeSection === "communication",
        },
      ],
    },
    {
      id: "projects",
      title: "PROYECTOS",
      icon: "📋",
      items: [
        {
          id: "projects",
          label: "Projects",
          icon: "🏗️",
          active: activeSection === "projects",
        },
        {
          id: "budgets",
          label: "Budgets & Estimates",
          icon: "💰",
          active: activeSection === "budgets",
        },
        {
          id: "materials",
          label: "Materials & Costs",
          icon: "📦",
          active: activeSection === "materials",
        },
        {
          id: "cost-tracking",
          label: "Cost Tracking",
          icon: "📈",
          active: activeSection === "cost-tracking",
        },
        {
          id: "contracts",
          label: "Contracts & Documents",
          icon: "📄",
          active: activeSection === "contracts",
        },
        {
          id: "photo-gallery",
          label: "Photo Gallery",
          icon: "📸",
          active: activeSection === "photo-gallery",
        },
      ],
    },
    {
      id: "field",
      title: "CAMPO",
      icon: "🔧",
      items: [
        {
          id: "technicians",
          label: "Technicians & Crew",
          icon: "👨‍🔧",
          active: activeSection === "technicians",
        },
        {
          id: "subcontractors",
          label: "Subcontractors",
          icon: "🤝",
          active: activeSection === "subcontractors",
        },
        {
          id: "gps-routing",
          label: "GPS & Routing",
          icon: "📍",
          active: activeSection === "gps-routing",
        },
        {
          id: "check-in",
          label: "Check-in/Check-out",
          icon: "✓",
          active: activeSection === "check-in",
        },
        {
          id: "work-orders",
          label: "Work Orders",
          icon: "📋",
          active: activeSection === "work-orders",
        },
        {
          id: "scheduling",
          label: "Scheduling",
          icon: "📅",
          active: activeSection === "scheduling",
        },
      ],
    },
    {
      id: "finance",
      title: "FINANZAS",
      icon: "💰",
      items: [
        {
          id: "invoicing",
          label: "Invoicing & Payments",
          icon: "💳",
          active: activeSection === "invoicing",
        },
        {
          id: "reports",
          label: "Reports & Analytics",
          icon: "📊",
          active: activeSection === "reports",
        },
      ],
    },
    {
      id: "settings",
      title: "CONFIGURACIÓN",
      icon: "⚙️",
      items: [
        {
          id: "company-data",
          label: "Company Data",
          icon: "🏢",
          active: activeSection === "company-data",
        },
        {
          id: "materials-catalog",
          label: "Materials Catalog",
          icon: "📚",
          active: activeSection === "materials-catalog",
        },
        {
          id: "assembly-templates",
          label: "Assembly Templates",
          icon: "🧩",
          active: activeSection === "assembly-templates",
        },
        {
          id: "margins-rules",
          label: "Margins & Rules",
          icon: "⚖️",
          active: activeSection === "margins-rules",
        },
        {
          id: "users-roles",
          label: "Users & Roles",
          icon: "👨‍💼",
          active: activeSection === "users-roles",
        },
      ],
    },
  ];

  const NavItemComponent = ({ item }: { item: NavItem }) => (
    <button
      onClick={() => {
        onNavClick?.(item.id);
        if (isMobile) {
          setSidebarOpen(false);
        }
      }}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-md transition-colors",
        item.active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-foreground hover:bg-secondary text-secondary-foreground"
      )}
    >
      <span className="text-lg">{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "transition-all duration-300 border-r border-border bg-sidebar flex flex-col fixed sm:relative h-full z-50",
          isMobile
            ? sidebarOpen
              ? "w-72"
              : "-translate-x-full w-72"
            : sidebarOpen
              ? "w-64"
              : "w-0"
        )}
      >
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              ⚙️
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="font-semibold text-foreground truncate">FSM Hub</h1>
              <p className="text-xs text-muted-foreground">Construction</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {navSections.map((section) => (
            <div key={section.id}>
              <button
                onClick={() =>
                  toggleSection(section.id as keyof typeof expandedSections)
                }
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>{section.icon}</span>
                  <span>{section.title}</span>
                </div>
                <ChevronDown
                  size={14}
                  className={cn(
                    "transition-transform",
                    expandedSections[section.id as keyof typeof expandedSections]
                      ? "rotate-180"
                      : ""
                  )}
                />
              </button>

              {expandedSections[section.id as keyof typeof expandedSections] && (
                <div className="space-y-1 mt-1">
                  {section.items.map((item) => (
                    <NavItemComponent key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border space-y-2">
          <button className="w-full px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors text-foreground text-left">
            <span>⚙️ Settings</span>
          </button>
          <button className="w-full px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors text-foreground text-left">
            <span>❓ Help</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full sm:w-auto">
        {/* Top Bar */}
        <div className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-foreground"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="w-8 h-8 rounded-full bg-secondary hover:bg-muted transition-colors flex items-center justify-center text-sm">
              🔔
            </button>
            <button className="w-8 h-8 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center text-sm font-bold">
              JD
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto w-full">{children}</div>
      </div>
    </div>
  );
}
