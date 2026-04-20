import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { priorityClass, priorityStrip, stageClass } from "../lib/labels";
import { Clock, AlertTriangle, CalendarClock, AlertCircle } from "lucide-react";

const TABS = [
  { key: "today", label: "Today", icon: Clock },
  { key: "missed", label: "Missed", icon: AlertTriangle },
  { key: "upcoming", label: "Upcoming", icon: CalendarClock },
  { key: "at_risk", label: "At Risk", icon: AlertCircle },
];

export default function Tasks() {
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
    <div className="p-6 md:p-10 max-w-[1400px]">
      <div className="overline mb-2">Tasks</div>
      <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-8">
        Follow-up queue
      </h1>

      <div className="flex gap-2 mb-6 border-b border-zinc-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ kind: t.key })}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              active === t.key
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
            data-testid={`tab-${t.key}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className={`bg-white border rounded-sm overflow-hidden ${active === "missed" ? "border-rose-200" : "border-zinc-200"}`}>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th></th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Stage</th>
                <th>Follow-up</th>
                <th>Type</th>
                <th>Sales Exec</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="py-8 text-center text-zinc-400">Loading...</td></tr>}
              {!loading && leads.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-zinc-400">No tasks here.</td></tr>
              )}
              {leads.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => nav(`/leads/${l.id}`)}
                  className={`cursor-pointer ${priorityStrip(l.priority)}`}
                  data-testid={`task-row-${l.id}`}
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
  );
}
