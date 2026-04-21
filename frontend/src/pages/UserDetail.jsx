import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import PageHeader from "../components/PageHeader";
import { FunnelChart, DonutBreakdown } from "../components/Charts";
import { priorityClass, stageClass, priorityStrip, roleLabel } from "../lib/labels";
import { ChevronRight, Clock, Phone } from "lucide-react";

const Card = ({ children, className = "", testid, title, right }) => (
  <div className={`bg-white border border-zinc-200 rounded-sm p-4 sm:p-5 ${className}`} data-testid={testid}>
    {title && (
      <div className="flex items-center justify-between mb-3">
        <div className="overline">{title}</div>
        {right}
      </div>
    )}
    {children}
  </div>
);

const Stat = ({ label, value, tone = "dark", linkTo, testid }) => {
  const toneBg = { dark: "bg-zinc-900", danger: "bg-rose-600", ok: "bg-emerald-600", brand: "bg-brand", info: "bg-blue-600" }[tone];
  const content = (
    <div className="bg-white border border-zinc-200 rounded-sm p-4 hover:border-zinc-300 active:bg-zinc-50" data-testid={testid}>
      <div className="overline leading-tight" style={{ wordBreak: "break-word", whiteSpace: "normal" }}>{label}</div>
      <div className="flex items-center justify-between mt-2">
        <div className="font-mono text-2xl font-bold">{value}</div>
        <div className={`w-2 h-8 rounded-sm ${toneBg}`} />
      </div>
    </div>
  );
  return linkTo ? <Link to={linkTo}>{content}</Link> : content;
};

export default function UserDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [target, setTarget] = useState(null);
  const [perf, setPerf] = useState(null);
  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [users, p, l] = await Promise.all([
          api.get("/users"),
          api.get(`/users/${id}/performance`),
          api.get("/leads", { params: { assigned_to: id, page_size: 200 } }),
        ]);
        if (cancelled) return;
        const u = (users.data || []).find((x) => x.id === id);
        setTarget(u || null);
        setPerf(p.data);
        setLeads(l.data || []);
        if (u?.branch_id) {
          api.get(`/branches/${u.branch_id}`).then((b) => !cancelled && setBranchName(b.data?.name || "")).catch(() => {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
      // Aggregate recent follow-ups from leads
      try {
        const samples = await Promise.all((l.data || []).slice(0, 10).map((ld) =>
          api.get(`/leads/${ld.id}/followups`).then((r) => (r.data || []).map((f) => ({ ...f, lead_name: ld.customer_name, lead_id: ld.id })))
            .catch(() => [])
        ));
        if (!cancelled) setFollowups(samples.flat().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 15));
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const stages = useMemo(() => {
    const ord = ["Inquiry", "Follow-up", "Interest", "Test Ride", "Deal", "Booking", "Allotment", "Delivery", "Registration", "Feedback"];
    const map = {};
    leads.forEach((l) => { map[l.stage] = (map[l.stage] || 0) + 1; });
    return ord.map((s) => ({ stage: s, count: map[s] || 0 }));
  }, [leads]);

  const lostReasons = useMemo(() => {
    const map = {};
    leads.filter((l) => l.stage === "Lost").forEach((l) => {
      const r = l.lost_reason || "Unknown";
      map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [leads]);

  if (loading) return (<><PageHeader title="..." /><div className="p-6 text-sm text-zinc-500">{t("common.loading")}</div></>);
  if (!target) return (<><PageHeader title="User" /><div className="p-6 text-sm text-zinc-500">User not found or access denied.</div></>);

  return (
    <>
      <PageHeader
        title={target.name}
        subtitle={`${roleLabel(target.role, t)}${branchName ? ` · ${branchName}` : ""}`}
        sticky
      />
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto w-full">

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat
            label={t("dashboard.total_leads")}
            value={perf?.leads_total || 0}
            linkTo={`/leads?assigned_to=${id}`}
            testid="user-stat-total"
          />
          <Stat
            label={t("dashboard.converted")}
            value={perf?.leads_delivered || 0}
            tone="ok"
            linkTo={`/leads?assigned_to=${id}&stage=Delivery`}
            testid="user-stat-conv"
          />
          <Stat
            label={t("dashboard.lost")}
            value={perf?.leads_lost || 0}
            tone="danger"
            linkTo={`/leads?assigned_to=${id}&stage=Lost`}
            testid="user-stat-lost"
          />
          <Stat
            label={t("dash.ceo.conv", "Conversion %")}
            value={`${perf?.conversion_rate_pct || 0}%`}
            tone="brand"
            testid="user-stat-rate"
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat label={t("lead.followups")} value={perf?.followups_total || 0} tone="info" testid="user-stat-fu" />
          <Stat label="Pending" value={perf?.leads_pending || 0} tone="info" linkTo={`/leads?assigned_to=${id}`} testid="user-stat-pending" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card testid="user-funnel" title={t("dash.funnel", "Funnel")}>
            <FunnelChart data={stages} />
          </Card>
          <Card testid="user-loss" title={t("reports.loss_analysis", "Loss Analysis")}>
            {lostReasons.length === 0 ? (
              <div className="text-sm text-zinc-400">No lost leads.</div>
            ) : (
              <DonutBreakdown data={lostReasons} />
            )}
          </Card>
        </div>

        {/* Timeline of follow-ups */}
        <Card className="mt-3" testid="user-timeline" title={t("lead.timeline", "Timeline")}>
          {followups.length === 0 ? (
            <div className="text-sm text-zinc-400">No recent activity.</div>
          ) : (
            <div className="space-y-2">
              {followups.map((f) => (
                <Link
                  key={f.id}
                  to={`/leads/${f.lead_id}`}
                  className="flex items-start gap-3 p-2 hover:bg-zinc-50 rounded-sm"
                >
                  <Clock className="w-4 h-4 text-zinc-400 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-semibold">{f.lead_name}</span>
                      <span className="text-zinc-500"> · {f.type}{f.call_status ? ` · ${f.call_status}` : ""}{f.customer_response ? ` · ${f.customer_response}` : ""}</span>
                    </div>
                    {f.notes && <div className="text-xs text-zinc-600 mt-0.5 truncate">{f.notes}</div>}
                    <div className="text-xs text-zinc-400 mt-0.5">{new Date(f.created_at).toLocaleString()}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent leads */}
        <Card className="mt-3" testid="user-leads"
              title={`${t("nav.leads")} (${leads.length})`}
              right={<Link to={`/leads?assigned_to=${id}`} className="text-xs font-semibold text-brand">{t("common.see_all", "See all")} →</Link>}>
          {leads.length === 0 ? (
            <div className="text-sm text-zinc-400">No leads.</div>
          ) : (
            <div className="space-y-2">
              {leads.slice(0, 15).map((l) => (
                <Link
                  key={l.id}
                  to={`/leads/${l.id}`}
                  className={`block border rounded-sm p-3 active:bg-zinc-50 ${priorityStrip(l.priority)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{l.customer_name}</div>
                      <div className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {l.phone}
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase ${stageClass(l.stage)}`}>
                        {l.stage}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
