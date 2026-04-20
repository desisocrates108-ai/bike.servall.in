import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  KanbanSquare,
  Settings,
  LogOut,
  Bike,
  UserCog,
  PlusCircle,
} from "lucide-react";
import { roleLabel } from "../lib/labels";

const navItem =
  "flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-sm transition-colors";
const activeItem = "bg-zinc-900 text-white hover:bg-zinc-900";

export default function Layout({ children }) {
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
            <div className="w-9 h-9 bg-zinc-900 rounded-sm flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-black text-lg leading-none tracking-tight">TORQUE</div>
              <div className="overline mt-1" style={{ fontSize: "0.5625rem" }}>Sales CRM</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/dashboard" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-dashboard">
            <LayoutDashboard className="w-4 h-4" strokeWidth={1.75} /> Dashboard
          </NavLink>
          <NavLink to="/leads" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-leads">
            <ListChecks className="w-4 h-4" strokeWidth={1.75} /> Leads
          </NavLink>
          <NavLink to="/funnel" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-funnel">
            <KanbanSquare className="w-4 h-4" strokeWidth={1.75} /> Sales Funnel
          </NavLink>
          <NavLink to="/leads/new" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-new-lead">
            <PlusCircle className="w-4 h-4" strokeWidth={1.75} /> New Lead
          </NavLink>

          {isAdmin && (
            <>
              <div className="overline mt-6 mb-2 px-4">Admin</div>
              <NavLink to="/users" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-users">
                <UserCog className="w-4 h-4" strokeWidth={1.75} /> Users
              </NavLink>
              {isSuper && (
                <NavLink to="/masters" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`} data-testid="nav-masters">
                  <Settings className="w-4 h-4" strokeWidth={1.75} /> Master Data
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-zinc-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 bg-zinc-900 text-white rounded-sm flex items-center justify-center font-semibold uppercase text-sm">
              {user?.name?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" data-testid="sidebar-user-name">{user?.name}</div>
              <div className="text-xs text-zinc-500 truncate">{roleLabel(user?.role)}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-sm transition-colors"
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
