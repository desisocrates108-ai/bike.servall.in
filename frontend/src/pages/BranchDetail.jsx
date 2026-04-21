import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { FunnelChart, DonutBreakdown, BarChart } from "../components/Charts";
import { priorityClass, stageClass, priorityStrip } from "../lib/labels";
import {
  TrendingUp, CheckCircle2, XCircle, Users2, Building2, BadgePercent,
  ArrowRight, ChevronRight, Flame,
} from "lucide-react";

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

const Stat = ({ label, value, tone, linkTo, testid }) => {
  const toneBg = {
    dark: "bg-zinc-900",
    danger: "bg-rose-600",
    ok: "bg-emerald-600",
    brand: "bg-brand",
    info: "bg-blue-600",
  }[tone || "dark"];
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

export default function BranchDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [branch, setBranch] = useState(null);
  const [perf, setPerf] = useState(null);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [b, p, u, l] = await Promise.all([
          api.get(`/branches/${id}`),
          api.get(`/branches/${id}/performance`),
          api.get("/users").catch(() => ({ data: [] })),
          api.get("/leads", { params: { branch_id: id, page_size: 200 } }).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setBranch(b.data);
        setPerf(p.data);
        setUsers((u.data || []).filter((x) => x.branch_id === id));
        setLeads(l.data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const execPerf = useMemo(() => {
    if (!users.length || !leads.length) return [];
    return users.map((u) => {
      const uLeads = leads.filter((l) => l.assigned_to === u.id);
      const converted = uLeads.filter((l) => ["Delivery", "Registration", "Feedback"].includes(l.stage)).length;
      const lost = uLeads.filter((l) => l.stage === "Lost").length;
      return {
        id: u.id,
        label: u.name,
        value: uLeads.length,
        converted,
        lost,
        conv: uLeads.length ? Math.round((converted / uLeads.length) * 100) : 0,
      };
    }).sort((a, b) => b.value - a.value);
  }, [users, leads]);

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

  const sources = useMemo(() => {
    const map = {};
    leads.forEach((l) => { map[l.source] = (map[l.source] || 0) + 1; });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [leads]);

  if (loading) {
    return (
      <>
        <PageHeader title={t("common.loading", "Loading...")} />
        <div className="p-6 text-sm text-zinc-500">{t("common.loading")}</div>
      </>
    );
  }
  if (!branch) {
    return (
      <>
        <PageHeader title="Branch" />
        <div className="p-6 text-sm text-zinc-500">Branch not found.</div>
      </>
    );
  }

  const recent = leads.slice(0, 20);
  const canAccess = user?.role === "super_admin" || (user?.role === "admin" && user?.branch_id === id);

  return (
    <>
      <PageHeader
        title={branch.name}
        subtitle={`${branch.code || "—"} · ${perf?.leads_total || 0} ${t("dashboard.total_leads").toLowerCase()}`}
        sticky
        right={
          <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${branch.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}>
            {branch.is_active ? t("common.active") : t("common.inactive")}
          </span>
        }
      />
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto w-full">

        {!canAccess && user?.role !== "sales_executive" && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-sm text-sm text-amber-800">
            You can only view performance of this branch, not all leads.
          </div>
        )}

        {/* KPIs — clickable filter */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Stat
            label={t("dashboard.total_leads")}
            value={perf?.leads_total || 0}
            tone="dark"
            linkTo={`/leads?branch_id=${id}`}
            testid="branch-stat-total"
          />
          <Stat
            label={t("dashboard.converted")}
            value={perf?.leads_delivered || 0}
            tone="ok"
            linkTo={`/leads?branch_id=${id}&stage=Delivery`}
            testid="branch-stat-converted"
          />
          <Stat
            label={t("dashboard.lost")}
            value={perf?.leads_lost || 0}
            tone="danger"
            linkTo={`/leads?branch_id=${id}&stage=Lost`}
            testid="branch-stat-lost"
          />
          <Stat
            label={t("dash.ceo.conv", "Conversion %")}
            value={`${perf?.conversion_rate_pct || 0}%`}
            tone="brand"
            testid="branch-stat-conv"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Funnel */}
          <Card testid="branch-funnel" title={t("dash.funnel", "Funnel")}>
            <FunnelChart
              data={stages}
              onClickStage={(s) => nav(`/leads?branch_id=${id}&stage=${encodeURIComponent(s)}`)}
            />
          </Card>

          {/* Team */}
          <Card
            testid="branch-team"
            title={t("dash.team", "Team")}
            right={<span className="text-xs text-zinc-500">{users.length} members</span>}
          >
            {execPerf.length === 0 ? (
              <div className="text-sm text-zinc-400">No executives in this branch.</div>
            ) : (
              <div className="space-y-2">
                {execPerf.map((e) => (
                  <Link
                    key={e.id}
                    to={`/users/${e.id}`}
                    className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 -mx-2 px-2 rounded-sm"
                    data-testid={`branch-exec-${e.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{e.label}</div>
                      <div className="text-xs text-zinc-500">
                        {e.value} leads · {e.converted} converted · {e.conv}% conv
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          {/* Loss reasons */}
          <Card testid="branch-loss" title={t("reports.loss_analysis", "Loss Analysis")}>
            {lostReasons.length === 0 ? (
              <div className="text-sm text-zinc-400">No lost leads.</div>
            ) : (
              <DonutBreakdown data={lostReasons} />
            )}
          </Card>

          {/* Source */}
          <Card testid="branch-sources" title={t("dash.channel", "Leads by source")}>
            {sources.length === 0 ? (
              <div className="text-sm text-zinc-400">No data.</div>
            ) : (
              <BarChart data={sources} />
            )}
          </Card>
        </div>

        {/* Recent leads */}
        <Card testid="branch-recent" title={`${t("nav.leads")} (${leads.length})`} className="mt-3"
              right={
                <Link to={`/leads?branch_id=${id}`} className="text-xs font-semibold text-brand">
                  {t("common.see_all", "See all")} →
                </Link>
              }>
          {recent.length === 0 ? (
            <div className="text-sm text-zinc-400">No leads.</div>
          ) : (
            <div className="space-y-2">
              {recent.map((l) => (
                <Link
                  key={l.id}
                  to={`/leads/${l.id}`}
                  className={`block border rounded-sm p-3 active:bg-zinc-50 ${priorityStrip(l.priority)}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{l.customer_name}</div>
                      <div className="text-xs text-zinc-500 font-mono">{l.phone}</div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase ${stageClass(l.stage)}`}>
                        {l.stage}
                      </span>
                      <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase border ${priorityClass(l.priority)}`}>
                        {l.priority}
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
