import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { priorityClass, priorityStrip, stageClass } from "../lib/labels";
import { Clock, AlertTriangle, CalendarClock, AlertCircle, ChevronRight } from "lucide-react";
import PageHeader from "../components/PageHeader";

const TABS = [
  { key: "today", label: "Today", icon: Clock },
  { key: "missed", label: "Missed", icon: AlertTriangle },
  { key: "upcoming", label: "Upcoming", icon: CalendarClock },
  { key: "at_risk", label: "At Risk", icon: AlertCircle },
];

export default function Tasks() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const active = params.get("kind") || "today";
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/users").then((r) => setUsers(r.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get("/tasks", { params: { kind: active } })
      .then((r) => setLeads(r.data))
      .finally(() => setLoading(false));
  }, [active]);

  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  return (
    <>
      <PageHeader
        title={t("nav.tasks")}
        subtitle={t("tasks.sub", "Follow-up queue")}
        showBack={false}
        sticky
      />
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto w-full">

        <div className="flex gap-1 mb-4 border-b border-zinc-200 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setParams({ kind: tab.key })}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                active === tab.key
                  ? "border-brand text-brand"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
              data-testid={`tab-${tab.key}`}
            >
              <tab.icon className="w-4 h-4" /> {t(`tasks.${tab.key}`, tab.label)}
            </button>
          ))}
        </div>

        {/* MOBILE: cards */}
        <div className="sm:hidden space-y-2">
          {loading && <div className="py-8 text-center text-zinc-400 text-sm">{t("common.loading")}</div>}
          {!loading && leads.length === 0 && (
            <div className="py-12 text-center text-zinc-400 text-sm">{t("tasks.empty", "No tasks here.")}</div>
          )}
          {leads.map((l) => (
            <Link
              key={l.id}
              to={`/leads/${l.id}`}
              className={`block bg-white border rounded-sm p-3 active:bg-zinc-50 ${priorityStrip(l.priority)} ${
                active === "missed" ? "border-rose-200" : "border-zinc-200"
              }`}
              data-testid={`task-row-${l.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{l.customer_name}</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">{l.phone}</div>
                  <div className={`font-mono text-xs mt-1 ${active === "missed" ? "text-rose-700 font-semibold" : "text-zinc-600"}`}>
                    {l.next_followup_date || "—"} {l.next_followup_time || ""} {l.next_followup_type ? `· ${l.next_followup_type}` : ""}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${stageClass(l.stage)}`}>
                      {l.stage}
                    </span>
                    <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${priorityClass(l.priority)}`}>
                      {l.priority}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 mt-2 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>

        {/* DESKTOP: table */}
        <div className={`hidden sm:block bg-white border rounded-sm overflow-hidden ${active === "missed" ? "border-rose-200" : "border-zinc-200"}`}>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th></th>
                  <th>{t("common.name")}</th>
                  <th>{t("common.phone")}</th>
                  <th>{t("lead.stage")}</th>
                  <th>{t("lead.followups")}</th>
                  <th>Type</th>
                  <th>{t("lead.assigned_to")}</th>
                  <th>{t("lead.priority")}</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={8} className="py-8 text-center text-zinc-400">{t("common.loading")}</td></tr>}
                {!loading && leads.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-zinc-400">{t("tasks.empty", "No tasks here.")}</td></tr>
                )}
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => nav(`/leads/${l.id}`)}
                    className={`cursor-pointer ${priorityStrip(l.priority)}`}
                    data-testid={`task-row-desk-${l.id}`}
                  >
                    <td className="w-1"></td>
                    <td className="font-semibold">{l.customer_name}</td>
                    <td className="font-mono text-sm">{l.phone}</td>
                    <td>
                      <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider ${stageClass(l.stage)}`}>
                        {l.stage}
                      </span>
                    </td>
                    <td className={`font-mono text-sm ${active === "missed" ? "text-rose-700 font-semibold" : "text-zinc-600"}`}>
                      {l.next_followup_date || "—"} {l.next_followup_time || ""}
                    </td>
                    <td className="text-sm">{l.next_followup_type || "—"}</td>
                    <td className="text-zinc-600">{userMap[l.assigned_to]?.name || "—"}</td>
                    <td>
                      <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-bold uppercase tracking-wider border ${priorityClass(l.priority)}`}>
                        {l.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
