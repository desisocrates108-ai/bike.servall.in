import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { api, formatApiErrorDetail } from "../api";
import PageHeader from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { Zap, Save, AlertTriangle, Trash2, Download } from "lucide-react";

const TRIGGERS = [
  { key: "inquiry_created", label: "New Inquiry", desc: "Auto-send message when a lead is created" },
  { key: "delivery_completed", label: "Delivery Completed", desc: "Send thanks after delivery" },
  { key: "feedback_reminder", label: "Feedback Reminder", desc: "Ask for feedback after delivery window" },
];

export default function Integrations() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [triggers, setTriggers] = useState({});
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [i, tpl] = await Promise.all([
        api.get("/settings/integrations"),
        api.get("/wa-templates"),
      ]);
      setData(i.data);
      setApiKey("");
      setSenderId(i.data.elevenza_sender_id || "");
      setTriggers(i.data.triggers || {});
      setTemplates((tpl.data || []).filter((t) => t.active !== false));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Defer initial load to next microtask so React's set-state-in-effect rule is satisfied
    Promise.resolve().then(reload);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        elevenza_sender_id: senderId,
        triggers,
      };
      if (apiKey.trim()) payload.elevenza_api_key = apiKey.trim();
      await api.put("/settings/integrations", payload);
      toast.success("Integration settings saved");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
    setSaving(false);
  };

  const toggleTrigger = (k, on) => {
    setTriggers((t) => ({ ...t, [k]: { ...(t[k] || {}), enabled: on } }));
  };
  const setTriggerTpl = (k, tid) => {
    setTriggers((t) => ({ ...t, [k]: { ...(t[k] || {}), template_id: tid } }));
  };

  const tplMap = Object.fromEntries(templates.map((t) => [t.id, t]));

  if (loading) return (<><PageHeader title="Integrations" /><div className="p-6 text-sm text-zinc-500">{t("common.loading")}</div></>);

  return (
    <>
      <PageHeader
        title={t("nav.integrations", "Integrations")}
        subtitle="WhatsApp automation via 11za"
        sticky
      />
      <div className="p-3 sm:p-6 max-w-[1100px] mx-auto w-full space-y-4">

        {/* API key */}
        <section className="bg-white border border-zinc-200 rounded-sm p-4 sm:p-5" data-testid="sec-api">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-brand" />
            <div className="overline">11za WhatsApp API</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="overline">API Key {data?.elevenza_api_key_set && <span className="text-emerald-600 font-bold ml-1">· set</span>}</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={data?.elevenza_api_key_masked || "Paste 11za API key…"}
                className="rounded-sm mt-2 font-mono"
                disabled={!isSuper}
                data-testid="int-api-key"
              />
              <div className="text-[11px] text-zinc-500 mt-1">
                Leave empty to keep existing. {isSuper ? "" : "(Only super admin can change)"}
              </div>
            </div>
            <div>
              <Label className="overline">Sender ID / WhatsApp Number</Label>
              <Input
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="rounded-sm mt-2 font-mono"
                disabled={!isSuper}
                data-testid="int-sender-id"
              />
            </div>
          </div>
        </section>

        {/* Triggers */}
        <section className="bg-white border border-zinc-200 rounded-sm p-4 sm:p-5" data-testid="sec-triggers">
          <div className="overline mb-3">Automation Triggers</div>
          <div className="space-y-3">
            {TRIGGERS.map((tr) => {
              const s = triggers[tr.key] || { enabled: false, template_id: null };
              const tpl = tplMap[s.template_id];
              return (
                <div key={tr.key} className="border border-zinc-200 rounded-sm p-3" data-testid={`trigger-${tr.key}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm">{tr.label}</div>
                      <div className="text-xs text-zinc-500">{tr.desc}</div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={!!s.enabled}
                        onChange={(e) => toggleTrigger(tr.key, e.target.checked)}
                        disabled={!isSuper}
                        data-testid={`trigger-toggle-${tr.key}`}
                      />
                      {s.enabled ? "ON" : "OFF"}
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3 items-start">
                    <div>
                      <Label className="overline">Template</Label>
                      <Select
                        value={s.template_id || ""}
                        onValueChange={(v) => setTriggerTpl(tr.key, v || null)}
                        disabled={!isSuper}
                      >
                        <SelectTrigger className="rounded-sm mt-2" data-testid={`trigger-tpl-${tr.key}`}>
                          <SelectValue placeholder="Pick a template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((tt) => (
                            <SelectItem key={tt.id} value={tt.id}>{tt.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="overline">Message Preview</Label>
                      <Textarea
                        readOnly
                        rows={3}
                        value={tpl?.body || "(select a template)"}
                        className="mt-2 rounded-sm text-xs font-mono bg-zinc-50"
                        data-testid={`trigger-preview-${tr.key}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {isSuper && (
          <div>
            <Button onClick={save} disabled={saving} className="bg-brand hover:bg-brand-dark rounded-sm font-bold" data-testid="int-save-btn">
              <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        )}

        <section className="bg-white border border-zinc-200 rounded-sm p-4 sm:p-5" data-testid="sec-bulk">
          <div className="overline mb-2">Bulk Messaging</div>
          <div className="text-sm text-zinc-600">
            Use <a href="/campaigns" className="text-brand font-semibold hover:underline">Campaigns</a> to send bulk messages to selected leads by stage, branch, or source.
          </div>
        </section>

        {isSuper && <DataExport />}
        {isSuper && <DangerZone />}
      </div>
    </>
  );
}

function DataExport() {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const res = await api.get("/admin/export-data", { responseType: "blob" });
      // Try to use server-suggested filename
      const cd = res.headers["content-disposition"] || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      const fname = m ? m[1] : `servall_crm_export_${new Date().toISOString().slice(0,19).replace(/[:T-]/g,"")}.json`;
      const blob = new Blob([res.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${fname}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-2 border-emerald-300 rounded-sm p-4 sm:p-5 bg-emerald-50/40 mt-4" data-testid="sec-data-export">
      <div className="flex items-center gap-2 mb-3">
        <Download className="w-5 h-5 text-emerald-700" />
        <div className="font-display font-bold text-emerald-800 uppercase tracking-wider text-sm">Data Export — Full Backup</div>
      </div>
      <div className="text-sm text-zinc-700 mb-3">
        Download all CRM data as a single JSON file — users, branches, leads, follow-ups, bookings, payments, vehicles (brands/models/variants/colors), WA messages, audit logs and more.
        <br />
        <span className="text-zinc-500 text-xs">Password hashes and internal MongoDB IDs are excluded for safety. Use this file for backup, migration or audit.</span>
      </div>
      <Button
        onClick={download}
        disabled={busy}
        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm h-10 px-5"
        data-testid="export-data-btn"
      >
        <Download className="w-4 h-4 mr-2" /> {busy ? "Preparing…" : "Download All Data (JSON)"}
      </Button>
    </section>
  );
}

function DangerZone() {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  const purge = async (keepUsers) => {
    if (text !== "PURGE") {
      toast.error("Type PURGE in the box first");
      return;
    }
    const message = keepUsers
      ? "⚠️ This permanently deletes ALL leads, follow-ups, bookings, deliveries, payments, documents, files, campaigns, automations, audit logs and inventory.\n\nUsers, branches and master data will be KEPT. Are you sure?"
      : "⚠️ This permanently deletes ALL leads, files, follow-ups, deliveries, bookings, campaigns, AUDIT LOGS and ALL non-super-admin USERS. Branches and master data are kept. Are you ABSOLUTELY sure?";
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/purge-demo-data", null, {
        params: { confirm: "SERVALL_PURGE", keep_users: keepUsers },
      });
      const total = Object.entries(data.stats || {})
        .filter(([k]) => !k.startsWith("users_"))
        .reduce((s, [, n]) => s + (typeof n === "number" ? n : 0), 0);
      toast.success(`Purged ${total} records. System is now in production mode.`);
      setText("");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Purge failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-2 border-rose-300 rounded-sm p-4 sm:p-5 bg-rose-50/30 mt-4" data-testid="sec-danger-zone">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-rose-600" />
        <div className="font-display font-bold text-rose-700 uppercase tracking-wider text-sm">Danger Zone — Production Reset</div>
      </div>
      <div className="text-sm text-zinc-700 mb-3">
        Choose what to wipe. Type <span className="font-mono font-bold text-rose-700">PURGE</span> below to enable both buttons.
      </div>
      <div className="mb-3">
        <Label className="overline">Type <span className="font-mono font-bold text-rose-700">PURGE</span> to enable</Label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="PURGE"
          className="font-mono"
          data-testid="purge-confirm-input"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Safer option — keep users */}
        <div className="border border-amber-300 bg-amber-50/50 rounded-sm p-3">
          <div className="font-bold text-amber-800 text-sm uppercase tracking-wider mb-1">Wipe Transactions Only</div>
          <div className="text-xs text-zinc-600 mb-3">
            Deletes leads, follow-ups, bookings, deliveries, payments, files, campaigns, automations, audit logs, inventory.<br />
            <span className="text-emerald-700 font-semibold">Keeps:</span> all users, branches, master data.
          </div>
          <Button
            onClick={() => purge(true)}
            disabled={busy || text !== "PURGE"}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-sm h-10"
            data-testid="purge-keep-users-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" /> {busy ? "Wiping…" : "Wipe Transactions (Keep Users)"}
          </Button>
        </div>

        {/* Full reset — also wipes users */}
        <div className="border border-rose-300 bg-white rounded-sm p-3">
          <div className="font-bold text-rose-700 text-sm uppercase tracking-wider mb-1">Full Production Reset</div>
          <div className="text-xs text-zinc-600 mb-3">
            Everything above <b>PLUS</b> all non-super-admin users (Branch Admins, Sales Executives).<br />
            <span className="text-emerald-700 font-semibold">Keeps:</span> super-admin, branches, master data.
          </div>
          <Button
            onClick={() => purge(false)}
            disabled={busy || text !== "PURGE"}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-sm h-10"
            data-testid="purge-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" /> {busy ? "Purging…" : "Full Reset (Also delete users)"}
          </Button>
        </div>
      </div>
    </section>
  );
}
