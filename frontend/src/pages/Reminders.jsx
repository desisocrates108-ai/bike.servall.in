import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import PageHeader from "../components/PageHeader";
import { priorityStrip, priorityClass, stageClass } from "../lib/labels";
import { AlertTriangle, Clock, CalendarDays, ChevronRight, BellRing } from "lucide-react";

const isoToday = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const bucketOf = (leadDate) => {
  if (!leadDate) return null;
  const today = isoToday();
  if (leadDate < today) return "overdue";
  if (leadDate === today) return "today";
  if (leadDate === addDays(1)) return "day1";
  if (leadDate === addDays(2)) return "day2";
  if (leadDate === addDays(3)) return "day3";
  return null;
};

export default function Reminders() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/leads", { params: { page_size: 500 } })
      .then((r) => setLeads(r.data || []))
      .finally(() => setLoading(false));
  }, []);

  const buckets = useMemo(() => {
    const b = { overdue: [], today: [], day1: [], day2: [], day3: [] };
    leads.forEach((l) => {
      if (!l.next_followup_date) return;
      if (l.stage === "Lost" || ["Delivery", "Registration", "Feedback"].includes(l.stage)) return;
      const k = bucketOf(l.next_followup_date);
      if (k && b[k]) b[k].push(l);
    });
    Object.keys(b).forEach((k) => b[k].sort((a, b2) =>
      (a.next_followup_date + (a.next_followup_time || "")).localeCompare(b2.next_followup_date + (b2.next_followup_time || ""))
    ));
    return b;
  }, [leads]);

  const total = buckets.overdue.length + buckets.today.length + buckets.day1.length + buckets.day2.length + buckets.day3.length;

  return (
    <>
      <PageHeader
        title={t("nav.reminders", "Reminders")}
        subtitle={`${total} upcoming`}
        showBack={false}
        sticky
      />
      <div className="p-3 sm:p-6 max-w-[1000px] mx-auto w-full">
        {loading && <div className="py-8 text-center text-sm text-zinc-400">{t("common.loading")}</div>}
        {!loading && total === 0 && (
          <div className="py-16 text-center">
            <BellRing className="w-10 h-10 text-zinc-300 mx-auto" />
            <div className="mt-3 text-sm text-zinc-400">No reminders in next 3 days. 🎉</div>
          </div>
        )}

        <BucketSection title="Overdue" tone="danger" icon={AlertTriangle} leads={buckets.overdue} testid="rem-overdue" />
        <BucketSection title="Today" tone="brand" icon={Clock} leads={buckets.today} testid="rem-today" />
        <BucketSection title="Tomorrow (1 day)" tone="warn" icon={CalendarDays} leads={buckets.day1} testid="rem-day1" />
        <BucketSection title="In 2 days" tone="info" icon={CalendarDays} leads={buckets.day2} testid="rem-day2" />
        <BucketSection title="In 3 days" tone="info" icon={CalendarDays} leads={buckets.day3} testid="rem-day3" />
      </div>
    </>
  );
}

function BucketSection({ title, tone, icon: Icon, leads, testid }) {
  if (leads.length === 0) return null;
  const color = {
    danger: "text-rose-700 border-rose-200 bg-rose-50",
    brand: "text-brand border-brand/20 bg-brand/5",
    warn: "text-amber-700 border-amber-200 bg-amber-50",
    info: "text-blue-700 border-blue-200 bg-blue-50",
  }[tone] || "";
  return (
    <section className="mb-4" data-testid={testid}>
      <div className={`flex items-center gap-2 px-3 py-2 rounded-sm border ${color}`}>
        <Icon className="w-4 h-4" />
        <div className="font-bold uppercase text-xs tracking-wider">{title}</div>
        <div className="ml-auto font-mono text-xs font-bold">{leads.length}</div>
      </div>
      <div className="mt-2 space-y-2">
        {leads.map((l) => (
          <Link
            key={l.id}
            to={`/leads/${l.id}`}
            className={`block bg-white border rounded-sm p-3 active:bg-zinc-50 ${priorityStrip(l.priority)}`}
            data-testid={`rem-item-${l.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{l.customer_name}</div>
                <div className="text-xs text-zinc-500 font-mono">{l.phone} · {l.stage}</div>
                <div className="text-xs text-zinc-600 mt-1 font-mono">
                  📅 {l.next_followup_date} {l.next_followup_time || ""} {l.next_followup_type ? `· ${l.next_followup_type}` : ""}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase border ${priorityClass(l.priority)}`}>
                  {l.priority}
                </span>
                <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase ${stageClass(l.stage)}`}>
                  {l.stage}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
