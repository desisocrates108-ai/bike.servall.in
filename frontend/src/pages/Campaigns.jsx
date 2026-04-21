import React, { useEffect, useMemo, useState } from "react";
import { api, formatApiErrorDetail } from "../api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Plus, Send, Users, TrendingUp, Trash2, Pencil } from "lucide-react";

const emptyForm = () => ({
  name: "",
  campaign_type: "Offer",
  template_id: "",
  message_type: "text",
  content: "",
  scheduled_at: "",
  target: {
    stages: [], priorities: [], sources: [], branch_ids: [],
    purchase_types: [], audience: "leads",
  },
});

export default function Campaigns() {
  const [list, setList] = useState([]);
  const [constants, setConstants] = useState(null);
  const [branches, setBranches] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(null);
  const [statsFor, setStatsFor] = useState(null);
  const [stats, setStats] = useState(null);
  const [preview, setPreview] = useState(null);

  const reload = async () => {
    const r = await api.get("/campaigns");
    setList(r.data);
  };

  useEffect(() => {
    reload();
    api.get("/constants").then((r) => setConstants(r.data));
    api.get("/branches").then((r) => setBranches(r.data));
    api.get("/wa-templates").then((r) => setTemplates(r.data.filter((t) => t.active)));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (!payload.template_id) delete payload.template_id;
      if (!payload.content) delete payload.content;
      if (!payload.scheduled_at) delete payload.scheduled_at;
      if (editing) {
        await api.put(`/campaigns/${editing}`, payload);
        toast.success("Campaign updated");
      } else {
        await api.post("/campaigns", payload);
        toast.success("Campaign created");
      }
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c.id);
    setForm({
      name: c.name,
      campaign_type: c.campaign_type,
      template_id: c.template_id || "",
      message_type: c.message_type || "text",
      content: c.content || "",
      scheduled_at: c.scheduled_at || "",
      target: c.target || emptyForm().target,
    });
    setOpen(true);
  };

  const doPreview = async (cid) => {
    try {
      const { data } = await api.post(`/campaigns/${cid}/preview`);
      setPreview({ cid, ...data });
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const send = async (cid) => {
    if (!window.confirm("Send this campaign now?")) return;
    try {
      const { data } = await api.post(`/campaigns/${cid}/send`);
      toast.success(`Queued ${data.queued} messages`);
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const loadStats = async (cid) => {
    try {
      const { data } = await api.get(`/campaigns/${cid}/stats`);
      setStats(data);
      setStatsFor(cid);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const remove = async (cid) => {
    if (!window.confirm("Delete campaign?")) return;
    try {
      await api.delete(`/campaigns/${cid}`);
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const setT = (key, value) => setForm((f) => ({ ...f, target: { ...f.target, [key]: value } }));

  const statusColor = {
    Draft: "bg-zinc-100 text-zinc-700",
    Scheduled: "bg-blue-100 text-blue-700",
    Running: "bg-amber-100 text-amber-700",
    Completed: "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="p-6 md:p-10 max-w-[1400px]">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="overline mb-2">Marketing</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">Campaigns</h1>
        </div>
        <Button onClick={openNew} className="bg-zinc-900 hover:bg-zinc-800 rounded-sm font-bold" data-testid="new-campaign-btn">
          <Plus className="w-4 h-4 mr-1" /> New campaign
        </Button>
      </div>

      <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
              <th>Queued</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-zinc-400">No campaigns yet.</td></tr>}
            {list.map((c) => (
              <tr key={c.id} data-testid={`campaign-${c.id}`}>
                <td className="font-semibold">{c.name}</td>
                <td>{c.campaign_type}</td>
                <td>
                  <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider ${statusColor[c.status]}`}>
                    {c.status}
                  </span>
                </td>
                <td className="font-mono text-xs text-zinc-500">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="font-mono">{c.stats?.queued || 0}</td>
                <td className="flex gap-1 flex-wrap">
                  <Button size="sm" variant="outline" className="rounded-sm" onClick={() => doPreview(c.id)} data-testid={`preview-${c.id}`}>
                    <Users className="w-3 h-3 mr-1" /> Preview
                  </Button>
                  {c.status !== "Completed" && c.status !== "Running" && (
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-sm" onClick={() => send(c.id)} data-testid={`send-${c.id}`}>
                      <Send className="w-3 h-3 mr-1" /> Send
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="rounded-sm" onClick={() => loadStats(c.id)} data-testid={`stats-${c.id}`}>
                    <TrendingUp className="w-3 h-3 mr-1" /> Stats
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-sm" onClick={() => openEdit(c)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-sm border-rose-200 text-rose-700" onClick={() => remove(c.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyForm()); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "New"} campaign</DialogTitle>
            <DialogDescription>Configure message, audience filters and schedule.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="overline">Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-2" data-testid="c-name" />
              </div>
              <div>
                <Label className="overline">Type</Label>
                <Select value={form.campaign_type} onValueChange={(v) => setForm({ ...form, campaign_type: v })}>
                  <SelectTrigger className="mt-2" data-testid="c-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {constants?.campaign_types?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Template</Label>
                <Select value={form.template_id || "__NONE__"} onValueChange={(v) => setForm({ ...form, template_id: v === "__NONE__" ? "" : v })}>
                  <SelectTrigger className="mt-2" data-testid="c-template"><SelectValue placeholder="— none —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">— Use custom content —</SelectItem>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Scheduled At</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} className="mt-2" />
              </div>
            </div>
            {!form.template_id && (
              <div>
                <Label className="overline">Custom message</Label>
                <Textarea rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="mt-2" data-testid="c-content" />
              </div>
            )}

            <div className="border-t border-zinc-200 pt-3">
              <div className="overline mb-2">Audience</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="overline">Audience</Label>
                  <Select value={form.target.audience} onValueChange={(v) => setT("audience", v)}>
                    <SelectTrigger className="mt-2" data-testid="c-audience"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leads">Leads</SelectItem>
                      <SelectItem value="past_buyers">Past Buyers</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <MultiChips label="Stages" options={constants?.stages || []} values={form.target.stages} onChange={(v) => setT("stages", v)} />
                <MultiChips label="Priorities" options={constants?.priorities || []} values={form.target.priorities} onChange={(v) => setT("priorities", v)} />
                <MultiChips label="Sources" options={constants?.lead_sources || []} values={form.target.sources} onChange={(v) => setT("sources", v)} />
                <MultiChips label="Branches" options={branches.map((b) => ({ id: b.id, label: b.name }))} values={form.target.branch_ids} onChange={(v) => setT("branch_ids", v)} useIds />
                <MultiChips label="Purchase" options={["New Purchase", "Exchange Vehicle"]} values={form.target.purchase_types} onChange={(v) => setT("purchase_types", v)} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800" data-testid="c-save">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audience preview</DialogTitle>
            <DialogDescription>Leads matching your targeting filters.</DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <div className="font-mono text-3xl font-bold" data-testid="preview-count">{preview?.audience_count}</div>
            <div className="text-zinc-500 mt-1">leads match this campaign</div>
          </div>
          {preview?.sample?.length > 0 && (
            <div className="mt-3">
              <div className="overline mb-2">Sample</div>
              <ul className="text-sm space-y-1">
                {preview.sample.map((s) => (
                  <li key={s.id} className="font-mono">{s.customer_name} · {s.phone} · {s.stage}</li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stats dialog */}
      <Dialog open={!!statsFor} onOpenChange={(v) => !v && setStatsFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Campaign stats</DialogTitle>
            <DialogDescription>Delivery counters and engagement totals.</DialogDescription>
          </DialogHeader>
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              {["queued", "sent", "delivered", "read", "failed", "responses", "conversions"].map((k) => (
                <div key={k} className="bg-zinc-50 border border-zinc-200 rounded-sm p-3">
                  <div className="overline">{k}</div>
                  <div className="font-mono text-2xl font-bold mt-1" data-testid={`stat-${k}`}>{stats[k] ?? 0}</div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MultiChips({ label, options, values, onChange, useIds }) {
  const normalized = useMemo(() =>
    options.map((o) => typeof o === "string" ? { id: o, label: o } : o), [options]);
  const toggle = (v) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };
  return (
    <div className="col-span-2">
      <Label className="overline">{label}</Label>
      <div className="flex flex-wrap gap-1 mt-2">
        {normalized.map((o) => {
          const val = useIds ? o.id : o.id;
          const on = values.includes(val);
          return (
            <button
              key={val}
              type="button"
              onClick={() => toggle(val)}
              className={`text-xs px-2 py-1 rounded-sm border ${on ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-300 hover:border-zinc-500"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
