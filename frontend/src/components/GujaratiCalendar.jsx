import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import { FESTIVALS, upcomingFestivals, pastFestivals, daysUntil } from "../lib/festivals";
import { Calendar as CalIcon, CalendarDays, CheckCircle2, Flame, Package, Star } from "lucide-react";
import CalendarDialog from "./CalendarDialog";

/**
 * Gujarati Calendar Widget (for CEO / Branch Admin).
 * Shows:
 *   - Upcoming festivals + deliveries/bookings
 *   - Past week: completed deliveries + follow-ups
 *   - Crawling marquee ticker
 *   - Click the calendar icon to open interactive month grid popup
 */
export default function GujaratiCalendar({ branchId = "" }) {
  const { t } = useTranslation();
  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    api.get("/leads", { params: { page_size: 500 } }).then((r) => setLeads(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    // Past 14 days followups across top leads
    (async () => {
      try {
        const top = leads.slice(0, 20);
        const batches = await Promise.all(
          top.map((l) => api.get(`/leads/${l.id}/followups`).then((r) => (r.data || []).slice(0, 3)).catch(() => []))
        );
        setFollowups(batches.flat());
      } catch { /* noop */ }
    })();
  }, [leads.length]);

  const up = useMemo(() => upcomingFestivals(new Date(), 30), []);
  const past = useMemo(() => pastFestivals(new Date(), 14), []);

  // Upcoming deliveries — leads at stage Booking/Allotment with future next_followup_date
  const upcomingDeliveries = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return leads.filter((l) =>
      (l.stage === "Booking" || l.stage === "Allotment") &&
      l.next_followup_date && l.next_followup_date >= today
    ).slice(0, 10);
  }, [leads]);

  // Past deliveries — stage Delivery created in last 14 days
  const pastDeliveries = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const iso = cutoff.toISOString();
    return leads.filter((l) =>
      ["Delivery", "Registration", "Feedback"].includes(l.stage) &&
      (l.updated_at || l.created_at) >= iso
    );
  }, [leads]);

  const overdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return leads.filter((l) => l.next_followup_date && l.next_followup_date < today && l.stage !== "Lost" && !["Delivery", "Registration", "Feedback"].includes(l.stage));
  }, [leads]);

  // Crawling ticker messages
  const ticker = useMemo(() => {
    const msgs = [];
    up.filter((f) => f.important).slice(0, 3).forEach((f) => {
      const d = daysUntil(f.date);
      if (d === 0) msgs.push(`🎉 ${f.name} is today!`);
      else if (d === 1) msgs.push(`🎉 ${f.name} in 1 day`);
      else if (d > 1) msgs.push(`🎉 ${f.name} in ${d} days`);
    });
    if (overdue.length > 0) msgs.push(`⚠️ ${overdue.length} overdue follow-ups`);
    if (upcomingDeliveries.length > 0) msgs.push(`🚚 ${upcomingDeliveries.length} deliveries scheduled`);
    if (pastDeliveries.length > 0) msgs.push(`✅ ${pastDeliveries.length} deliveries done in last 14 days`);
    if (msgs.length === 0) msgs.push("📅 Calendar empty — all quiet for now");
    return msgs;
  }, [up, overdue.length, upcomingDeliveries.length, pastDeliveries.length]);

  return (
    <div className="bg-white border border-zinc-200 rounded-sm" data-testid="gujarati-calendar">
      {/* Crawling ticker */}
      <div className="overflow-hidden border-b border-zinc-200 bg-brand/5">
        <div
          className="whitespace-nowrap py-2 px-4 text-sm font-medium text-zinc-900 animate-marquee"
          data-testid="calendar-ticker"
        >
          {ticker.map((m, i) => (
            <span key={i} className="mr-12">{m}</span>
          ))}
          {ticker.map((m, i) => (
            <span key={`b-${i}`} className="mr-12">{m}</span>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-2 py-1 -ml-2 rounded-sm hover:bg-brand/5 active:bg-brand/10 transition-colors group"
            data-testid="calendar-open-btn"
            aria-label="Open calendar"
          >
            <CalIcon className="w-4 h-4 text-brand" />
            <div className="overline group-hover:text-brand">Gujarati Calendar</div>
            <span className="text-[10px] text-zinc-400 group-hover:text-brand font-semibold ml-1">· Tap to view month</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Upcoming */}
          <div data-testid="calendar-upcoming">
            <div className="font-display font-bold mb-2 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-zinc-400" /> Upcoming
            </div>
            <ul className="space-y-1.5">
              {up.length === 0 && <li className="text-xs text-zinc-400">No upcoming festivals in next 30 days.</li>}
              {up.slice(0, 8).map((f, i) => {
                const d = daysUntil(f.date);
                return (
                  <li key={i} className="flex items-center justify-between text-sm py-1 border-b border-zinc-100 last:border-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {f.important ? <Star className="w-3 h-3 text-brand fill-brand flex-shrink-0" /> : <span className="w-3 h-3 flex-shrink-0" />}
                      <span className="truncate">{f.name}</span>
                    </span>
                    <span className={`font-mono text-xs font-bold flex-shrink-0 ${d === 0 ? "text-brand" : d <= 2 ? "text-amber-700" : "text-zinc-500"}`}>
                      {d === 0 ? "Today" : d === 1 ? "1 day" : `${d} days`}
                    </span>
                  </li>
                );
              })}
            </ul>

            {upcomingDeliveries.length > 0 && (
              <div className="mt-4" data-testid="calendar-upcoming-deliveries">
                <div className="overline mb-2 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Upcoming Deliveries
                </div>
                <ul className="space-y-1">
                  {upcomingDeliveries.slice(0, 5).map((l) => (
                    <li key={l.id} className="flex items-center justify-between text-xs py-0.5">
                      <span className="truncate">{l.customer_name} · {l.stage}</span>
                      <span className="font-mono text-zinc-500">{l.next_followup_date}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Past */}
          <div data-testid="calendar-past">
            <div className="font-display font-bold mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Past 14 Days
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-2 text-center">
                <div className="font-mono text-lg font-bold text-emerald-700">{pastDeliveries.length}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700">Deliveries</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-sm p-2 text-center">
                <div className="font-mono text-lg font-bold text-blue-700">{followups.length}</div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-blue-700">Follow-ups</div>
              </div>
            </div>
            {past.length > 0 && (
              <>
                <div className="overline mb-1">Recent Festivals</div>
                <ul className="space-y-0.5">
                  {past.slice(0, 5).map((f, i) => (
                    <li key={i} className="text-xs text-zinc-600 truncate">{f.name} <span className="text-zinc-400">· {f.date}</span></li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <CalendarDialog open={dialogOpen} onOpenChange={setDialogOpen} branchId={branchId} />
    </div>
  );
}
