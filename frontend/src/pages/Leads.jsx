import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { priorityClass, priorityStrip, stageClass } from "../lib/labels";
import { Search, Plus, Filter as FilterIcon } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";

const ANY = "__ANY__";

export default function Leads() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [constants, setConstants] = useState(null);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    source: "", stage: "", priority: "", assigned_to: "", branch_id: "",
    followup_due_today: false, search: "",
  });

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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [JSON.stringify(filters)]);

  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const branchMap = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b])), [branches]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v === ANY ? "" : v }));

  const clearFilters = () =>
    setFilters({ source: "", stage: "", priority: "", assigned_to: "", branch_id: "", followup_due_today: false, search: "" });

  return (
    <div className="p-6 md:p-10 max-w-[1500px]">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="overline mb-2">All Leads</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
            Leads <span className="text-zinc-400 font-mono">/ {leads.length}</span>
          </h1>
        </div>
        <Link to="/leads/new">
          <Button className="rounded-sm bg-zinc-900 hover:bg-zinc-800 font-bold" data-testid="new-lead-btn">
            <Plus className="w-4 h-4 mr-1" /> New Lead
          </Button>
        </Link>
      </div>

      <div className="bg-white border border-zinc-200 rounded-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder="Search name or phone..."
              value={filters.search}
              onChange={(e) => setF("search", e.target.value)}
              className="pl-9 rounded-sm"
              data-testid="search-input"
            />
          </div>

          <Select value={filters.source || ANY} onValueChange={(v) => setF("source", v)}>
            <SelectTrigger className="w-[160px] rounded-sm" data-testid="filter-source"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All sources</SelectItem>
              {constants?.lead_sources?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.stage || ANY} onValueChange={(v) => setF("stage", v)}>
            <SelectTrigger className="w-[150px] rounded-sm" data-testid="filter-stage"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All stages</SelectItem>
              {constants?.stages?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.priority || ANY} onValueChange={(v) => setF("priority", v)}>
            <SelectTrigger className="w-[130px] rounded-sm" data-testid="filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any priority</SelectItem>
              {constants?.priorities?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {(user?.role === "admin" || user?.role === "super_admin") && (
            <Select value={filters.assigned_to || ANY} onValueChange={(v) => setF("assigned_to", v)}>
              <SelectTrigger className="w-[170px] rounded-sm" data-testid="filter-exec"><SelectValue placeholder="Sales Exec" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any exec</SelectItem>
                {users.filter((u) => u.role === "sales_executive").map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {user?.role === "super_admin" && (
            <Select value={filters.branch_id || ANY} onValueChange={(v) => setF("branch_id", v)}>
              <SelectTrigger className="w-[150px] rounded-sm" data-testid="filter-branch"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All branches</SelectItem>
                {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <label className="flex items-center gap-2 text-sm ml-auto select-none">
            <input
              type="checkbox"
              checked={filters.followup_due_today}
              onChange={(e) => setFilters((f) => ({ ...f, followup_due_today: e.target.checked }))}
              data-testid="filter-due-today"
            />
            Follow-up due today
          </label>

          <Button variant="outline" className="rounded-sm" onClick={clearFilters} data-testid="clear-filters-btn">
            <FilterIcon className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden" data-testid="leads-table">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th></th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Stage</th>
                <th>Sales Exec</th>
                <th>Branch</th>
                <th>Follow-up</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="py-8 text-center text-zinc-400">Loading...</td></tr>
              )}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center text-zinc-400">No leads match the filters.</td></tr>
              )}
              {leads.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => nav(`/leads/${l.id}`)}
                  className={`cursor-pointer ${priorityStrip(l.priority)}`}
                  data-testid={`lead-row-${l.id}`}
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
  );
}
