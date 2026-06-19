import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { priorityClass, priorityStrip, stageClass } from "../lib/labels";
import { Search, Plus, Filter as FilterIcon, ChevronRight } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { formatDate as formatDDMMYYYY } from "../utils/exportReports";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";

const ANY = "__ANY__";
const FILTER_KEYS = ["source", "stage", "priority", "assigned_to", "branch_id"];

export default function Leads() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const [qs, setQs] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [constants, setConstants] = useState(null);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState(() => ({
    source: qs.get("source") || "",
    stage: qs.get("stage") || "",
    priority: qs.get("priority") || "",
    assigned_to: qs.get("assigned_to") || "",
    branch_id: qs.get("branch_id") || "",
    followup_due_today: qs.get("followup_due_today") === "1",
    search: qs.get("search") || "",
  }));

  const load = async () => {
    setLoading(true);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === false) return;
      params[k] = v;
    });
    const { data } = await api.get("/leads", { params });
    setLeads(data);
    setLoading(false);
  };

  useEffect(() => {
    api.get("/constants").then((r) => setConstants(r.data));
    api.get("/users").then((r) => setUsers(r.data));
    api.get("/branches").then((r) => setBranches(r.data));
  }, []);

  useEffect(() => {
    load();
    // Keep URL in sync with filters (for back/share)
    const next = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v === false || v == null) return;
      next[k] = typeof v === "boolean" ? (v ? "1" : "") : String(v);
    });
    setQs(next, { replace: true });
    /* eslint-disable-next-line */
  }, [JSON.stringify(filters)]);

  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const branchMap = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b])), [branches]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v === ANY ? "" : v }));

  const clearFilters = () =>
    setFilters({ source: "", stage: "", priority: "", assigned_to: "", branch_id: "", followup_due_today: false, search: "" });

  const hasActiveFilter = useMemo(
    () => Object.entries(filters).some(([k, v]) => k !== "search" && v !== "" && v !== false && v != null),
    [filters]
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.stage) chips.push({ k: "stage", label: `Stage: ${filters.stage}` });
    if (filters.source) chips.push({ k: "source", label: `Source: ${filters.source}` });
    if (filters.priority) chips.push({ k: "priority", label: `Priority: ${filters.priority}` });
    if (filters.assigned_to) {
      const u = userMap[filters.assigned_to];
      chips.push({ k: "assigned_to", label: `Exec: ${u?.name || filters.assigned_to.slice(0, 6)}` });
    }
    if (filters.branch_id) {
      const b = branchMap[filters.branch_id];
      chips.push({ k: "branch_id", label: `Branch: ${b?.name || filters.branch_id.slice(0, 6)}` });
    }
    if (filters.followup_due_today) chips.push({ k: "followup_due_today", label: "Due today" });
    return chips;
  }, [filters, userMap, branchMap]);

  return (
    <>
      <PageHeader
        title={t("nav.leads")}
        subtitle={`${leads.length} ${t("common.total", "total").toLowerCase()}${hasActiveFilter ? " · filtered" : ""}`}
        showBack={hasActiveFilter}
        sticky
        right={
          <Link to="/leads/new" className="hidden sm:block">
            <Button className="rounded-sm bg-brand hover:bg-brand-dark font-bold h-10" data-testid="new-lead-btn">
              <Plus className="w-4 h-4 mr-1" /> {t("nav.new_lead")}
            </Button>
          </Link>
        }
      />
      <div className="p-3 sm:p-6 max-w-[1500px] mx-auto w-full">

      <div className="bg-white border border-zinc-200 rounded-sm p-3 mb-3">
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3" data-testid="active-filter-chips">
            {activeFilterChips.map((c) => (
              <button
                key={c.k}
                onClick={() => setF(c.k, c.k === "followup_due_today" ? false : "")}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold rounded-sm bg-brand/10 text-brand hover:bg-brand/20"
                data-testid={`chip-${c.k}`}
              >
                {c.label} <span className="text-brand/70">×</span>
              </button>
            ))}
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 ml-1"
              data-testid="clear-all-chips"
            >
              Clear all
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder={t("common.search")}
              value={filters.search}
              onChange={(e) => setF("search", e.target.value)}
              className="pl-9 rounded-sm h-10"
              data-testid="search-input"
            />
          </div>

          <Select value={filters.source || ANY} onValueChange={(v) => setF("source", v)}>
            <SelectTrigger className="w-[140px] rounded-sm h-10" data-testid="filter-source"><SelectValue placeholder={t("lead.source")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("common.all")}</SelectItem>
              {constants?.lead_sources?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.stage || ANY} onValueChange={(v) => setF("stage", v)}>
            <SelectTrigger className="w-[130px] rounded-sm h-10" data-testid="filter-stage"><SelectValue placeholder={t("lead.stage")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("common.all")}</SelectItem>
              {constants?.stages?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.priority || ANY} onValueChange={(v) => setF("priority", v)}>
            <SelectTrigger className="w-[120px] rounded-sm h-10" data-testid="filter-priority"><SelectValue placeholder={t("lead.priority")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t("common.all")}</SelectItem>
              {constants?.priorities?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {(user?.role === "admin" || user?.role === "super_admin") && (
            <Select value={filters.assigned_to || ANY} onValueChange={(v) => setF("assigned_to", v)}>
              <SelectTrigger className="w-[160px] rounded-sm h-10" data-testid="filter-exec"><SelectValue placeholder={t("lead.assigned_to")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("common.all")}</SelectItem>
                {users.filter((u) => u.role === "sales_executive").map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {user?.role === "super_admin" && (
            <Select value={filters.branch_id || ANY} onValueChange={(v) => setF("branch_id", v)}>
              <SelectTrigger className="w-[140px] rounded-sm h-10" data-testid="filter-branch"><SelectValue placeholder={t("lead.branch")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("common.all")}</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Button variant="outline" className="rounded-sm h-10" onClick={clearFilters} data-testid="clear-filters-btn">
            <FilterIcon className="w-4 h-4 mr-1" /> {t("common.refresh", "Clear")}
          </Button>
        </div>
      </div>

      {/* MOBILE: card list */}
      <div className="sm:hidden space-y-2" data-testid="leads-cards">
        {loading && <div className="py-8 text-center text-zinc-400 text-sm">{t("common.loading")}</div>}
        {!loading && leads.length === 0 && (
          <div className="py-12 text-center text-zinc-400 text-sm">No leads match the filters.</div>
        )}
        {leads.map((l) => (
          <Link
            key={l.id}
            to={`/leads/${l.id}`}
            className={`block bg-white border rounded-sm p-3 active:bg-zinc-50 ${priorityStrip(l.priority)}`}
            data-testid={`lead-row-${l.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{l.customer_name}</div>
                <div className="text-xs text-zinc-500 font-mono mt-0.5">{l.phone}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${stageClass(l.stage)}`}>
                    {l.stage}
                  </span>
                  <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${priorityClass(l.priority)}`}>
                    {l.priority}
                  </span>
                  <span className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600">
                    {l.source}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-1.5 flex flex-wrap gap-x-3">
                  {userMap[l.assigned_to]?.name && <span>{userMap[l.assigned_to].name}</span>}
                  {l.next_followup_date && <span className="font-mono">→ {l.next_followup_date}</span>}
                  {l.created_at && (
                    <span className="font-mono text-zinc-400" data-testid={`lead-created-${l.id}`}>
                      Created: {formatDDMMYYYY(l.created_at)}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 mt-2 flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      {/* DESKTOP: table */}
      <div className="hidden sm:block bg-white border border-zinc-200 rounded-sm overflow-hidden" data-testid="leads-table">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th></th>
                <th>{t("common.name")}</th>
                <th>{t("common.phone")}</th>
                <th>{t("lead.source")}</th>
                <th>{t("lead.stage")}</th>
                <th>{t("lead.assigned_to")}</th>
                <th>{t("lead.branch")}</th>
                <th>{t("lead.followups")}</th>
                <th>Created Date</th>
                <th>{t("lead.priority")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="py-8 text-center text-zinc-400">{t("common.loading")}</td></tr>
              )}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={10} className="py-12 text-center text-zinc-400">No leads match the filters.</td></tr>
              )}
              {leads.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => nav(`/leads/${l.id}`)}
                  className={`cursor-pointer ${priorityStrip(l.priority)}`}
                  data-testid={`lead-row-desk-${l.id}`}
                >
                  <td className="w-1"></td>
                  <td className="font-semibold">{l.customer_name}</td>
                  <td className="font-mono text-sm">{l.phone}</td>
                  <td>{l.source}</td>
                  <td>
                    <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider ${stageClass(l.stage)}`}>
                      {l.stage}
                    </span>
                  </td>
                  <td className="text-zinc-600">{userMap[l.assigned_to]?.name || "—"}</td>
                  <td className="text-zinc-600">{branchMap[l.branch_id]?.name || "—"}</td>
                  <td className="font-mono text-sm text-zinc-600">{l.next_followup_date || "—"}</td>
                  <td className="font-mono text-sm text-zinc-600" data-testid={`lead-created-desk-${l.id}`}>{l.created_at ? formatDDMMYYYY(l.created_at) : "—"}</td>
                  <td>
                    <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider border ${priorityClass(l.priority)}`}>
                      {l.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </>
  );
}
