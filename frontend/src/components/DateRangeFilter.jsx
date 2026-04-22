import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const PRESETS = [
  { k: "today", label: "Today" },
  { k: "week", label: "This Week" },
  { k: "month", label: "This Month" },
  { k: "year", label: "This Year" },
  { k: "all", label: "All Time" },
];

const fmt = (d) => d.toISOString().slice(0, 10);

function rangeOf(preset) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  if (preset === "today") return { from: fmt(start), to: fmt(end) };
  if (preset === "week") {
    const d = start.getDay();
    start.setDate(start.getDate() - d);
    return { from: fmt(start), to: fmt(end) };
  }
  if (preset === "month") {
    start.setDate(1);
    return { from: fmt(start), to: fmt(end) };
  }
  if (preset === "year") {
    start.setMonth(0, 1);
    return { from: fmt(start), to: fmt(end) };
  }
  return { from: "", to: "" };
}

/**
 * Compact date-range filter:
 * value = {from: "YYYY-MM-DD" | "", to: "YYYY-MM-DD" | ""}
 * onChange(next)
 */
export default function DateRangeFilter({ value, onChange, testid = "date-range" }) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState(() => {
    if (!value?.from && !value?.to) return "all";
    for (const p of PRESETS) {
      if (p.k === "all") continue;
      const r = rangeOf(p.k);
      if (r.from === value.from && r.to === value.to) return p.k;
    }
    return "custom";
  });

  const apply = (k) => {
    setPreset(k);
    if (k === "custom") {
      setOpen(true);
      return;
    }
    setOpen(false);
    onChange(rangeOf(k));
  };

  const label =
    preset === "custom" && (value?.from || value?.to)
      ? `${value?.from || "…"} → ${value?.to || "…"}`
      : (PRESETS.find((p) => p.k === preset)?.label || "Range");

  return (
    <div className="relative" data-testid={testid}>
      <Button
        variant="outline"
        className="rounded-sm h-10 font-semibold whitespace-nowrap"
        onClick={() => setOpen((o) => !o)}
        data-testid={`${testid}-trigger`}
      >
        <span className="text-xs mr-1.5 text-zinc-500">📅</span>
        <span className="text-xs">{label}</span>
      </Button>
      {open && (
        <div
          className="absolute right-0 top-12 z-40 bg-white border border-zinc-200 rounded-sm shadow-lg p-3 min-w-[240px]"
          data-testid={`${testid}-panel`}
        >
          <div className="flex flex-wrap gap-1 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p.k}
                onClick={() => apply(p.k)}
                className={`px-2 py-1 text-xs rounded-sm font-semibold ${
                  preset === p.k ? "bg-brand text-white" : "bg-zinc-100 hover:bg-zinc-200"
                }`}
                data-testid={`${testid}-preset-${p.k}`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => apply("custom")}
              className={`px-2 py-1 text-xs rounded-sm font-semibold ${
                preset === "custom" ? "bg-brand text-white" : "bg-zinc-100 hover:bg-zinc-200"
              }`}
              data-testid={`${testid}-preset-custom`}
            >
              Custom
            </button>
          </div>
          {preset === "custom" && (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">From</label>
                <Input
                  type="date"
                  value={value?.from || ""}
                  onChange={(e) => onChange({ from: e.target.value, to: value?.to || "" })}
                  className="rounded-sm h-9"
                  data-testid={`${testid}-from`}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">To</label>
                <Input
                  type="date"
                  value={value?.to || ""}
                  onChange={(e) => onChange({ from: value?.from || "", to: e.target.value })}
                  className="rounded-sm h-9"
                  data-testid={`${testid}-to`}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
