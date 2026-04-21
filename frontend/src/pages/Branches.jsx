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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BarChart3, MapPin } from "lucide-react";

const emptyForm = () => ({
  name: "", code: "", city: "", address: "",
  assigned_admin_id: "",
  is_active: true,
  allow_login_when_inactive: true,
});

export default function Branches() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const [perfOpen, setPerfOpen] = useState(false);
  const [perf, setPerf] = useState(null);

  const isSuper = user?.role === "super_admin";

  const reload = () => api.get("/branches").then((r) => setBranches(r.data));

  useEffect(() => {
    reload();
    api.get("/users?role=admin").then((r) => setAdmins(r.data));
  }, []);

  const adminMap = useMemo(() => Object.fromEntries(admins.map((a) => [a.id, a])), [admins]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (b) => {
    setEditing(b.id);
    setForm({
      name: b.name || "",
      code: b.code || "",
      city: b.city || "",
      address: b.address || "",
      assigned_admin_id: b.assigned_admin_id || "",
      is_active: b.is_active !== false,
      allow_login_when_inactive: b.allow_login_when_inactive !== false,
    });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        assigned_admin_id: form.assigned_admin_id || null,
      };
      if (editing) await api.put(`/branches/${editing}`, payload);
      else await api.post("/branches", payload);
      toast.success(editing ? "Branch updated" : "Branch created");
      setOpen(false); setEditing(null); setForm(emptyForm());
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const remove = async (bid) => {
    if (!window.confirm("Delete branch? (Blocked if users/leads exist)")) return;
    try {
      await api.delete(`/branches/${bid}`);
      toast.success("Deleted");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const showPerf = async (bid) => {
    try {
      const { data } = await api.get(`/branches/${bid}/performance`);
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
          <div className="overline mb-2">Operations</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">Branches</h1>
          <p className="text-sm text-zinc-500 mt-2">Point-of-sale (POS) branch management. Deactivate a branch to freeze new lead creation without deleting history.</p>
        </div>
        {isSuper && (
          <Button onClick={openNew} className="rounded-sm bg-zinc-900 hover:bg-zinc-800 font-bold" data-testid="add-branch-btn">
            <Plus className="w-4 h-4 mr-1" /> New branch
          </Button>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>City</th><th>Assigned Admin</th><th>Status</th><th>Login when inactive</th><th></th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-zinc-400">No branches.</td></tr>}
            {branches.map((b) => (
              <tr key={b.id} data-testid={`branch-row-${b.id}`}>
                <td className="font-mono text-sm font-bold">{b.code || "—"}</td>
                <td className="font-semibold">{b.name}</td>
                <td>{b.city || "—"}</td>
                <td>{adminMap[b.assigned_admin_id]?.name || <span className="text-zinc-400">Unassigned</span>}</td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`} data-testid={`branch-status-${b.id}`}>
                    {b.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="text-xs">{b.allow_login_when_inactive ? "Allowed" : "Blocked"}</td>
                <td className="flex gap-1">
                  <Button size="sm" variant="outline" className="rounded-sm" onClick={() => showPerf(b.id)} data-testid={`perf-branch-${b.id}`}>
                    <BarChart3 className="w-3 h-3" />
                  </Button>
                  {isSuper && (
                    <>
                      <Button size="sm" variant="outline" className="rounded-sm" onClick={() => openEdit(b)} data-testid={`edit-branch-${b.id}`}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-sm border-rose-200 text-rose-700" onClick={() => remove(b.id)} data-testid={`del-branch-${b.id}`}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm()); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "New"} branch</DialogTitle>
            <DialogDescription>Code must be unique. When a branch is deactivated new leads are blocked; login is controlled separately.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="overline">Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2" data-testid="branch-name" />
              </div>
              <div>
                <Label className="overline">Code (unique)</Label>
                <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="mt-2 font-mono" data-testid="branch-code" />
              </div>
              <div>
                <Label className="overline">City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-2" data-testid="branch-city" />
              </div>
              <div>
                <Label className="overline">Assigned Admin</Label>
                <Select value={form.assigned_admin_id || "__NONE__"} onValueChange={(v) => setForm({ ...form, assigned_admin_id: v === "__NONE__" ? "" : v })}>
                  <SelectTrigger className="mt-2" data-testid="branch-admin"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="overline">Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-2" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} data-testid="branch-active" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.allow_login_when_inactive} onChange={(e) => setForm({ ...form, allow_login_when_inactive: e.target.checked })} data-testid="branch-allow-login" />
                Allow login when inactive
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800" data-testid="save-branch-btn">
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Performance dialog */}
      <Dialog open={perfOpen} onOpenChange={setPerfOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Branch performance</DialogTitle>
            <DialogDescription>Lifetime counters across leads and revenue.</DialogDescription>
          </DialogHeader>
          {perf && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-zinc-500" />
                <div className="font-semibold text-lg">{perf.name}</div>
                <span className="font-mono text-xs text-zinc-500">({perf.code})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["leads_total", "Total leads"],
                  ["leads_delivered", "Conversions"],
                  ["leads_lost", "Lost"],
                  ["active_users", "Active users"],
                  ["conversion_rate_pct", "Conv. rate %"],
                  ["revenue", "Revenue (₹)"],
                ].map(([k, label]) => (
                  <div key={k} className="bg-zinc-50 border border-zinc-200 rounded-sm p-3">
                    <div className="overline">{label}</div>
                    <div className="font-mono text-2xl font-bold mt-1" data-testid={`branch-perf-${k}`}>
                      {k === "revenue" ? Number(perf[k] || 0).toLocaleString("en-IN") : (perf[k] ?? 0)}
                    </div>
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
