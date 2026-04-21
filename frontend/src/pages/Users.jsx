import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { roleLabel } from "../lib/labels";
import { UserPlus, Pencil, BarChart3 } from "lucide-react";

const emptyForm = () => ({
  email: "", name: "", password: "", phone: "",
  role: "sales_executive", branch_id: "",
  reporting_manager_id: "", joining_date: "",
  is_active: true,
});

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const [filterRole, setFilterRole] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [qText, setQText] = useState("");

  const [perfOpen, setPerfOpen] = useState(false);
  const [perf, setPerf] = useState(null);

  const reload = async () => {
    const params = new URLSearchParams();
    if (filterRole) params.set("role", filterRole);
    if (filterBranch) params.set("branch_id", filterBranch);
    if (filterStatus) params.set("status", filterStatus);
    if (qText) params.set("q", qText);
    const { data } = await api.get(`/users?${params.toString()}`);
    setUsers(data);
  };

  useEffect(() => {
    api.get("/branches").then((r) => setBranches(r.data));
    reload();
    // eslint-disable-next-line
  }, []);

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [filterRole, filterBranch, filterStatus, qText]);

  const branchMap = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b])), [branches]);
  const managerOptions = useMemo(
    () => users.filter((u) => u.role === "admin" || u.role === "super_admin"),
    [users]
  );

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u.id);
    setForm({
      email: u.email,
      name: u.name || "",
      password: "",
      phone: u.phone || "",
      role: u.role,
      branch_id: u.branch_id || "",
      reporting_manager_id: u.reporting_manager_id || "",
      joining_date: u.joining_date || "",
      is_active: u.is_active !== false,
    });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        branch_id: form.branch_id || null,
        reporting_manager_id: form.reporting_manager_id || null,
        joining_date: form.joining_date || null,
        phone: form.phone || null,
      };
      if (editing) {
        if (!payload.password) delete payload.password;
        delete payload.email;
        await api.put(`/users/${editing}`, payload);
        toast.success("User updated");
      } else {
        await api.post("/users", payload);
        toast.success("User created");
      }
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const showPerf = async (uid) => {
    try {
      const { data } = await api.get(`/users/${uid}/performance`);
      setPerf(data);
      setPerfOpen(true);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-[1400px]">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="overline mb-2">Team</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">Users</h1>
        </div>
        <Button onClick={openNew} className="rounded-sm bg-zinc-900 hover:bg-zinc-800 font-bold" data-testid="add-user-btn">
          <UserPlus className="w-4 h-4 mr-1" /> Add user
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="Search name / email / phone"
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          className="h-9 max-w-[240px]"
          data-testid="users-filter-search"
        />
        <Select value={filterRole || "__ALL__"} onValueChange={(v) => setFilterRole(v === "__ALL__" ? "" : v)}>
          <SelectTrigger className="h-9 w-[180px]" data-testid="users-filter-role"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All roles</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="admin">Branch Admin</SelectItem>
            <SelectItem value="sales_executive">Sales Executive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterBranch || "__ALL__"} onValueChange={(v) => setFilterBranch(v === "__ALL__" ? "" : v)}>
          <SelectTrigger className="h-9 w-[180px]" data-testid="users-filter-branch"><SelectValue placeholder="Branch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All branches</SelectItem>
            {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus || "__ALL__"} onValueChange={(v) => setFilterStatus(v === "__ALL__" ? "" : v)}>
          <SelectTrigger className="h-9 w-[140px]" data-testid="users-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-zinc-400">No users.</td></tr>}
            {users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.id}`}>
                <td className="font-semibold">{u.name}</td>
                <td className="font-mono text-sm">{u.phone || "—"}</td>
                <td className="font-mono text-sm">{u.email}</td>
                <td>{roleLabel(u.role)}</td>
                <td>{branchMap[u.branch_id]?.name || "—"}</td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="flex gap-1">
                  <Button size="sm" variant="outline" className="rounded-sm" onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-sm" onClick={() => showPerf(u.id)} data-testid={`perf-user-${u.id}`}>
                    <BarChart3 className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm()); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
            <DialogDescription>
              Required: Name, Email, Phone, Role. Phone must be unique. Reporting manager optional.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="overline">Full Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2" data-testid="new-user-name" />
              </div>
              <div>
                <Label className="overline">Phone (unique)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-2" data-testid="new-user-phone" />
              </div>
              <div>
                <Label className="overline">Email</Label>
                <Input required type="email" disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2" data-testid="new-user-email" />
              </div>
              <div>
                <Label className="overline">Password {editing && <span className="text-zinc-400 normal-case">(leave blank to keep)</span>}</Label>
                <Input required={!editing} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-2" data-testid="new-user-password" />
              </div>
              <div>
                <Label className="overline">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="mt-2" data-testid="new-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_executive">Sales Executive</SelectItem>
                    <SelectItem value="admin">Branch Admin</SelectItem>
                    {user?.role === "super_admin" && <SelectItem value="super_admin">Super Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Branch</Label>
                <Select value={form.branch_id || "__NONE__"} onValueChange={(v) => setForm({ ...form, branch_id: v === "__NONE__" ? "" : v })}>
                  <SelectTrigger className="mt-2" data-testid="new-user-branch"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Reporting Manager</Label>
                <Select value={form.reporting_manager_id || "__NONE__"} onValueChange={(v) => setForm({ ...form, reporting_manager_id: v === "__NONE__" ? "" : v })}>
                  <SelectTrigger className="mt-2" data-testid="new-user-manager"><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {managerOptions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({roleLabel(m.role)})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Joining Date</Label>
                <Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} className="mt-2" data-testid="new-user-joining" />
              </div>
            </div>

            {editing && (
              <label className="flex items-center gap-2 text-sm pt-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  data-testid="user-active-toggle"
                />
                Active (uncheck to disable login)
              </label>
            )}

            {/* Future-ready permissions placeholder */}
            <div className="border-t border-zinc-200 pt-3 mt-3">
              <div className="overline mb-1">Module Permissions</div>
              <div className="text-xs text-zinc-500">
                Role-based access is enforced today. Fine-grained module/action permissions are
                coming soon — the structure is reserved on each user record.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800" data-testid="save-user-btn">
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Performance Dialog */}
      <Dialog open={perfOpen} onOpenChange={setPerfOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User performance</DialogTitle>
            <DialogDescription>Lifetime counters across leads and follow-ups.</DialogDescription>
          </DialogHeader>
          {perf && (
            <div className="space-y-3">
              <div className="font-semibold text-lg">{perf.name}</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["leads_total", "Leads handled"],
                  ["leads_delivered", "Conversions"],
                  ["leads_lost", "Lost"],
                  ["leads_pending", "Pending"],
                  ["followups_total", "Follow-ups"],
                  ["conversion_rate_pct", "Conv. rate %"],
                ].map(([k, label]) => (
                  <div key={k} className="bg-zinc-50 border border-zinc-200 rounded-sm p-3">
                    <div className="overline">{label}</div>
                    <div className="font-mono text-2xl font-bold mt-1" data-testid={`perf-${k}`}>{perf[k] ?? 0}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
