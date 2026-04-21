import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import {
  TrendingUp, CheckCircle2, XCircle, Clock, Flame, Users2,
  AlertTriangle, CalendarClock, BadgePercent, Gavel,
} from "lucide-react";
import { Link } from "react-router-dom";

const Card = ({ children, className = "", testid }) => (
  <div className={`bg-white border border-zinc-200 rounded-sm p-5 ${className}`} data-testid={testid}>
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
  }[tone];
  const content = (
    <Card testid={testid} className="hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <div className="overline">{label}</div>
          <div className="font-mono text-3xl font-bold mt-2 tabular">{value}</div>
        </div>
        <div className={`w-9 h-9 ${toneBg} rounded-sm flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  );
  return linkTo ? <Link to={linkTo}>{content}</Link> : content;
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [perf, setPerf] = useState([]);
  const [branchCmp, setBranchCmp] = useState([]);

  useEffect(() => {
    api.get("/analytics/summary").then((r) => setSummary(r.data)).catch(() => {});
    if (user?.role !== "sales_executive") {
      api.get("/analytics/performance").then((r) => setPerf(r.data)).catch(() => {});
    }
    if (user?.role === "super_admin") {
      api.get("/branches-compare").then((r) => setBranchCmp(r.data)).catch(() => {});
    }
  }, [user?.role]);

  if (!summary)
    return (
      <div className="p-8">
        <div className="text-zinc-500 text-sm">Loading dashboard...</div>
      </div>
    );

  const sources = Object.entries(summary.per_source || {}).sort((a, b) => b[1] - a[1]);
  const maxSource = Math.max(1, ...sources.map(([, n]) => n));
  const stages = Object.entries(summary.per_stage || {});

  return (
    <div className="p-6 md:p-10 max-w-[1400px]">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="overline mb-2">Overview</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
            Hi, {user?.name?.split(" ")[0]}.
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Here&apos;s what&apos;s happening across your pipeline today.</p>
        </div>
        <Link
          to="/leads/new"
          className="hidden md:inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-sm font-bold text-sm hover:bg-brand-dark"
          data-testid="dash-new-lead-btn"
        >
          + {t("nav.new_lead")}
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label={t("dashboard.total_leads")} value={summary.total_leads} icon={TrendingUp} testid="stat-total" />
        <Stat label={t("dashboard.converted")} value={summary.converted} icon={CheckCircle2} tone="ok" testid="stat-converted" />
        <Stat label={t("dashboard.lost")} value={summary.lost} icon={XCircle} tone="danger" testid="stat-lost" />
        <Stat label={`${t("dashboard.converted")} %`} value={`${summary.conversion_rate}%`} icon={BadgePercent} tone="info" testid="stat-conv-rate" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label={t("dashboard.followups_today")} value={summary.followups_due_today} icon={Clock} testid="stat-due-today" linkTo="/tasks?kind=today" />
        <Stat label={t("dashboard.missed")} value={summary.followups_missed} icon={AlertTriangle} tone="danger" testid="stat-missed" linkTo="/tasks?kind=missed" />
        <Stat label="Upcoming" value={summary.followups_upcoming} icon={CalendarClock} testid="stat-upcoming" linkTo="/tasks?kind=upcoming" />
        <Stat label="At Risk" value={summary.at_risk} icon={AlertTriangle} tone="warn" testid="stat-at-risk" linkTo="/tasks?kind=at_risk" />
      </div>

      {user?.role !== "sales_executive" && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <Stat label="Deals in Progress" value={summary.deals_in_progress} icon={Gavel} tone="info" testid="stat-deals-progress" />
          <Stat label="Pending Approvals" value={summary.pending_approvals} icon={AlertTriangle} tone="warn" testid="stat-pending-approvals" />
          <Stat label="Avg Discount" value={summary.avg_discount ? `₹${summary.avg_discount}` : "—"} icon={BadgePercent} testid="stat-avg-discount" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card testid="card-by-source">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="overline">Leads by source</div>
              <div className="font-display text-xl font-bold mt-1">Channel performance</div>
            </div>
            <Flame className="w-5 h-5 text-zinc-400" strokeWidth={1.75} />
          </div>
          <div className="space-y-3">
            {sources.length === 0 && <div className="text-sm text-zinc-400">No leads yet.</div>}
            {sources.map(([src, n]) => (
              <div key={src}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{src}</span>
                  <span className="font-mono text-sm text-zinc-500">{n}</span>
                </div>
                <div className="h-2 bg-zinc-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-zinc-900"
                    style={{ width: `${(n / maxSource) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card testid="card-by-stage">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="overline">Funnel</div>
              <div className="font-display text-xl font-bold mt-1">Leads by stage</div>
            </div>
            <Users2 className="w-5 h-5 text-zinc-400" strokeWidth={1.75} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {stages.length === 0 && <div className="text-sm text-zinc-400">No leads yet.</div>}
            {stages.map(([s, n]) => (
              <div
                key={s}
                className="flex items-center justify-between border border-zinc-200 rounded-sm px-3 py-2"
              >
                <span className="text-sm">{s}</span>
                <span className="font-mono font-bold">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {user?.role !== "sales_executive" && perf.length > 0 && (
        <Card testid="card-top-execs" className="mt-4">
          <div className="mb-6">
            <div className="overline">Team</div>
            <div className="font-display text-xl font-bold mt-1">Top performing sales executives</div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Leads</th>
                  <th>Converted</th>
                  <th>Lost</th>
                  <th>Missed</th>
                  <th>Connect %</th>
                  <th>Conv %</th>
                </tr>
              </thead>
              <tbody>
                {perf.map((p) => (
                  <tr key={p.user_id} data-testid={`perf-row-${p.user_id}`}>
                    <td className="font-semibold">{p.name}</td>
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

      {user?.role === "super_admin" && branchCmp.length > 0 && (
        <Card className="mt-6" testid="branch-compare-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="overline">{t("dashboard.branch_comparison")}</div>
              <div className="text-sm text-zinc-500 mt-1">{t("dashboard.branch_compare_desc")}</div>
            </div>
            <Link to="/branches" className="text-xs font-semibold text-brand hover:underline">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Code</th>
                  <th>Status</th>
                  <th>Leads</th>
                  <th>Converted</th>
                  <th>Lost</th>
                  <th>Conv %</th>
                  <th>Revenue (₹)</th>
                </tr>
              </thead>
              <tbody>
                {branchCmp.map((b) => (
                  <tr key={b.branch_id} data-testid={`branch-cmp-row-${b.branch_id}`}>
                    <td className="font-semibold">{b.name}</td>
                    <td className="font-mono text-xs">{b.code || "—"}</td>
                    <td>
                      <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"}`}>
                        {b.is_active ? "Active" : "Inactive"}
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
    </div>
  );
}
