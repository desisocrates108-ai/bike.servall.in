import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { MessageCircle, Zap, Megaphone, FileText, Phone, ArrowRight } from "lucide-react";

export default function Whatsapp() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState({ templates: 0, rules: 0, campaigns: 0, sends_today: 0 });
  const [recent, setRecent] = useState([]);
  const canAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    (async () => {
      try {
        const [tpls, rules, camps] = await Promise.all([
          api.get("/wa-templates").catch(() => ({ data: [] })),
          api.get("/automation-rules").catch(() => ({ data: [] })),
          api.get("/campaigns").catch(() => ({ data: [] })),
        ]);
        setStats({
          templates: (tpls.data || []).filter((x) => x.active).length,
          rules: (rules.data || []).filter((x) => x.active).length,
          campaigns: (camps.data || []).length,
          sends_today: 0,
        });
      } catch { /* noop */ }
      try {
        const { data } = await api.get("/leads", { params: { page_size: 10 } });
        setRecent((data || []).slice(0, 10));
      } catch { /* noop */ }
    })();
  }, []);

  return (
    <>
      <PageHeader
        title={t("nav.whatsapp", "WhatsApp")}
        subtitle={t("wa.subtitle", "Templates, automation, and bulk campaigns")}
        sticky
      />
      <div className="p-4 sm:p-6 max-w-[1200px] mx-auto w-full">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard icon={FileText} label={t("wa.templates", "Active Templates")} value={stats.templates} testid="wa-stat-templates" />
          <StatCard icon={Zap} label={t("wa.rules", "Automation Rules")} value={stats.rules} testid="wa-stat-rules" />
          <StatCard icon={Megaphone} label={t("wa.campaigns", "Campaigns")} value={stats.campaigns} testid="wa-stat-campaigns" />
          <StatCard icon={MessageCircle} label={t("wa.send_to_lead", "Send to Lead")} value={t("common.quick", "Quick")} testid="wa-stat-send" />
        </div>

        {canAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <ActionTile to="/automation" icon={Zap} title={t("wa.manage_templates", "Manage Templates & Rules")} desc={t("wa.manage_templates_desc", "Create auto-replies and scheduled triggers")} testid="wa-action-automation" />
            <ActionTile to="/campaigns" icon={Megaphone} title={t("wa.run_campaign", "Run a Campaign")} desc={t("wa.run_campaign_desc", "Bulk send to leads by stage, branch or source")} testid="wa-action-campaigns" />
          </div>
        )}

        <div className="bg-white border border-zinc-200 rounded-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
            <div className="overline">{t("wa.send_from_lead", "Send from a lead")}</div>
            <Link to="/leads" className="text-xs font-semibold text-brand hover:underline">
              {t("common.see_all", "See all")} <ArrowRight className="w-3 h-3 inline" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="p-6 text-sm text-zinc-400">{t("wa.no_leads", "No leads yet. Add a lead to send a WhatsApp.")}</div>
          ) : (
            recent.map((l) => (
              <Link
                key={l.id}
                to={`/leads/${l.id}?tab=whatsapp`}
                className="flex items-center justify-between px-4 py-3 border-b last:border-0 border-zinc-100 hover:bg-zinc-50 active:bg-zinc-100"
                data-testid={`wa-lead-${l.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{l.customer_name}</div>
                  <div className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {l.phone}
                  </div>
                </div>
                <MessageCircle className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function StatCard({ icon: Icon, label, value, testid }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-sm p-4" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="overline truncate">{label}</div>
          <div className="font-mono text-2xl font-bold mt-1 truncate">{value}</div>
        </div>
        <div className="w-8 h-8 bg-emerald-600 rounded-sm flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

function ActionTile({ to, icon: Icon, title, desc, testid }) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 p-4 bg-white border border-zinc-200 rounded-sm hover:border-brand active:bg-zinc-50"
      data-testid={testid}
    >
      <div className="w-10 h-10 bg-brand/10 text-brand rounded-sm flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{desc}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-zinc-400 mt-2" />
    </Link>
  );
}
