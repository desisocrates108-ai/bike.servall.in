import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import LanguageToggle from "./LanguageToggle";
import { roleLabel } from "../lib/labels";

const navItem =
  "flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-sm transition-colors";
const activeItem = "bg-brand text-white hover:bg-brand";

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isSuper = user?.role === "super_admin";
  const isAdmin = user?.role === "admin" || isSuper;

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col" data-testid="sidebar">
        <div className="px-6 py-6 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-brand rounded-sm flex items-center justify-center flex-shrink-0">
              <Bike className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="font-display font-black text-base leading-none tracking-tight whitespace-nowrap" data-testid="brand-name">
                {t("brand.name", "Servall CRM")}
              </div>
              <div className="overline mt-1 whitespace-nowrap" style={{ fontSize: "0.5625rem" }}>
                {t("brand.tagline", "Sales CRM")}
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/dashboard" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-dashboard">
            <LayoutDashboard className="w-4 h-4" strokeWidth={1.75} /> {t("nav.dashboard")}
          </NavLink>
          <NavLink to="/leads" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-leads">
            <ListChecks className="w-4 h-4" strokeWidth={1.75} /> {t("nav.leads")}
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-tasks">
            <CalendarClock className="w-4 h-4" strokeWidth={1.75} /> {t("nav.tasks")}
          </NavLink>
          <NavLink to="/funnel" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-funnel">
            <KanbanSquare className="w-4 h-4" strokeWidth={1.75} /> {t("nav.funnel")}
          </NavLink>
          <NavLink to="/leads/new" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-new-lead">
            <PlusCircle className="w-4 h-4" strokeWidth={1.75} /> {t("nav.new_lead")}
          </NavLink>

          {isAdmin && (
            <>
              <div className="overline mt-6 mb-2 px-4">{t("nav.admin")}</div>
              <NavLink to="/users" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-users">
                <UserCog className="w-4 h-4" strokeWidth={1.75} /> {t("nav.users")}
              </NavLink>
              <NavLink to="/branches" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-branches">
                <Building2 className="w-4 h-4" strokeWidth={1.75} /> {t("nav.branches")}
              </NavLink>
              <NavLink to="/audit-logs" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-audit-logs">
                <ScrollText className="w-4 h-4" strokeWidth={1.75} /> {t("nav.audit_logs")}
              </NavLink>
              <NavLink to="/campaigns" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-campaigns">
                <Megaphone className="w-4 h-4" strokeWidth={1.75} /> {t("nav.campaigns")}
              </NavLink>
              <NavLink to="/automation" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-automation">
                <Zap className="w-4 h-4" strokeWidth={1.75} /> {t("nav.automation")}
              </NavLink>
              {isSuper && (
                <NavLink to="/masters" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-masters">
                  <Settings className="w-4 h-4" strokeWidth={1.75} /> {t("nav.masters")}
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-zinc-200">
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
      </aside>

      <main className="flex-1 min-w-0 overflow-auto relative">
        <div className="sticky top-0 z-20 flex justify-end px-6 py-3 bg-zinc-100/90 backdrop-blur border-b border-zinc-200/50">
          <LanguageToggle />
        </div>
        {children}
      </main>
    </div>
  );
}
