import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { FunnelChart, BarChart, DonutBreakdown } from "../components/Charts";
import { TrendingUp, CheckCircle2, XCircle, Users2, Building2 } from "lucide-react";

const CONVERTED_STAGES = ["Delivery", "Registration", "Feedback"];

const Card = ({ title, children, right, testid }) => (
  <div className="bg-white border border-zinc-200 rounded-sm p-4 sm:p-5" data-testid={testid}>
    <div className="flex items-center justify-between mb-3">
      <div className="overline">{title}</div>
      {right}
    </div>
    {children}
  </div>
);

export default function Reports() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const isCEO = user?.role === "super_admin";

  useEffect(() => {
    Promise.all([
      api.get("/users").catch(() => ({ data: [] })),
      api.get("/branches").catch(() => ({ data: [] })),
      api.get("/brands").catch(() => ({ data: [] })),
      api.get("/models").catch(() => ({ data: [] })),
    ]).then(([u, b, br, m]) => {
      setUsers(u.data || []);
      setBranches(b.data || []);
      setBrands(br.data || []);
      setModels(m.data || []);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page_size: 1000, ...(branchFilter ? { branch_id: branchFilter } : {}) };
    api.get("/leads", { params })
      .then((r) => setLeads(r.data || []))
      .finally(() => setLoading(false));
  }, [branchFilter]);

  const brandMap = useMemo(() => Object.fromEntries(brands.map((x) => [x.id, x.name])), [brands]);
  const modelMap = useMemo(() => Object.fromEntries(models.map((x) => [x.id, x.name])), [models]);
  const userMap = useMemo(() => Object.fromEntries(users.map((x) => [x.id, x])), [users]);
  const branchMap = useMemo(() => Object.fromEntries(branches.map((x) => [x.id, x])), [branches]);

  // Source performance
  const sourceStats = useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      const src = l.source || "Unknown";
      if (!map[src]) map[src] = { label: src, total: 0, converted: 0, lost: 0 };
      map[src].total++;
      if (CONVERTED_STAGES.includes(l.stage)) map[src].converted++;
      if (l.stage === "Lost") map[src].lost++;
    });
    return Object.values(map).map((r) => ({
      ...r,
      conv_pct: r.total ? Math.round((r.converted / r.total) * 100) : 0,
      loss_pct: r.total ? Math.round((r.lost / r.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [leads]);

  // Brand performance
  const brandStats = useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      const b = brandMap[l.brand_id] || "Unknown";
      if (!map[b]) map[b] = { label: b, total: 0, converted: 0 };
      map[b].total++;
      if (CONVERTED_STAGES.includes(l.stage)) map[b].converted++;
    });
    return Object.values(map).sort((a, b) => b.converted - a.converted);
  }, [leads, brandMap]);

  // Model performance — top 10 sold
  const modelStats = useMemo(() => {
    const map = {};
    leads.filter((l) => CONVERTED_STAGES.includes(l.stage)).forEach((l) => {
      const m = modelMap[l.model_id] || "Unknown";
      if (!map[m]) map[m] = { label: m, value: 0 };
      map[m].value++;
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [leads, modelMap]);

  // Sales exec performance (by count)
  const execStats = useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      if (!l.assigned_to) return;
      const u = userMap[l.assigned_to];
      if (!u) return;
      if (!map[u.id]) map[u.id] = { id: u.id, label: u.name, total: 0, converted: 0, lost: 0 };
      map[u.id].total++;
      if (CONVERTED_STAGES.includes(l.stage)) map[u.id].converted++;
      if (l.stage === "Lost") map[u.id].lost++;
    });
    return Object.values(map).map((r) => ({
      ...r,
      conv_pct: r.total ? Math.round((r.converted / r.total) * 100) : 0,
    })).sort((a, b) => b.converted - a.converted);
  }, [leads, userMap]);

  // Funnel
  const stages = useMemo(() => {
    const ord = ["Inquiry", "Follow-up", "Interest", "Test Ride", "Deal", "Booking", "Allotment", "Delivery", "Registration", "Feedback"];
    const map = {};
    leads.forEach((l) => { map[l.stage] = (map[l.stage] || 0) + 1; });
    return ord.map((s) => ({ stage: s, count: map[s] || 0 }));
  }, [leads]);

  // Loss reasons
  const lossStats = useMemo(() => {
    const map = {};
    leads.filter((l) => l.stage === "Lost").forEach((l) => {
      const r = l.lost_reason || "Unknown";
      map[r] = (map[r] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [leads]);

  // Browse-only vs converted
  const behaviourStats = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter((l) => CONVERTED_STAGES.includes(l.stage)).length;
    const lost = leads.filter((l) => l.stage === "Lost").length;
    const browse = total - converted - lost;
    return [
      { label: "Converted", value: converted },
      { label: "Browse (in progress)", value: browse },
      { label: "Lost", value: lost },
    ];
  }, [leads]);

  // Branch performance (for CEO)
  const branchStats = useMemo(() => {
    if (!isCEO) return [];
    const map = {};
    leads.forEach((l) => {
      if (!l.branch_id) return;
      const bn = branchMap[l.branch_id]?.name || "Unknown";
      if (!map[bn]) map[bn] = { id: l.branch_id, label: bn, total: 0, converted: 0, lost: 0 };
      map[bn].total++;
      if (CONVERTED_STAGES.includes(l.stage)) map[bn].converted++;
      if (l.stage === "Lost") map[bn].lost++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [leads, branchMap, isCEO]);

  const totalLeads = leads.length;
  const totalConverted = leads.filter((l) => CONVERTED_STAGES.includes(l.stage)).length;
  const totalLost = leads.filter((l) => l.stage === "Lost").length;
  const convPct = totalLeads ? Math.round((totalConverted / totalLeads) * 100) : 0;

  return (
    <>
      <PageHeader
        title={t("reports.title", "Reports & Analytics")}
        subtitle={`${totalLeads} leads · ${convPct}% converted`}
        sticky
        right={
          isCEO && branches.length > 0 ? (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-10 rounded-sm border border-zinc-200 bg-white px-3 text-sm font-medium focus:outline-none focus:border-brand"
              data-testid="reports-branch-filter"
            >
              <option value="">{t("dash.all_branches", "All branches")}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : null
        }
      />
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto w-full">
        {loading && <div className="py-8 text-center text-sm text-zinc-400">{t("common.loading")}</div>}

        {/* Top KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <KPI label={t("dashboard.total_leads")} value={totalLeads} icon={TrendingUp} tone="dark" />
          <KPI label={t("dashboard.converted")} value={totalConverted} icon={CheckCircle2} tone="ok" />
          <KPI label={t("dashboard.lost")} value={totalLost} icon={XCircle} tone="danger" />
          <KPI label={t("dash.ceo.conv", "Conversion %")} value={`${convPct}%`} icon={Users2} tone="brand" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Source Conversion */}
          <Card title={t("reports.source_intel", "Lead Source Intelligence")} testid="rep-source">
            {sourceStats.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Total</th>
                      <th>Converted</th>
                      <th>Lost</th>
                      <th>Conv %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceStats.map((r) => (
                      <tr key={r.label} data-testid={`rep-source-row-${r.label}`}>
                        <td className="font-semibold">{r.label}</td>
                        <td className="font-mono">{r.total}</td>
                        <td className="font-mono text-emerald-700">{r.converted}</td>
                        <td className="font-mono text-rose-700">{r.lost}</td>
                        <td className="font-mono font-bold">{r.conv_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Loss Analysis */}
          <Card title={t("reports.loss_analysis", "Loss Analysis")} testid="rep-loss">
            {lossStats.length === 0 ? <Empty text="No lost leads." /> : <DonutBreakdown data={lossStats} />}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          {/* Funnel */}
          <Card title={t("reports.funnel", "Sales Funnel Report")} testid="rep-funnel">
            <FunnelChart data={stages} />
          </Card>

          {/* Behavior */}
          <Card title="Customer Behaviour" testid="rep-behaviour">
            <DonutBreakdown data={behaviourStats} />
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          {/* Brand Performance */}
          <Card title="Brand Performance (converted)" testid="rep-brand">
            {brandStats.length === 0 ? <Empty /> : (
              <BarChart
                data={brandStats.map((b) => ({ id: b.label, label: `${b.label} (${b.converted}/${b.total})`, value: b.converted }))}
              />
            )}
          </Card>

          {/* Model Top 10 */}
          <Card title={t("reports.product_demand", "Product & Demand — Top 10 sold")} testid="rep-model">
            {modelStats.length === 0 ? <Empty text="No deliveries yet." /> : <BarChart data={modelStats} />}
          </Card>
        </div>

        {/* Sales Exec Performance */}
        {user?.role !== "sales_executive" && (
          <Card className="mt-3" title={t("reports.sales_perf", "Sales Performance")} testid="rep-exec">
            {execStats.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Sales Executive</th>
                      <th>Total</th>
                      <th>Converted</th>
                      <th>Lost</th>
                      <th>Conv %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execStats.map((e) => (
                      <tr key={e.id} data-testid={`rep-exec-row-${e.id}`}
                          onClick={() => window.location.assign(`/users/${e.id}`)}
                          className="cursor-pointer hover:bg-zinc-50">
                        <td className="font-semibold text-brand hover:underline">{e.label}</td>
                        <td className="font-mono">{e.total}</td>
                        <td className="font-mono text-emerald-700">{e.converted}</td>
                        <td className="font-mono text-rose-700">{e.lost}</td>
                        <td className="font-mono font-bold">{e.conv_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Branch Comparison (CEO only) */}
        {isCEO && branchStats.length > 0 && !branchFilter && (
          <Card className="mt-3" title={t("dashboard.branch_comparison", "Branch Comparison")} testid="rep-branch"
                right={<Building2 className="w-4 h-4 text-zinc-400" />}>
            <BarChart
              data={branchStats.map((b) => ({ id: b.id, label: `${b.label} (${b.converted}/${b.total})`, value: b.converted }))}
              onClick={(d) => window.location.assign(`/branches/${d.id}`)}
            />
          </Card>
        )}
      </div>
    </>
  );
}

function KPI({ label, value, icon: Icon, tone }) {
  const toneBg = { dark: "bg-zinc-900", ok: "bg-emerald-600", danger: "bg-rose-600", brand: "bg-brand" }[tone];
  return (
    <div className="bg-white border border-zinc-200 rounded-sm p-4">
      <div className="overline leading-tight" style={{ wordBreak: "break-word", whiteSpace: "normal" }}>{label}</div>
      <div className="flex items-center justify-between mt-2">
        <div className="font-mono text-2xl font-bold">{value}</div>
        <div className={`w-8 h-8 rounded-sm ${toneBg} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

const Empty = ({ text = "No data yet." }) => (
  <div className="text-sm text-zinc-400">{text}</div>
);
