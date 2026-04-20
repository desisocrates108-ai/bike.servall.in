import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import { TrendingUp, CheckCircle2, XCircle, Clock, Flame, Users2 } from "lucide-react";
import { Link } from "react-router-dom";

const Card = ({ children, className = "", testid }) => (
  <div className={`bg-white border border-zinc-200 rounded-sm p-5 ${className}`} data-testid={testid}>
    {children}
  </div>
);

const Stat = ({ label, value, icon: Icon, testid }) => (
  <Card testid={testid} className="hover:border-zinc-300 transition-colors">
    <div className="flex items-start justify-between">
      <div>
        <div className="overline">{label}</div>
        <div className="font-mono text-3xl font-bold mt-2 tabular">{value}</div>
      </div>
      <div className="w-9 h-9 bg-zinc-900 rounded-sm flex items-center justify-center">
        <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
      </div>
    </div>
  </Card>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get("/analytics/summary").then((r) => setSummary(r.data)).catch(() => {});
  }, []);

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
          className="hidden md:inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-sm font-bold text-sm hover:bg-zinc-800"
          data-testid="dash-new-lead-btn"
        >
          + New Lead
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Total Leads" value={summary.total_leads} icon={TrendingUp} testid="stat-total" />
        <Stat label="Converted" value={summary.converted} icon={CheckCircle2} testid="stat-converted" />
        <Stat label="Lost" value={summary.lost} icon={XCircle} testid="stat-lost" />
        <Stat label="Follow-ups Today" value={summary.followups_due_today} icon={Clock} testid="stat-fu-today" />
      </div>

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
    </div>
  );
}
