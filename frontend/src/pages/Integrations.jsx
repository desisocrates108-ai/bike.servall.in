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
import { Zap, Save } from "lucide-react";

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

  useEffect(() => { reload(); }, []);

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
      </div>
    </>
  );
}
