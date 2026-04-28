import React, { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  ListChecks,
  KanbanSquare,
  Settings,
  LogOut,
  Bike,
  UserCog,
  PlusCircle,
  CalendarClock,
  Megaphone,
  Zap,
  Building2,
  ScrollText,
  MessageCircle,
  Menu,
  X,
  Plus,
  Contact as ContactIcon,
  BarChart3,
  BellRing,
  Plug,
  Boxes,
} from "lucide-react";
import LanguageToggle from "./LanguageToggle";
import GlobalSearch from "./GlobalSearch";
import InstallAppButton from "./InstallAppButton";
import { roleLabel } from "../lib/labels";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

const sideItem =
  "flex items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-sm transition-colors";
const sideActive = "bg-brand text-white hover:bg-brand";

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isSuper = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuper;
  const isSales = user?.role === "sales_executive";

  const SideNav = (
    <div className="flex flex-col h-full max-h-screen bg-white">
      <div className="px-5 py-5 border-b border-zinc-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-brand rounded-sm flex items-center justify-center flex-shrink-0">
            <Bike className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="font-display font-black text-base leading-none tracking-tight">
              {t("brand.name", "Servall CRM")}
            </div>
            <div className="overline mt-1" style={{ fontSize: "0.5625rem" }}>
              {t("brand.tagline", "Sales CRM")}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto" data-testid="sidebar-scroll">
        <NavLink to="/dashboard" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-dashboard">
          <LayoutDashboard className="w-4 h-4" strokeWidth={1.75} /> {t("nav.dashboard")}
        </NavLink>
        <NavLink to="/leads" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-leads">
          <ListChecks className="w-4 h-4" strokeWidth={1.75} /> {t("nav.leads")}
        </NavLink>
        <NavLink to="/tasks" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-tasks">
          <CalendarClock className="w-4 h-4" strokeWidth={1.75} /> {t("nav.tasks")}
        </NavLink>
        <NavLink to="/funnel" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-funnel">
          <KanbanSquare className="w-4 h-4" strokeWidth={1.75} /> {t("nav.funnel")}
        </NavLink>
        <NavLink to="/whatsapp" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-whatsapp">
          <MessageCircle className="w-4 h-4" strokeWidth={1.75} /> {t("nav.whatsapp", "WhatsApp")}
        </NavLink>
        <NavLink to="/contacts" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-contacts">
          <ContactIcon className="w-4 h-4" strokeWidth={1.75} /> {t("nav.contacts", "Contacts")}
        </NavLink>
        <NavLink to="/reminders" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-reminders">
          <BellRing className="w-4 h-4" strokeWidth={1.75} /> {t("nav.reminders", "Reminders")}
        </NavLink>
        <NavLink to="/stock" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-stock">
          <Boxes className="w-4 h-4" strokeWidth={1.75} /> Stock
        </NavLink>
        <NavLink to="/leads/new" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-new-lead">
          <PlusCircle className="w-4 h-4" strokeWidth={1.75} /> {t("nav.new_lead")}
        </NavLink>

        {isAdmin && (
          <div data-testid="admin-section">
            <div className="overline mt-6 mb-2 px-4">{t("nav.admin")}</div>
            <NavLink to="/reports" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-reports">
              <BarChart3 className="w-4 h-4" strokeWidth={1.75} /> {t("nav.reports")}
            </NavLink>
            {/* Super-admin only: Users, Branches, Audit Logs */}
            {isSuper && (
              <>
                <NavLink to="/users" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-users">
                  <UserCog className="w-4 h-4" strokeWidth={1.75} /> {t("nav.users")}
                </NavLink>
                <NavLink to="/branches" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-branches">
                  <Building2 className="w-4 h-4" strokeWidth={1.75} /> {t("nav.branches")}
                </NavLink>
                <NavLink to="/audit-logs" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-audit-logs">
                  <ScrollText className="w-4 h-4" strokeWidth={1.75} /> {t("nav.audit_logs")}
                </NavLink>
              </>
            )}
            <NavLink to="/campaigns" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-campaigns">
              <Megaphone className="w-4 h-4" strokeWidth={1.75} /> {t("nav.campaigns")}
            </NavLink>
            <NavLink to="/automation" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-automation">
              <Zap className="w-4 h-4" strokeWidth={1.75} /> {t("nav.automation")}
            </NavLink>
            <NavLink to="/integrations" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-integrations">
              <Plug className="w-4 h-4" strokeWidth={1.75} /> {t("nav.integrations", "Integrations")}
            </NavLink>
            {isSuper && (
              <NavLink to="/masters" onClick={() => setDrawerOpen(false)} className={({ isActive }) => `${sideItem} ${isActive ? sideActive : ""}`} data-testid="nav-masters">
                <Settings className="w-4 h-4" strokeWidth={1.75} /> {t("nav.masters")}
              </NavLink>
            )}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-zinc-200 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 bg-brand text-white rounded-sm flex items-center justify-center font-semibold uppercase text-sm">
            {user?.name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" data-testid="sidebar-user-name">{user?.name}</div>
            <div className="text-xs text-zinc-500 truncate">{roleLabel(user?.role, t)}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-sm transition-colors"
          data-testid="logout-button"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.75} /> {t("nav.logout")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-zinc-100">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 border-r border-zinc-200 flex-col" data-testid="sidebar">
        {SideNav}
      </aside>

      <main className="flex-1 min-w-0 overflow-auto relative pb-20 md:pb-0">
        {/* MOBILE TOP BAR */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-2 px-3 py-2 bg-white border-b border-zinc-200">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <button
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100 active:bg-zinc-200"
                aria-label="Menu"
                data-testid="mobile-menu-btn"
              >
                <Menu className="w-5 h-5" strokeWidth={2} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <div className="flex justify-end p-2">
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {SideNav}
            </SheetContent>
          </Sheet>
          <Link to="/dashboard" className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 bg-brand rounded-sm flex items-center justify-center flex-shrink-0">
              <Bike className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div className="font-display font-black text-sm tracking-tight truncate">
              {t("brand.name", "Servall CRM")}
            </div>
          </Link>
          <GlobalSearch />
          <InstallAppButton variant="compact" />
          <LanguageToggle />
        </div>

        {/* DESKTOP TOP BAR (search + lang) */}
        <div className="hidden md:flex sticky top-0 z-30 items-center gap-3 px-6 py-3 bg-zinc-100/90 backdrop-blur border-b border-zinc-200/50">
          <div className="flex-1 max-w-md">
            <GlobalSearch />
          </div>
          <InstallAppButton variant="compact" />
          <LanguageToggle />
        </div>

        {children}
      </main>

      {/* MOBILE BOTTOM NAV — role aware */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200 flex items-stretch justify-around"
        data-testid="bottom-nav"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <BottomTab to="/dashboard" icon={LayoutDashboard} label={t("nav.home", "Home")} testid="bottom-nav-home" />
        <BottomTab to="/leads" icon={ListChecks} label={t("nav.leads")} testid="bottom-nav-leads" />
        <BottomTab to="/tasks" icon={CalendarClock} label={t("nav.tasks")} testid="bottom-nav-tasks" />
        {isSales ? (
          <BottomTab to="/contacts" icon={ContactIcon} label={t("nav.contacts", "Contacts")} testid="bottom-nav-contacts" />
        ) : (
          <BottomTab to="/whatsapp" icon={MessageCircle} label={t("nav.whatsapp", "WhatsApp")} testid="bottom-nav-whatsapp" />
        )}
      </nav>

      {/* FAB new lead */}
      <Link
        to="/leads/new"
        className="md:hidden fixed right-4 z-50 rounded-full bg-brand text-white shadow-lg hover:bg-brand-dark active:scale-95 transition-all w-14 h-14 flex items-center justify-center"
        style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
        data-testid="fab-new-lead"
        aria-label="New lead"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

function BottomTab({ to, icon: Icon, label, testid }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center flex-1 py-2 gap-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          isActive ? "text-brand" : "text-zinc-500"
        }`
      }
      data-testid={testid}
    >
      {({ isActive }) => (
        <>
          <Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} />
          <span className="truncate max-w-full">{label}</span>
        </>
      )}
    </NavLink>
  );
}
