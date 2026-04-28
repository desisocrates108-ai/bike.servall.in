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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { roleLabel } from "../lib/labels";
import { UserPlus, Pencil, ChevronRight, Trash2 } from "lucide-react";

const emptyForm = () => ({
  email: "", name: "", password: "", phone: "",
  role: "sales_executive", branch_id: "",
  reporting_manager_id: "", joining_date: "",
  is_active: true,
});

export default function Users() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const [filterRole, setFilterRole] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [qText, setQText] = useState("");

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

  const isSuper = user?.role === "super_admin";

  const deleteUser = async (u) => {
    if (u.id === user?.id) {
      toast.error("Cannot delete yourself");
      return;
    }
    const ok = window.confirm(`Delete user "${u.name}" (${u.email})?\nThis cannot be undone.`);
    if (!ok) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("User deleted");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Delete failed");
    }
  };

  return (
    <>
      <PageHeader
        title={t("nav.users")}
        subtitle={`${users.length} ${t("common.total", "total").toLowerCase()}`}
        showBack={false}
        sticky
        right={
          <Button onClick={openNew} className="rounded-sm bg-brand hover:bg-brand-dark font-bold h-10" data-testid="add-user-btn">
            <UserPlus className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Add user</span>
          </Button>
        }
      />
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto w-full">

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

      <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden hidden sm:block">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-zinc-400">No users.</td></tr>}
            {users.map((u) => (
              <tr
                key={u.id}
                data-testid={`user-row-${u.id}`}
                onClick={() => nav(`/users/${u.id}`)}
                className="cursor-pointer hover:bg-zinc-50"
              >
                <td className="font-semibold text-brand hover:underline">{u.name}</td>
                <td className="font-mono text-sm">{u.phone || "—"}</td>
                <td className="font-mono text-sm">{u.email}</td>
                <td>{roleLabel(u.role, t)}</td>
                <td>{branchMap[u.branch_id]?.name || "—"}</td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" className="rounded-sm" onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  {isSuper && u.id !== user?.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-sm border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => deleteUser(u)}
                      data-testid={`delete-user-${u.id}`}
                      title="Delete user"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE: cards */}
      <div className="sm:hidden space-y-2">
        {users.length === 0 && <div className="py-12 text-center text-zinc-400 text-sm">No users.</div>}
        {users.map((u) => (
          <div key={u.id} className="bg-white border border-zinc-200 rounded-sm p-3 flex items-center gap-2" data-testid={`user-card-${u.id}`}>
            <Link to={`/users/${u.id}`} className="flex-1 min-w-0 active:bg-zinc-50 -m-3 p-3 rounded-sm">
              <div className="font-semibold truncate">{u.name}</div>
              <div className="text-xs text-zinc-500 font-mono truncate">{u.email}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5 text-xs">
                <span className="px-1.5 py-0.5 bg-zinc-100 rounded-sm">{roleLabel(u.role, t)}</span>
                {u.branch_id && <span className="px-1.5 py-0.5 bg-zinc-100 rounded-sm">{branchMap[u.branch_id]?.name || "—"}</span>}
                <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                  {u.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </Link>
            <Button size="sm" variant="outline" className="rounded-sm" onClick={() => openEdit(u)} data-testid={`edit-user-m-${u.id}`}>
              <Pencil className="w-3 h-3" />
            </Button>
            {isSuper && u.id !== user?.id && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-sm border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => deleteUser(u)}
                data-testid={`delete-user-m-${u.id}`}
                title="Delete user"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
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
              <Button type="submit" className="bg-brand hover:bg-brand-dark" data-testid="save-user-btn">
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Performance → now click user row to open /users/:id detail */}
      </div>
    </>
  );
}
