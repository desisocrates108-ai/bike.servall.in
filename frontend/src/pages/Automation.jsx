import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { useTranslation } from "react-i18next";
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
import { Plus, Trash2, Pencil, Zap } from "lucide-react";

export default function Automation() {
  const { t: tr } = useTranslation();
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [constants, setConstants] = useState(null);

  const [tplOpen, setTplOpen] = useState(false);
  const [tplForm, setTplForm] = useState({ name: "", category: "general", message_type: "text", body: "", media_url: "", active: true });
  const [tplEdit, setTplEdit] = useState(null);

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", event: "inquiry_created", template_id: "", delay_minutes: 0, active: true, conditions: {} });
  const [ruleEdit, setRuleEdit] = useState(null);

  const reload = async () => {
    const [t, r] = await Promise.all([api.get("/wa-templates"), api.get("/automation-rules")]);
    setTemplates(t.data);
    setRules(r.data);
  };

  useEffect(() => {
    reload();
    api.get("/constants").then((r) => setConstants(r.data));
  }, []);

  const saveTemplate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...tplForm };
      if (!payload.media_url) delete payload.media_url;
      if (tplEdit) await api.put(`/wa-templates/${tplEdit}`, payload);
      else await api.post("/wa-templates", payload);
      toast.success("Saved");
      setTplOpen(false); setTplEdit(null);
      setTplForm({ name: "", category: "general", message_type: "text", body: "", media_url: "", active: true });
      reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const removeTemplate = async (id) => {
    if (!window.confirm("Delete template?")) return;
    try { await api.delete(`/wa-templates/${id}`); reload(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const saveRule = async (e) => {
    e.preventDefault();
    try {
      if (ruleEdit) await api.put(`/automation-rules/${ruleEdit}`, ruleForm);
      else await api.post("/automation-rules", ruleForm);
      toast.success("Saved");
      setRuleOpen(false); setRuleEdit(null);
      setRuleForm({ name: "", event: "inquiry_created", template_id: "", delay_minutes: 0, active: true, conditions: {} });
      reload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const removeRule = async (id) => {
    if (!window.confirm("Delete rule?")) return;
    try { await api.delete(`/automation-rules/${id}`); reload(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const openTplEdit = (t) => {
    setTplEdit(t.id);
    setTplForm({ name: t.name, category: t.category || "general", message_type: t.message_type, body: t.body, media_url: t.media_url || "", active: t.active });
    setTplOpen(true);
  };

  const openRuleEdit = (r) => {
    setRuleEdit(r.id);
    setRuleForm({ name: r.name, event: r.event, template_id: r.template_id, delay_minutes: r.delay_minutes || 0, active: r.active, conditions: r.conditions || {} });
    setRuleOpen(true);
  };

  return (
    <>
      <PageHeader title={tr("nav.automation")} subtitle="Templates & rules" sticky />
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto w-full">
      <div className="flex gap-2 mb-4 border-b border-zinc-200 overflow-x-auto no-scrollbar">
        {[["templates", "Templates"], ["rules", "Rules"]].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === k ? "border-brand text-brand" : "border-transparent text-zinc-500"}`}
            data-testid={`tab-${k}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "templates" && (
        <>
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setTplEdit(null); setTplForm({ name: "", category: "general", message_type: "text", body: "", media_url: "", active: true }); setTplOpen(true); }} className="bg-brand hover:bg-brand-dark rounded-sm" data-testid="add-template-btn">
              <Plus className="w-4 h-4 mr-1" /> Add template
            </Button>
          </div>
          <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr><th>Name</th><th>Category</th><th>Type</th><th>Body</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} data-testid={`tpl-${t.id}`}>
                    <td className="font-semibold">{t.name}</td>
                    <td>{t.category}</td>
                    <td>{t.message_type}</td>
                    <td className="max-w-md truncate text-zinc-600">{t.body}</td>
                    <td>
                      <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${t.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {t.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="flex gap-1">
                      <Button size="sm" variant="outline" className="rounded-sm" onClick={() => openTplEdit(t)}><Pencil className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" className="rounded-sm border-rose-200 text-rose-700" onClick={() => removeTemplate(t.id)}><Trash2 className="w-3 h-3" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "rules" && (
        <>
          <div className="flex justify-end mb-3">
            <Button onClick={() => { setRuleEdit(null); setRuleForm({ name: "", event: "inquiry_created", template_id: templates[0]?.id || "", delay_minutes: 0, active: true, conditions: {} }); setRuleOpen(true); }} className="bg-brand hover:bg-brand-dark rounded-sm" data-testid="add-rule-btn">
              <Plus className="w-4 h-4 mr-1" /> Add rule
            </Button>
          </div>
          <div className="bg-white border border-zinc-200 rounded-sm overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr><th>Name</th><th>Event</th><th>Template</th><th>Conditions</th><th>Delay</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {rules.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-zinc-400">No rules configured. Add one to auto-send messages.</td></tr>}
                {rules.map((r) => (
                  <tr key={r.id} data-testid={`rule-${r.id}`}>
                    <td className="font-semibold">{r.name}</td>
                    <td><code className="text-xs">{r.event}</code></td>
                    <td className="font-mono text-xs">{templates.find((t) => t.id === r.template_id)?.name || "—"}</td>
                    <td className="text-xs text-zinc-600 font-mono">{JSON.stringify(r.conditions || {})}</td>
                    <td className="font-mono">{r.delay_minutes || 0}m</td>
                    <td>
                      <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {r.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="flex gap-1">
                      <Button size="sm" variant="outline" className="rounded-sm" onClick={() => openRuleEdit(r)}><Pencil className="w-3 h-3" /></Button>
                      <Button size="sm" variant="outline" className="rounded-sm border-rose-200 text-rose-700" onClick={() => removeRule(r.id)}><Trash2 className="w-3 h-3" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Template dialog */}
      <Dialog open={tplOpen} onOpenChange={(v) => { setTplOpen(v); if (!v) setTplEdit(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tplEdit ? "Edit" : "New"} template</DialogTitle>
            <DialogDescription>Message template with variable placeholders like &#123;&#123;customer_name&#125;&#125;.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveTemplate} className="space-y-3">
            <div>
              <Label className="overline">Name</Label>
              <Input required value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} className="mt-2" data-testid="tpl-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="overline">Category</Label>
                <Input value={tplForm.category} onChange={(e) => setTplForm({ ...tplForm, category: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label className="overline">Message Type</Label>
                <Select value={tplForm.message_type} onValueChange={(v) => setTplForm({ ...tplForm, message_type: v })}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {constants?.wa_message_types?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="overline">Body (use &#123;&#123;customer_name&#125;&#125;, &#123;&#123;vehicle&#125;&#125;, etc.)</Label>
              <Textarea rows={5} required value={tplForm.body} onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })} className="mt-2 font-mono text-sm" data-testid="tpl-body" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tplForm.active} onChange={(e) => setTplForm({ ...tplForm, active: e.target.checked })} />
              Active
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTplOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-brand hover:bg-brand-dark" data-testid="tpl-save">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rule dialog */}
      <Dialog open={ruleOpen} onOpenChange={(v) => { setRuleOpen(v); if (!v) setRuleEdit(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{ruleEdit ? "Edit" : "New"} rule</DialogTitle>
            <DialogDescription>Trigger an automatic WhatsApp message on a lead event.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveRule} className="space-y-3">
            <div>
              <Label className="overline">Name</Label>
              <Input required value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} className="mt-2" data-testid="rule-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="overline">Event</Label>
                <Select value={ruleForm.event} onValueChange={(v) => setRuleForm({ ...ruleForm, event: v })}>
                  <SelectTrigger className="mt-2" data-testid="rule-event"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {constants?.wa_events?.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Template</Label>
                <Select value={ruleForm.template_id} onValueChange={(v) => setRuleForm({ ...ruleForm, template_id: v })}>
                  <SelectTrigger className="mt-2" data-testid="rule-template"><SelectValue placeholder="Pick template" /></SelectTrigger>
                  <SelectContent>
                    {templates.filter((t) => t.active).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Delay (minutes)</Label>
                <Input type="number" value={ruleForm.delay_minutes} onChange={(e) => setRuleForm({ ...ruleForm, delay_minutes: Number(e.target.value || 0) })} className="mt-2" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={ruleForm.active} onChange={(e) => setRuleForm({ ...ruleForm, active: e.target.checked })} />
                  Active
                </label>
              </div>
            </div>
            <div>
              <Label className="overline">Conditions (JSON — e.g. &#123;"priority":"Hot","source":"Digital Marketing"&#125;)</Label>
              <Textarea rows={3} value={JSON.stringify(ruleForm.conditions || {}, null, 2)}
                onChange={(e) => {
                  try { setRuleForm({ ...ruleForm, conditions: JSON.parse(e.target.value || "{}") }); }
                  catch { /* noop, invalid JSON while typing */ }
                }}
                className="mt-2 font-mono text-xs" data-testid="rule-conditions" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRuleOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-brand hover:bg-brand-dark" data-testid="rule-save">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
