import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { priorityStrip, priorityClass } from "../lib/labels";

const STAGES = ["Inquiry", "Follow-up", "Interest", "Test Ride", "Deal", "Booking", "Delivery", "Registration", "Feedback", "Lost"];

export default function Funnel() {
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
    <div className="p-6 md:p-10">
      <div className="overline mb-2">Pipeline</div>
      <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-8">Sales Funnel</h1>

      <div className="flex overflow-x-auto gap-4 pb-4 items-start" data-testid="funnel-board">
        {STAGES.map((stage) => (
          <div key={stage} className="kanban-col bg-zinc-50 border border-zinc-200 rounded-sm p-3" data-testid={`col-${stage}`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="overline">{stage}</div>
              <div className="font-mono text-xs text-zinc-500">{byStage[stage].length}</div>
            </div>
            <div className="space-y-2">
              {byStage[stage].map((l) => (
                <div
                  key={l.id}
                  onClick={() => nav(`/leads/${l.id}`)}
                  className={`bg-white border border-zinc-200 rounded-sm p-3 cursor-pointer hover:border-zinc-400 ${priorityStrip(l.priority)}`}
                  data-testid={`funnel-card-${l.id}`}
                >
                  <div className="font-semibold text-sm">{l.customer_name}</div>
                  <div className="text-xs font-mono text-zinc-500 mt-1">{l.phone}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-zinc-500">{l.source}</span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${priorityClass(l.priority)}`}>{l.priority}</span>
                  </div>
                </div>
              ))}
              {byStage[stage].length === 0 && (
                <div className="text-xs text-zinc-400 px-2 py-4 text-center">Empty</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
