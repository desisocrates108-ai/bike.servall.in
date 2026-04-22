import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  ChevronLeft, ChevronRight, X, ArrowLeft,
  CheckCircle2, PhoneCall, Package, AlertTriangle, Star,
  CalendarDays as CalIcon,
} from "lucide-react";
import { FESTIVALS } from "../lib/festivals";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Full-featured interactive Gujarati calendar popup.
 * - Opens as overlay (not page nav)
 * - Month grid with prev/next nav
 * - Color dots per date: green=delivery done, blue=followup, yellow=upcoming, red=overdue, purple=festival
 * - Click date -> detail view with back button
 */
export default function CalendarDialog({ open, onOpenChange, branchId = "" }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ days: {} });
  const [selectedDate, setSelectedDate] = useState(null);
  const today = todayISO();

  // Festivals map for current month
  const festivalsByDate = useMemo(() => {
    const map = {};
    FESTIVALS.forEach((f) => {
      if (!map[f.date]) map[f.date] = [];
      map[f.date].push(f);
    });
    return map;
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = { year: cursor.y, month: cursor.m };
    if (branchId) params.branch_id = branchId;
    api.get("/analytics/calendar", { params })
      .then((r) => setData(r.data || { days: {} }))
      .catch(() => setData({ days: {} }))
      .finally(() => setLoading(false));
  }, [open, cursor.y, cursor.m, branchId]);

  // Reset selection when cursor/open changes
  useEffect(() => { if (!open) setSelectedDate(null); }, [open]);

  const gridDays = useMemo(() => {
    const first = new Date(cursor.y, cursor.m - 1, 1);
    const startWeekday = first.getDay(); // 0-6
    const daysInMonth = new Date(cursor.y, cursor.m, 0).getDate();
    const cells = [];
    // Leading blanks
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${cursor.y}-${pad(cursor.m)}-${pad(d)}`);
    }
    // Trailing blanks to complete last row
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor.y, cursor.m]);

  const prevMonth = () => {
    setCursor((c) => (c.m === 1 ? { y: c.y - 1, m: 12 } : { y: c.y, m: c.m - 1 }));
    setSelectedDate(null);
  };
  const nextMonth = () => {
    setCursor((c) => (c.m === 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 }));
    setSelectedDate(null);
  };
  const goToday = () => {
    const d = new Date();
    setCursor({ y: d.getFullYear(), m: d.getMonth() + 1 });
    setSelectedDate(todayISO());
  };

  const dotsFor = (iso) => {
    const day = data.days[iso] || {};
    const fests = festivalsByDate[iso] || [];
    const dots = [];
    if ((day.deliveries || []).length) dots.push("green");
    if ((day.followups || []).length) dots.push("blue");
    if ((day.upcoming || []).length) dots.push("yellow");
    if ((day.overdue || []).length) dots.push("red");
    if (fests.length) dots.push("purple");
    return dots;
  };

  const hasEvents = (iso) => dotsFor(iso).length > 0;
  const selectedEvents = selectedDate ? (data.days[selectedDate] || {}) : null;
  const selectedFestivals = selectedDate ? (festivalsByDate[selectedDate] || []) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[520px] w-[95vw] sm:w-full p-0 gap-0 rounded-sm overflow-hidden max-h-[92vh] flex flex-col"
        data-testid="calendar-dialog"
      >
        <DialogTitle className="sr-only">
          {selectedDate ? `Day Detail — ${selectedDate}` : `Gujarati Calendar — ${MONTHS[cursor.m - 1]} ${cursor.y}`}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Interactive monthly calendar showing deliveries, follow-ups, upcoming bookings, overdue items and Gujarati festivals. Tap a date to see full details.
        </DialogDescription>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-200 bg-white flex-shrink-0">
          {selectedDate ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDate(null)}
              className="h-8 w-8 rounded-sm"
              data-testid="cal-back-btn"
              aria-label="Back to month"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          ) : (
            <CalIcon className="w-4 h-4 text-brand ml-1" />
          )}
          <div className="min-w-0 flex-1">
            <div className="overline text-[10px] leading-none">
              {selectedDate ? "Day Detail" : "Gujarati Calendar"}
            </div>
            <div className="font-display font-bold text-sm leading-tight truncate">
              {selectedDate
                ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
                : `${MONTHS[cursor.m - 1]} ${cursor.y}`}
            </div>
          </div>
          {!selectedDate && (
            <>
              <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-sm" data-testid="cal-prev" aria-label="Previous month">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} className="h-8 rounded-sm text-xs font-bold px-2" data-testid="cal-today">
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-sm" data-testid="cal-next" aria-label="Next month">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 rounded-sm" data-testid="cal-close" aria-label="Close">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {!selectedDate && (
            <div data-testid="cal-month-view">
              {/* Legend */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-[10px] font-semibold text-zinc-600 border-b border-zinc-100 bg-zinc-50">
                <LegendDot color="green" label="Delivered" />
                <LegendDot color="blue" label="Follow-up" />
                <LegendDot color="yellow" label="Upcoming" />
                <LegendDot color="red" label="Overdue" />
                <LegendDot color="purple" label="Festival" />
              </div>

              {/* Weekday row */}
              <div className="grid grid-cols-7 border-b border-zinc-200">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="text-center text-[10px] uppercase font-bold text-zinc-500 py-1.5">{w}</div>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7" data-testid="cal-grid">
                {gridDays.map((iso, i) => {
                  if (!iso) {
                    return <div key={`b-${i}`} className="h-14 sm:h-16 border-b border-r border-zinc-100 bg-zinc-50/40" />;
                  }
                  const dots = dotsFor(iso);
                  const isToday = iso === today;
                  const hasFest = (festivalsByDate[iso] || []).some((f) => f.important);
                  return (
                    <button
                      key={iso}
                      onClick={() => setSelectedDate(iso)}
                      disabled={!hasEvents(iso) && !isToday}
                      className={`relative h-14 sm:h-16 border-b border-r border-zinc-100 text-left p-1 transition-colors
                        ${hasEvents(iso) ? "hover:bg-brand/5 cursor-pointer" : "text-zinc-400 cursor-default"}
                        ${isToday ? "bg-brand/5 ring-1 ring-inset ring-brand" : "bg-white"}`}
                      data-testid={`cal-day-${iso}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`text-xs font-bold ${isToday ? "text-brand" : ""}`}>
                          {parseInt(iso.slice(-2), 10)}
                        </span>
                        {hasFest && <Star className="w-2.5 h-2.5 text-purple-600 fill-purple-600 flex-shrink-0" />}
                      </div>
                      {dots.length > 0 && (
                        <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 flex-wrap">
                          {dots.slice(0, 5).map((c, di) => (
                            <span
                              key={di}
                              className={`w-1.5 h-1.5 rounded-full ${colorClass(c)}`}
                              data-testid={`cal-dot-${c}`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {loading && (
                <div className="text-center text-xs text-zinc-400 py-2" data-testid="cal-loading">Loading events…</div>
              )}
            </div>
          )}

          {selectedDate && (
            <DayDetail
              date={selectedDate}
              events={selectedEvents}
              festivals={selectedFestivals}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function colorClass(c) {
  return {
    green: "bg-emerald-500",
    blue: "bg-blue-500",
    yellow: "bg-amber-400",
    red: "bg-rose-500",
    purple: "bg-purple-500",
  }[c] || "bg-zinc-400";
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${colorClass(color)}`} />
      <span>{label}</span>
    </span>
  );
}

function DayDetail({ date, events, festivals, onClose }) {
  const deliveries = (events && events.deliveries) || [];
  const followups = (events && events.followups) || [];
  const upcoming = (events && events.upcoming) || [];
  const overdue = (events && events.overdue) || [];
  const totalCount = deliveries.length + followups.length + upcoming.length + overdue.length + festivals.length;

  return (
    <div className="p-3 sm:p-4 space-y-3" data-testid="cal-day-detail">
      {totalCount === 0 && (
        <div className="py-16 text-center text-sm text-zinc-400" data-testid="cal-day-empty">
          <CalIcon className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
          No events on this date.
        </div>
      )}

      {festivals.length > 0 && (
        <Section title="Festivals" icon={Star} tone="purple" count={festivals.length} testid="sec-festivals">
          {festivals.map((f, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 text-sm" data-testid={`fest-${i}`}>
              {f.important && <Star className="w-3.5 h-3.5 text-purple-600 fill-purple-600 flex-shrink-0" />}
              <span className={f.important ? "font-bold" : ""}>{f.name}</span>
            </div>
          ))}
        </Section>
      )}

      {deliveries.length > 0 && (
        <Section title="Deliveries Done" icon={CheckCircle2} tone="green" count={deliveries.length} testid="sec-deliveries">
          {deliveries.map((d) => (
            <LeadRow
              key={`d-${d.lead_id}-${d.chassis || ""}`}
              leadId={d.lead_id}
              name={d.customer_name}
              sub={d.chassis ? `Chassis: ${d.chassis}` : d.phone}
              onClose={onClose}
              testid={`del-${d.lead_id}`}
            />
          ))}
        </Section>
      )}

      {overdue.length > 0 && (
        <Section title="Overdue Follow-ups" icon={AlertTriangle} tone="red" count={overdue.length} testid="sec-overdue">
          {overdue.map((o) => (
            <LeadRow
              key={`o-${o.lead_id}`}
              leadId={o.lead_id}
              name={o.customer_name}
              sub={`${o.stage || "—"} · ${o.priority || ""} ${o.followup_type ? "· " + o.followup_type : ""}`}
              onClose={onClose}
              testid={`over-${o.lead_id}`}
            />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Upcoming / Scheduled" icon={Package} tone="yellow" count={upcoming.length} testid="sec-upcoming">
          {upcoming.map((u) => (
            <LeadRow
              key={`u-${u.lead_id}-${u.booking_id || ""}`}
              leadId={u.lead_id}
              name={u.customer_name}
              sub={u.booking_id ? `Booking · ${u.status || "—"}` : `${u.stage || "—"} ${u.followup_time ? "· " + u.followup_time : ""}`}
              onClose={onClose}
              testid={`up-${u.lead_id}`}
            />
          ))}
        </Section>
      )}

      {followups.length > 0 && (
        <Section title="Follow-up Records" icon={PhoneCall} tone="blue" count={followups.length} testid="sec-followups">
          {followups.map((f, i) => (
            <LeadRow
              key={`f-${f.lead_id}-${i}`}
              leadId={f.lead_id}
              name={f.customer_name}
              sub={`${f.type || "—"}${f.outcome ? " · " + f.outcome : ""}${f.done ? " · Done" : " · Pending"}`}
              onClose={onClose}
              testid={`fu-${f.lead_id}-${i}`}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, tone, count, children, testid }) {
  const toneCls = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    yellow: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-rose-200 bg-rose-50 text-rose-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700",
  }[tone] || "border-zinc-200 bg-zinc-50 text-zinc-700";
  return (
    <div className="border border-zinc-200 rounded-sm" data-testid={testid}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${toneCls}`}>
        <Icon className="w-4 h-4" />
        <div className="font-bold text-xs uppercase tracking-wider flex-1">{title}</div>
        <span className="font-mono text-xs font-bold">{count}</span>
      </div>
      <div className="px-3 py-1 divide-y divide-zinc-100">{children}</div>
    </div>
  );
}

function LeadRow({ leadId, name, sub, onClose, testid }) {
  return (
    <Link
      to={`/leads/${leadId}`}
      onClick={onClose}
      className="flex items-center justify-between py-2 text-sm hover:bg-zinc-50 -mx-3 px-3 transition-colors"
      data-testid={testid}
    >
      <div className="min-w-0">
        <div className="font-semibold truncate">{name || "—"}</div>
        {sub && <div className="text-xs text-zinc-500 truncate">{sub}</div>}
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
    </Link>
  );
}
