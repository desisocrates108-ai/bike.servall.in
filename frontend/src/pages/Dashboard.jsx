import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import DateRangeFilter from "../components/DateRangeFilter";
import GujaratiCalendar from "../components/GujaratiCalendar";
import {
  TrendingUp, CheckCircle2, XCircle, Clock, Flame, Users2,
  AlertTriangle, CalendarClock, BadgePercent, Gavel, PhoneCall,
  ArrowRight, Target, BarChart3, Lightbulb, TrendingDown,
} from "lucide-react";
import { BarChart as SimpleBarChart } from "../components/Charts";

const Card = ({ children, className = "", testid }) => (
  <div className={`bg-white border border-zinc-200 rounded-sm p-4 sm:p-5 ${className}`} data-testid={testid}>
    {children}
  </div>
);

const Stat = ({ label, value, icon: Icon, tone = "dark", testid, linkTo }) => {
  const toneBg = {
    dark: "bg-zinc-900",
    danger: "bg-rose-600",
    warn: "bg-amber-500",
    ok: "bg-emerald-600",
    info: "bg-blue-600",
    brand: "bg-brand",
  }[tone];
  const content = (
    <Card testid={testid} className="hover:border-zinc-300 transition-colors active:bg-zinc-50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="overline leading-tight" style={{ wordBreak: "break-word", whiteSpace: "normal" }}>{label}</div>
          <div className="font-mono text-xl sm:text-2xl md:text-3xl font-bold mt-1 sm:mt-2 tabular">{value}</div>
        </div>
        <div className={`w-8 h-8 sm:w-9 sm:h-9 ${toneBg} rounded-sm flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
  return linkTo ? <Link to={linkTo}>{content}</Link> : content;
};

const ActionTile = ({ to, icon: Icon, title, desc, tone = "brand", testid }) => (
  <Link
    to={to}
    className="flex items-start gap-3 p-4 bg-white border border-zinc-200 rounded-sm hover:border-brand active:bg-zinc-50 transition-colors"
    data-testid={testid}
  >
    <div className={`w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0 ${
      tone === "brand" ? "bg-brand/10 text-brand" :
      tone === "warn" ? "bg-amber-100 text-amber-700" :
      tone === "ok" ? "bg-emerald-100 text-emerald-700" :
      "bg-zinc-100 text-zinc-700"
    }`}>
      <Icon className="w-5 h-5" strokeWidth={1.75} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-xs text-zinc-500 mt-0.5">{desc}</div>
    </div>
    <ArrowRight className="w-4 h-4 text-zinc-400 mt-2" />
  </Link>
);

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const [summary, setSummary] = useState(null);
  const [perf, setPerf] = useState([]);
  const [branchCmp, setBranchCmp] = useState([]);
  const [hotLeads, setHotLeads] = useState([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches] = useState([]);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [lostBreakdown, setLostBreakdown] = useState([]);

  useEffect(() => {
    if (user?.role === "super_admin") {
      api.get("/branches").then((r) => setBranches(r.data || [])).catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    const params = {
      ...(branchFilter ? { branch_id: branchFilter } : {}),
      ...(dateRange.from ? { from_date: dateRange.from } : {}),
      ...(dateRange.to ? { to_date: dateRange.to } : {}),
    };
    api.get("/analytics/summary", { params }).then((r) => setSummary(r.data)).catch(() => {});
    if (user?.role !== "sales_executive") {
      api.get("/analytics/performance", { params }).then((r) => setPerf(r.data)).catch(() => {});
    }
    if (user?.role === "super_admin" && !branchFilter) {
      api.get("/branches-compare").then((r) => setBranchCmp(r.data)).catch(() => {});
    } else if (user?.role === "super_admin") {
      setBranchCmp([]);
    }
    const leadParams = { priority: "Hot", ...(branchFilter ? { branch_id: branchFilter } : {}) };
    api.get("/leads", { params: leadParams }).then((r) => setHotLeads((r.data || []).slice(0, 5))).catch(() => {});
    // Lost analysis breakdown — fetch Lost leads and group by lost_reason
    if (user?.role !== "sales_executive") {
      const lostParams = { stage: "Lost", page_size: 500, ...(branchFilter ? { branch_id: branchFilter } : {}) };
      api.get("/leads", { params: lostParams }).then((r) => {
        const counts = {};
        (r.data || []).forEach((l) => {
          const k = l.lost_reason || "Unspecified";
          counts[k] = (counts[k] || 0) + 1;
        });
        setLostBreakdown(Object.entries(counts).sort((a, b) => b[1] - a[1]));
      }).catch(() => {});
    }
  }, [user?.role, branchFilter, dateRange.from, dateRange.to]);

  const stages = useMemo(() => Object.entries(summary?.per_stage || {}), [summary]);
  const sources = useMemo(
    () => Object.entries(summary?.per_source || {}).sort((a, b) => b[1] - a[1]),
    [summary]
  );
  const maxSource = Math.max(1, ...sources.map(([, n]) => n));

  if (!summary) {
    return (
      <>
        <PageHeader title={t("dashboard.title", "Dashboard")} showBack={false} sticky />
        <div className="p-6 text-sm text-zinc-500">{t("common.loading")}</div>
      </>
    );
  }

  const isSales = user?.role === "sales_executive";
  const isAdmin = user?.role === "admin";
  const isCEO = user?.role === "super_admin";

  const firstName = user?.name?.split(" ")[0] || "there";

  // Action suggestions for Sales Exec
  const overdue = summary.followups_missed || 0;
  const today = summary.followups_due_today || 0;
  const atRisk = summary.at_risk || 0;

  return (
    <>
      <PageHeader
        title={isSales ? t("dash.sales.hi", "Hi, {{n}}", { n: firstName }) :
               isAdmin ? t("dash.admin.hi", "Branch Control") :
               t("dash.ceo.hi", "Decision Center")}
        subtitle={
          isSales ? t("dash.sales.sub", "Your actions for today") :
          isAdmin ? t("dash.admin.sub", "Performance, funnel drop-offs & team") :
          t("dash.ceo.sub", "Branches, insights & loss analysis")
        }
        showBack={false}
        sticky
        right={
          <div className="flex items-center gap-2">
            <DateRangeFilter value={dateRange} onChange={setDateRange} testid="dash-date-range" />
            {isCEO && branches.length > 0 ? (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="h-10 rounded-sm border border-zinc-200 bg-white px-3 text-sm font-medium focus:outline-none focus:border-brand"
                data-testid="dash-branch-filter"
              >
                <option value="">{t("dash.all_branches", "All branches")}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : null}
          </div>
        }
      />

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto w-full">

        {/* SALES EXEC: Action-based */}
        {isSales && (
          <>
            {(overdue > 0 || today > 0) && (
              <div className="mb-4 p-4 rounded-sm border-l-4 border-brand bg-white">
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="w-4 h-4 text-brand" /> <span className="overline">{t("dash.sales.smart", "Smart Actions")}</span>
                </div>
                <div className="text-sm">
                  {overdue > 0 && (
                    <div className="text-rose-700 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                      {t("dash.sales.overdue", "{{n}} overdue follow-ups — call now!", { n: overdue })}
                    </div>
                  )}
                  {today > 0 && (
                    <div className="text-zinc-700 mt-1">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      {t("dash.sales.today", "{{n}} follow-ups due today", { n: today })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <Stat label={t("dash.sales.my_leads", "My Leads")} value={summary.total_leads} icon={Users2} testid="stat-total" linkTo="/leads" />
              <Stat label={t("dashboard.followups_today")} value={today} icon={Clock} tone="brand" testid="stat-due-today" linkTo="/tasks?kind=today" />
              <Stat label={t("dashboard.missed")} value={overdue} icon={AlertTriangle} tone="danger" testid="stat-missed" linkTo="/tasks?kind=missed" />
              <Stat label={t("dash.sales.hot", "Hot Leads")} value={summary.per_priority?.Hot || 0} icon={Flame} tone="danger" testid="stat-hot" linkTo="/leads?priority=Hot" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <ActionTile to="/tasks?kind=today" icon={PhoneCall} title={t("dash.sales.call_now", "Call today's list")} desc={t("dash.sales.call_now_desc", "Start with the earliest scheduled slot")} testid="action-call-now" />
              <ActionTile to="/leads/new" icon={TrendingUp} title={t("nav.new_lead")} desc={t("dash.sales.new_desc", "Capture a walk-in or phone inquiry")} tone="ok" testid="action-new-lead" />
            </div>

            {hotLeads.length > 0 && (
              <Card testid="card-hot-leads" className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="overline">{t("dash.sales.hot_list", "Hot leads — act now")}</div>
                  <Link to="/leads?priority=Hot" className="text-xs font-semibold text-brand">
                    {t("common.see_all", "See all")} →
                  </Link>
                </div>
                {hotLeads.map((l) => (
                  <Link key={l.id} to={`/leads/${l.id}`} className="flex items-center justify-between py-2 border-b last:border-0 border-zinc-100 hover:bg-zinc-50 -mx-2 px-2 rounded-sm">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{l.customer_name}</div>
                      <div className="text-xs text-zinc-500 font-mono">{l.phone} · {l.stage}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400" />
                  </Link>
                ))}
              </Card>
            )}
          </>
        )}

        {/* ADMIN: Control-based */}
        {isAdmin && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <Stat label={t("dashboard.total_leads")} value={summary.total_leads} icon={TrendingUp} testid="stat-total" linkTo="/leads" />
              <Stat label={t("dashboard.converted")} value={summary.converted} icon={CheckCircle2} tone="ok" testid="stat-converted" linkTo="/leads?stage=Delivery" />
              <Stat label={t("dashboard.lost")} value={summary.lost} icon={XCircle} tone="danger" testid="stat-lost" linkTo="/leads?stage=Lost" />
              <Stat label={`${t("dashboard.converted")} %`} value={`${summary.conversion_rate}%`} icon={BadgePercent} tone="info" testid="stat-conv-rate" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <Stat label={t("dashboard.followups_today")} value={today} icon={Clock} testid="stat-due-today" linkTo="/tasks?kind=today" />
              <Stat label={t("dashboard.missed")} value={overdue} icon={AlertTriangle} tone="danger" testid="stat-missed" linkTo="/tasks?kind=missed" />
              <Stat label={t("dash.admin.at_risk", "At Risk")} value={atRisk} icon={AlertTriangle} tone="warn" testid="stat-at-risk" linkTo="/tasks?kind=at_risk" />
              <Stat label={t("dash.admin.deals", "Deals in Progress")} value={summary.deals_in_progress || 0} icon={Gavel} tone="info" testid="stat-deals-progress" linkTo="/leads?stage=Deal" />
            </div>
          </>
        )}

        {/* CEO: Decision-based */}
        {isCEO && (
          <div data-testid="ceo-insights">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <Stat label={t("dashboard.total_leads")} value={summary.total_leads} icon={TrendingUp} testid="stat-total" linkTo="/leads" />
              <Stat label={t("dashboard.converted")} value={summary.converted} icon={CheckCircle2} tone="ok" testid="stat-converted" linkTo="/leads?stage=Delivery" />
              <Stat label={t("dashboard.lost")} value={summary.lost} icon={XCircle} tone="danger" testid="stat-lost" linkTo="/leads?stage=Lost" />
              <Stat label={t("dash.ceo.conv", "Conversion %")} value={`${summary.conversion_rate}%`} icon={Target} tone="brand" testid="stat-conv-rate" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <Stat label={t("dash.ceo.deals_progress", "Deals in Progress")} value={summary.deals_in_progress || 0} icon={Gavel} tone="info" testid="stat-deals" linkTo="/leads?stage=Deal" />
              <Stat label={t("dash.ceo.pending", "Pending Approvals")} value={summary.pending_approvals || 0} icon={AlertTriangle} tone="warn" testid="stat-pending" />
              <Stat label={t("dash.ceo.avg_disc", "Avg Discount")} value={summary.avg_discount ? `₹${summary.avg_discount}` : "—"} icon={BadgePercent} testid="stat-avg-disc" />
            </div>

            {/* Gujarati Calendar widget */}
            <div className="mb-4" data-testid="dash-calendar-wrap">
              <GujaratiCalendar />
            </div>
          </div>
        )}

        {/* Admin: also show the Calendar */}
        {isAdmin && (
          <div className="mb-4" data-testid="dash-calendar-wrap-admin">
            <GujaratiCalendar />
          </div>
        )}

        {/* Funnel + Source — all roles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card testid="card-by-source">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="overline">{t("dash.channel", "Leads by source")}</div>
                <div className="font-display text-lg font-bold mt-1">{t("dash.channel_perf", "Channel performance")}</div>
              </div>
              <Flame className="w-5 h-5 text-zinc-400" strokeWidth={1.75} />
            </div>
            <div className="space-y-3">
              {sources.length === 0 && <div className="text-sm text-zinc-400">{t("dash.no_leads", "No leads yet.")}</div>}
              {sources.map(([src, n]) => (
                <Link
                  key={src}
                  to={`/leads?source=${encodeURIComponent(src)}`}
                  className="block hover:opacity-90 active:opacity-80"
                  data-testid={`source-${src}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{src}</span>
                    <span className="font-mono text-sm text-zinc-500">{n}</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-sm overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${(n / maxSource) * 100}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card testid="card-by-stage">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="overline">{t("dash.funnel", "Funnel")}</div>
                <div className="font-display text-lg font-bold mt-1">{t("dash.by_stage", "Leads by stage")}</div>
              </div>
              <BarChart3 className="w-5 h-5 text-zinc-400" strokeWidth={1.75} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {stages.length === 0 && <div className="text-sm text-zinc-400">{t("dash.no_leads", "No leads yet.")}</div>}
              {stages.map(([s, n]) => (
                <Link
                  key={s}
                  to={`/leads?stage=${encodeURIComponent(s)}`}
                  className="flex items-center justify-between border border-zinc-200 rounded-sm px-3 py-2 hover:border-brand active:bg-zinc-50"
                  data-testid={`funnel-${s}`}
                >
                  <span className="text-sm truncate">{s}</span>
                  <span className="font-mono font-bold">{n}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Team performance — admin/ceo */}
        {!isSales && perf.length > 0 && (
          <Card testid="card-top-execs" className="mt-4">
            <div className="mb-4">
              <div className="overline">{t("dash.team", "Team")}</div>
              <div className="font-display text-lg font-bold mt-1">{t("dash.top_execs", "Top performing sales executives")}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>{t("common.name")}</th>
                    <th>{t("dashboard.total_leads")}</th>
                    <th>{t("dashboard.converted")}</th>
                    <th>{t("dashboard.lost")}</th>
                    <th>{t("dashboard.missed")}</th>
                    <th>{t("dash.connect_pct", "Connect %")}</th>
                    <th>{t("dash.ceo.conv", "Conversion %")}</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.map((p) => (
                    <tr
                      key={p.user_id}
                      data-testid={`perf-row-${p.user_id}`}
                      onClick={() => nav(`/users/${p.user_id}`)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <td className="font-semibold text-brand hover:underline">{p.name}</td>
                      <td className="font-mono">{p.total_leads}</td>
                      <td className="font-mono text-emerald-700">{p.converted}</td>
                      <td className="font-mono text-rose-700">{p.lost}</td>
                      <td className="font-mono text-amber-700">{p.missed_followups}</td>
                      <td className="font-mono">{p.connect_rate}%</td>
                      <td className="font-mono font-bold">{p.conversion_rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* CEO — branch compare */}
        {isCEO && branchCmp.length > 0 && (
          <Card className="mt-4" testid="branch-compare-card">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="overline">{t("dashboard.branch_comparison")}</div>
                <div className="text-sm text-zinc-500 mt-1">{t("dashboard.branch_compare_desc")}</div>
              </div>
              <Link to="/branches" className="text-xs font-semibold text-brand hover:underline">
                {t("common.see_all", "See all")} →
              </Link>
            </div>

            {/* Visual bar chart of leads by branch */}
            <div className="mb-4">
              <SimpleBarChart
                data={branchCmp.map((b) => ({ id: b.branch_id, label: b.name, value: b.leads_total }))}
                onClick={(d) => nav(`/branches/${d.id}`)}
                testid="branch-compare-bar"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>{t("dashboard.branch_comparison")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("dashboard.total_leads")}</th>
                    <th>{t("dashboard.converted")}</th>
                    <th>{t("dashboard.lost")}</th>
                    <th>{t("dash.ceo.conv", "Conversion %")}</th>
                    <th>{t("dash.ceo.revenue", "Revenue (₹)")}</th>
                  </tr>
                </thead>
                <tbody>
                  {branchCmp.map((b) => (
                    <tr
                      key={b.branch_id}
                      data-testid={`branch-cmp-row-${b.branch_id}`}
                      onClick={() => nav(`/branches/${b.branch_id}`)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <td className="font-semibold text-brand hover:underline">{b.name}</td>
                      <td>
                        <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}>
                          {b.is_active ? t("common.active") : t("common.inactive")}
                        </span>
                      </td>
                      <td className="font-mono">{b.leads_total}</td>
                      <td className="font-mono text-emerald-700">{b.leads_delivered}</td>
                      <td className="font-mono text-rose-700">{b.leads_lost}</td>
                      <td className="font-mono font-bold">{b.conversion_rate_pct}%</td>
                      <td className="font-mono">{Number(b.revenue || 0).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Loss analysis breakdown — CEO + Admin */}
        {!isSales && lostBreakdown.length > 0 && (
          <Card testid="loss-breakdown-card" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <div>
                  <div className="overline">{t("dash.ceo.loss", "Loss analysis")}</div>
                  <div className="font-display text-lg font-bold mt-1">Why are we losing leads?</div>
                </div>
              </div>
              <Link to="/leads?stage=Lost" className="text-xs font-semibold text-brand hover:underline">
                {t("common.see_all", "See all")} →
              </Link>
            </div>
            {(() => {
              const totalLost = lostBreakdown.reduce((s, [, n]) => s + n, 0) || 1;
              return (
                <div className="space-y-2">
                  {lostBreakdown.map(([reason, n]) => {
                    const pct = Math.round((n / totalLost) * 100);
                    return (
                      <Link
                        key={reason}
                        to={`/leads?stage=Lost`}
                        className="block hover:opacity-90"
                        data-testid={`loss-reason-${reason.replace(/\s+/g, "-")}`}
                      >
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <span className="font-semibold truncate">{reason}</span>
                          <span className="font-mono text-zinc-500">{n} ({pct}%)</span>
                        </div>
                        <div className="h-2.5 bg-zinc-100 rounded-sm overflow-hidden">
                          <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
        )}

        {summary.at_risk > 0 && (
          <div className="mt-4">
            <Stat
              label={t("dash.ceo.at_risk_banner", "Leads at risk of being lost")}
              value={summary.at_risk}
              icon={AlertTriangle}
              tone="warn"
              testid="stat-at-risk-banner"
              linkTo="/tasks?kind=at_risk"
            />
          </div>
        )}
      </div>
    </>
  );
}
