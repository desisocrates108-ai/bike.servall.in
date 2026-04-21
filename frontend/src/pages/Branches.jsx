import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import PageHeader from "../components/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";

const emptyForm = () => ({
  name: "", code: "", city: "", address: "",
  assigned_admin_id: "",
  is_active: true,
  allow_login_when_inactive: true,
});

export default function Branches() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const [branches, setBranches] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

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

  return (
    <>
      <PageHeader
        title={t("nav.branches")}
        subtitle={t("branches.sub", "Point-of-sale (POS) branch management")}
        showBack={false}
        sticky
        right={
          isSuper && (
            <Button onClick={openNew} className="rounded-sm bg-brand hover:bg-brand-dark font-bold h-10" data-testid="add-branch-btn">
              <Plus className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">New branch</span>
            </Button>
          )
        }
      />
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto w-full">

      {/* MOBILE: cards */}
      <div className="sm:hidden space-y-2">
        {branches.length === 0 && <div className="py-12 text-center text-sm text-zinc-400">No branches.</div>}
        {branches.map((b) => (
          <div key={b.id} className="bg-white border border-zinc-200 rounded-sm p-3 flex items-center justify-between gap-2" data-testid={`branch-card-${b.id}`}>
            <Link to={`/branches/${b.id}`} className="flex-1 min-w-0 active:bg-zinc-50 -m-3 p-3 rounded-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-zinc-100 rounded-sm px-1.5 py-0.5">{b.code || "—"}</span>
                <span className="font-semibold truncate">{b.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-500">
                <span>{b.city || "—"}</span>
                <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}>
                  {b.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </Link>
            {isSuper && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="rounded-sm" onClick={() => openEdit(b)} data-testid={`edit-branch-${b.id}`}><Pencil className="w-3 h-3" /></Button>
                <Button size="sm" variant="outline" className="rounded-sm border-rose-200 text-rose-700" onClick={() => remove(b.id)} data-testid={`del-branch-${b.id}`}><Trash2 className="w-3 h-3" /></Button>
              </div>
            )}
            <ChevronRight className="w-4 h-4 text-zinc-400 sm:hidden" />
          </div>
        ))}
      </div>

      {/* DESKTOP: table */}
      <div className="hidden sm:block bg-white border border-zinc-200 rounded-sm overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>City</th><th>Assigned Admin</th><th>Status</th><th>Login when inactive</th><th></th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-zinc-400">No branches.</td></tr>}
            {branches.map((b) => (
              <tr
                key={b.id}
                data-testid={`branch-row-${b.id}`}
                onClick={() => nav(`/branches/${b.id}`)}
                className="cursor-pointer hover:bg-zinc-50"
              >
                <td className="font-mono text-sm font-bold">{b.code || "—"}</td>
                <td className="font-semibold text-brand hover:underline">{b.name}</td>
                <td>{b.city || "—"}</td>
                <td>{adminMap[b.assigned_admin_id]?.name || <span className="text-zinc-400">Unassigned</span>}</td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`} data-testid={`branch-status-${b.id}`}>
                    {b.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="text-xs">{b.allow_login_when_inactive ? "Allowed" : "Blocked"}</td>
                <td className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
              <Button type="submit" className="bg-brand hover:bg-brand-dark" data-testid="save-branch-btn">
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Performance removed — click row to open /branches/:id detail page */}
      </div>
    </>
  );
}
