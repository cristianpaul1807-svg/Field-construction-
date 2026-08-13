import { useState, useEffect, type ComponentType } from "react";
import {
  Menu,
  X,
  ChevronDown,
  Bell,
  LogOut,
  LayoutDashboard,
  Contact,
  Globe,
  MessageSquare,
  Building2,
  Calculator,
  Package,
  TrendingUp,
  FileText,
  Image,
  Users,
  Handshake,
  MapPin,
  Clock,
  ClipboardList,
  Calendar,
  CreditCard,
  BarChart3,
  Wallet,
  Percent,
  UserCog,
  Smartphone,
  Zap,
  Home,
  FolderKanban,
  HardHat,
  Settings,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { AdminAssistantBar } from "@/components/AdminAssistantBar";
import { useAuth } from "@/contexts/AuthContext";
import { StripeConnectAlert } from "@/components/StripeConnectAlert";
import { useApi } from "@/lib/api";
import { formatCurrency } from "@/lib/mockData";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Monochrome line icons only — no emoji, no fills, no per-item colour. The
// icon inherits the surrounding text colour so the whole chrome reads as one
// calm, professional surface instead of a toybox of coloured glyphs.
type IconType = ComponentType<{ size?: number | string; className?: string; strokeWidth?: number | string }>;

interface NavItem {
  id: string;
  labelKey: string;
  Icon: IconType;
  path: string;
}

interface NavSection {
  id: string;
  titleKey: string;
  Icon: IconType;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    id: "home",
    titleKey: "nav.home",
    Icon: Home,
    items: [{ id: "dashboard", labelKey: "nav.dashboard", Icon: LayoutDashboard, path: "/" }],
  },
  {
    id: "clients",
    titleKey: "nav.clients",
    Icon: Users,
    items: [
      { id: "crm", labelKey: "nav.crm", Icon: Contact, path: "/crm" },
      { id: "client-portal", labelKey: "nav.clientPortal", Icon: Globe, path: "/client-portal" },
      { id: "communication", labelKey: "nav.communication", Icon: MessageSquare, path: "/communication" },
    ],
  },
  {
    id: "projects",
    titleKey: "nav.projects",
    Icon: FolderKanban,
    items: [
      { id: "projects", labelKey: "nav.projectsList", Icon: Building2, path: "/projects" },
      { id: "budgets", labelKey: "nav.budgets", Icon: Calculator, path: "/budgets" },
      { id: "materials", labelKey: "nav.materials", Icon: Package, path: "/materials" },
      { id: "cost-tracking", labelKey: "nav.costTracking", Icon: TrendingUp, path: "/cost-tracking" },
      { id: "contracts", labelKey: "nav.contracts", Icon: FileText, path: "/contracts" },
      { id: "photo-gallery", labelKey: "nav.photoGallery", Icon: Image, path: "/photo-gallery" },
    ],
  },
  {
    id: "field",
    titleKey: "nav.field",
    Icon: HardHat,
    items: [
      { id: "technicians", labelKey: "nav.technicians", Icon: Users, path: "/technicians" },
      { id: "subcontractors", labelKey: "nav.subcontractors", Icon: Handshake, path: "/subcontractors" },
      { id: "gps-routing", labelKey: "nav.gpsRouting", Icon: MapPin, path: "/gps-routing" },
      { id: "check-in", labelKey: "nav.checkIn", Icon: Clock, path: "/check-in" },
      { id: "work-orders", labelKey: "nav.workOrders", Icon: ClipboardList, path: "/work-orders" },
      { id: "scheduling", labelKey: "nav.scheduling", Icon: Calendar, path: "/scheduling" },
    ],
  },
  {
    id: "finance",
    titleKey: "nav.finance",
    Icon: Wallet,
    items: [
      { id: "invoicing", labelKey: "nav.invoicing", Icon: CreditCard, path: "/invoicing" },
      { id: "reports", labelKey: "nav.reports", Icon: BarChart3, path: "/reports" },
    ],
  },
  {
    id: "settings",
    titleKey: "nav.settings",
    Icon: Settings,
    items: [
      { id: "company-data", labelKey: "nav.companyData", Icon: Building2, path: "/settings/company" },
      { id: "payments", labelKey: "nav.payments", Icon: Wallet, path: "/settings/payments" },
      { id: "margins-rules", labelKey: "nav.margins", Icon: Percent, path: "/settings/margins" },
      { id: "users-roles", labelKey: "nav.users", Icon: UserCog, path: "/settings/users" },
      { id: "whatsapp-connection", labelKey: "nav.whatsapp", Icon: Smartphone, path: "/settings/whatsapp" },
      { id: "automations", labelKey: "nav.automations", Icon: Zap, path: "/settings/automations" },
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

interface NotificationFeed {
  count: number;
  items: {
    id: string;
    kind: "estimateToApprove" | "invoiceOverdue" | "appointmentRequest" | "changeOrderAwaiting";
    href: string;
    name: string | null;
    amount: number | null;
    at: string | null;
  }[];
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { data: company } = useApi<{ name: string }>("/api/settings/company");
  const { data: notifications } = useApi<NotificationFeed>("/api/notifications");
  const [location] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Only one section is open at a time, so the menu stays short enough to
  // read without scrolling and the category you're in is the one you see.
  const [openSection, setOpenSection] = useState<string | null>(null);

  // Any navigation closes the mobile sheet — otherwise it stays open on top
  // of the page the user just asked for.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location]);

  // Opening the menu shows the section you're already in, expanded — the
  // most likely place to want to go next is next door.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const current = navSections.find((section) => sectionContainsActive(section, location));
    setOpenSection(current?.id ?? null);
  }, [mobileNavOpen, location]);

  const SectionMenu = ({ section }: { section: NavSection }) => {
    const active = sectionContainsActive(section, location);
    // A one-item section is a plain link, not a menu that opens to reveal a
    // single option.
    if (section.items.length === 1) {
      const only = section.items[0];
      return (
        <Link
          href={only.path}
          className={cn(
            "h-8 px-3 inline-flex items-center gap-2 rounded-md text-sm transition-colors whitespace-nowrap",
            active ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
        >
          <only.Icon size={15} strokeWidth={1.75} />
          {t(only.labelKey)}
        </Link>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "h-8 px-3 inline-flex items-center gap-2 rounded-md text-sm transition-colors whitespace-nowrap",
              active ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <section.Icon size={15} strokeWidth={1.75} />
            {t(section.titleKey)}
            <ChevronDown size={13} strokeWidth={1.75} className="opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {section.items.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link
                href={item.path}
                className={cn(
                  "gap-2.5 cursor-pointer",
                  isActivePath(location, item.path) && "bg-secondary font-medium"
                )}
              >
                <item.Icon size={15} strokeWidth={1.75} className="text-muted-foreground" />
                {t(item.labelKey)}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    // A single vertically-scrolling column, the way a modern AI product reads
    // — the page itself scrolls, rather than an inner pane inside a fixed
    // sidebar shell.
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
            <div className="w-7 h-7 border border-border rounded-lg flex items-center justify-center text-foreground flex-shrink-0">
              <HardHat size={15} strokeWidth={1.75} />
            </div>
            <span className="font-medium text-foreground text-sm truncate max-w-[9rem] sm:max-w-none">
              {company?.name ?? t("common.loading")}
            </span>
          </Link>

          {!isMobile && (
            <nav className="flex items-center gap-0.5 min-w-0 overflow-x-auto ml-2">
              {navSections.map((section) => (
                <SectionMenu key={section.id} section={section} />
              ))}
            </nav>
          )}

          {/* The project selector stays in the top bar at every width. Half
              the screens in this app are scoped to one project, so hiding it
              on a phone meant the field user could read those screens but
              never change which project they were reading. */}
          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0 min-w-0">
            <ProjectSwitcher />
            <LanguageSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative w-8 h-8 rounded-md hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={t("notifications.title")}
                >
                  <Bell size={16} strokeWidth={1.75} />
                  {(notifications?.count ?? 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                      {notifications!.count > 9 ? "9+" : notifications!.count}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {t("notifications.title")}
                </div>
                {(notifications?.items ?? []).length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    {t("notifications.empty")}
                  </div>
                ) : (
                  (notifications?.items ?? []).map((item) => (
                    <DropdownMenuItem key={item.id} asChild>
                      <Link href={item.href} className="flex flex-col items-start gap-0.5 cursor-pointer">
                        <span className="text-sm text-foreground">{t(`notifications.kinds.${item.kind}`)}</span>
                        <span className="text-xs text-muted-foreground">
                          {[item.name, item.amount !== null ? formatCurrency(item.amount) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full border border-border hover:bg-secondary transition-colors flex items-center justify-center text-xs font-medium text-foreground">
                  {(company?.name ?? "?").trim().charAt(0).toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={signOut} className="gap-2 text-status-error-fg">
                  <LogOut size={14} strokeWidth={1.75} /> {t("common.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileNavOpen((open) => !open)}
                className="text-foreground"
                aria-label="Menu"
              >
                {mobileNavOpen ? <X size={18} strokeWidth={1.75} /> : <Menu size={18} strokeWidth={1.75} />}
              </Button>
            )}
          </div>
        </div>

        {isMobile && mobileNavOpen && (
          <div className="border-t border-border max-h-[75vh] overflow-y-auto px-3 py-2">
            {navSections.map((section) => {
              const active = sectionContainsActive(section, location);
              // A one-item section has nothing to expand into, so it stays a
              // plain link rather than a header that opens to reveal itself.
              if (section.items.length === 1) {
                const only = section.items[0];
                return (
                  <Link
                    key={section.id}
                    href={only.path}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-2.5 text-sm rounded-md transition-colors",
                      active ? "bg-secondary text-foreground font-medium" : "text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <only.Icon size={16} strokeWidth={1.75} className="text-muted-foreground" />
                    {t(only.labelKey)}
                  </Link>
                );
              }

              const expanded = openSection === section.id;
              return (
                <div key={section.id}>
                  <button
                    onClick={() => setOpenSection(expanded ? null : section.id)}
                    aria-expanded={expanded}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-2.5 text-sm rounded-md transition-colors",
                      active ? "text-foreground font-medium" : "text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <section.Icon size={16} strokeWidth={1.75} className="text-muted-foreground" />
                    <span className="flex-1 text-left">{t(section.titleKey)}</span>
                    <ChevronDown
                      size={15}
                      strokeWidth={1.75}
                      className={cn("text-muted-foreground transition-transform", expanded && "rotate-180")}
                    />
                  </button>
                  {expanded && (
                    <div className="pl-4 pb-1 space-y-0.5">
                      {section.items.map((item) => (
                        <Link
                          key={item.id}
                          href={item.path}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-2 py-2 text-sm rounded-md transition-colors",
                            isActivePath(location, item.path)
                              ? "bg-secondary text-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                          )}
                        >
                          <item.Icon size={15} strokeWidth={1.75} className="text-muted-foreground" />
                          {t(item.labelKey)}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </header>

      <StripeConnectAlert />
      <main className="flex-1 w-full">{children}</main>
      <AdminAssistantBar />
    </div>
  );
}
