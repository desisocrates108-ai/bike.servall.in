import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { priorityStrip, priorityClass } from "../lib/labels";
import PageHeader from "../components/PageHeader";

const STAGES = ["Inquiry", "Follow-up", "Interest", "Test Ride", "Deal", "Booking", "Allotment", "Delivery", "Registration", "Feedback", "Lost"];

export default function Funnel() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    api.get("/leads").then((r) => setLeads(r.data));
  }, []);

  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map((s) => [s, []]));
    leads.forEach((l) => { if (m[l.stage]) m[l.stage].push(l); });
    return m;
  }, [leads]);

  return (
    <>
      <PageHeader
        title={t("nav.funnel")}
        subtitle={`${leads.length} ${t("common.total", "total").toLowerCase()}`}
        showBack={false}
        sticky
      />
      <div className="p-3 sm:p-6 max-w-full">
        <div className="flex overflow-x-auto gap-3 pb-4 items-start" data-testid="funnel-board">
          {STAGES.map((stage) => {
            const items = byStage[stage] || [];
            return (
              <div key={stage} className="kanban-col bg-zinc-50 border border-zinc-200 rounded-sm p-3" data-testid={`col-${stage}`}>
                <Link
                  to={`/leads?stage=${encodeURIComponent(stage)}`}
                  className="flex items-center justify-between mb-3 px-1 hover:opacity-80"
                  data-testid={`funnel-col-link-${stage}`}
                >
                  <div className="overline">{stage}</div>
                  <div className="font-mono text-xs text-zinc-500">{items.length} →</div>
                </Link>
                <div className="space-y-2">
                  {items.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => nav(`/leads/${l.id}`)}
                      className={`bg-white border border-zinc-200 rounded-sm p-3 cursor-pointer hover:border-zinc-400 active:bg-zinc-50 ${priorityStrip(l.priority)}`}
                      data-testid={`funnel-card-${l.id}`}
                    >
                      <div className="font-semibold text-sm truncate">{l.customer_name}</div>
                      <div className="text-xs font-mono text-zinc-500 mt-1">{l.phone}</div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-zinc-500">{l.source}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${priorityClass(l.priority)}`}>{l.priority}</span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-xs text-zinc-400 px-2 py-4 text-center">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
