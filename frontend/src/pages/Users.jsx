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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { roleLabel } from "../lib/labels";
import { UserPlus } from "lucide-react";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "sales_executive", branch_id: "" });

  const reload = () => api.get("/users").then((r) => setUsers(r.data));

  useEffect(() => {
    reload();
    api.get("/branches").then((r) => setBranches(r.data));
  }, []);

  const branchMap = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b])), [branches]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/users", { ...form, branch_id: form.branch_id || null });
      toast.success("User created");
      setOpen(false);
      setForm({ email: "", name: "", password: "", role: "sales_executive", branch_id: "" });
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-[1200px]">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="overline mb-2">Team</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">Users</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-sm bg-zinc-900 hover:bg-zinc-800 font-bold" data-testid="add-user-btn">
              <UserPlus className="w-4 h-4 mr-1" /> Add user
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label className="overline">Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2" data-testid="new-user-name" />
              </div>
              <div>
                <Label className="overline">Email</Label>
                <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2" data-testid="new-user-email" />
              </div>
              <div>
                <Label className="overline">Password</Label>
                <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-2" data-testid="new-user-password" />
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
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800" data-testid="save-user-btn">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.id}`}>
                <td className="font-semibold">{u.name}</td>
                <td className="font-mono text-sm">{u.email}</td>
                <td>{roleLabel(u.role)}</td>
                <td>{branchMap[u.branch_id]?.name || "—"}</td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                    {u.is_active ? "Active" : "Disabled"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
