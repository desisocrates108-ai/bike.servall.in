import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { ScrollText, RefreshCw, Filter } from "lucide-react";

const ACTIONS = [
  "login", "logout", "login_failed",
  "lead_created", "lead_updated", "stage_changed", "deal_closed", "lead_lost",
  "followup_created",
  "user_created", "user_updated", "user_deleted",
  "branch_created", "branch_updated", "branch_deleted",
];

const actionColor = (a) => {
  if (a.includes("failed") || a.includes("deleted") || a === "lead_lost") return "bg-rose-100 text-rose-700";
  if (a === "deal_closed") return "bg-emerald-100 text-emerald-700";
  if (a === "login" || a === "logout") return "bg-blue-100 text-blue-700";
  if (a.includes("created")) return "bg-indigo-100 text-indigo-700";
  if (a.includes("updated") || a === "stage_changed") return "bg-amber-100 text-amber-700";
  return "bg-zinc-100 text-zinc-700";
};

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  const reload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUser) params.set("user_id", filterUser);
      if (filterAction) params.set("action", filterAction);
      if (filterEntity) params.set("entity_type", filterEntity);
      if (since) params.set("since", `${since}T00:00:00`);
      if (until) params.set("until", `${until}T23:59:59`);
      params.set("limit", "300");
      const { data } = await api.get(`/audit-logs?${params.toString()}`);
      setLogs(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    api.get("/users").then((r) => setUsers(r.data));
    // eslint-disable-next-line
  }, []);

  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  return (
    <div className="p-6 md:p-10 max-w-[1400px]">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="overline mb-2">Security</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
            <ScrollText className="w-8 h-8 text-zinc-400" /> Audit Logs
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            Append-only trail of every sensitive action — login attempts, lead changes, deals closed.
            {user?.role === "admin" && " You see your branch activity only."}
          </p>
        </div>
        <Button onClick={reload} variant="outline" className="rounded-sm" disabled={loading} data-testid="audit-refresh">
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-zinc-200 rounded-sm p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-zinc-400" />
          <div className="overline">Filters</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <Label className="overline text-[10px]">User</Label>
            <Select value={filterUser || "__ALL__"} onValueChange={(v) => setFilterUser(v === "__ALL__" ? "" : v)}>
              <SelectTrigger className="h-9 mt-1" data-testid="audit-filter-user"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">Any user</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="overline text-[10px]">Action</Label>
            <Select value={filterAction || "__ALL__"} onValueChange={(v) => setFilterAction(v === "__ALL__" ? "" : v)}>
              <SelectTrigger className="h-9 mt-1" data-testid="audit-filter-action"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">Any action</SelectItem>
                {ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="overline text-[10px]">Entity</Label>
            <Select value={filterEntity || "__ALL__"} onValueChange={(v) => setFilterEntity(v === "__ALL__" ? "" : v)}>
              <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">Any</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="branch">Branch</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="overline text-[10px]">From</Label>
            <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="overline text-[10px]">To</Label>
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="h-9 mt-1" />
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button onClick={reload} size="sm" className="bg-brand hover:bg-brand-dark rounded-sm" data-testid="audit-apply-filters">
            Apply
          </Button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>When</th><th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-zinc-400">No audit events match the filters.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id} data-testid={`audit-row-${l.id}`}>
                <td className="font-mono text-xs text-zinc-500">{new Date(l.created_at).toLocaleString()}</td>
                <td className="font-semibold">{l.actor_name || userMap[l.actor_id]?.name || <span className="text-zinc-400">—</span>}</td>
                <td className="text-xs">{l.actor_role || "—"}</td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${actionColor(l.action)}`}>
                    {l.action}
                  </span>
                </td>
                <td className="font-mono text-xs">
                  {l.entity_type ? `${l.entity_type}${l.entity_id ? `:${l.entity_id.slice(0, 8)}` : ""}` : "—"}
                </td>
                <td className="font-mono text-[11px] text-zinc-600 max-w-md truncate">
                  {Object.keys(l.meta || {}).length > 0 ? JSON.stringify(l.meta) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
