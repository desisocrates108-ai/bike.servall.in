import React from "react";

/**
 * Lightweight inline SVG-free charts using Tailwind divs.
 * No extra deps.
 */

export function FunnelChart({ data, onClickStage, testid }) {
  // data: [{ stage, count }]
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-2" data-testid={testid}>
      {data.map((d, i) => {
        const pct = Math.round((d.count / max) * 100);
        const prev = i > 0 ? data[i - 1].count : null;
        const drop = prev != null && prev > 0 ? Math.round(((prev - d.count) / prev) * 100) : null;
        const button = (
          <div
            className={`w-full group ${onClickStage ? "cursor-pointer hover:opacity-90 active:opacity-80" : ""}`}
            onClick={onClickStage ? () => onClickStage(d.stage) : undefined}
            data-testid={`funnel-stage-${d.stage}`}
            role={onClickStage ? "button" : undefined}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">{d.stage}</span>
              <span className="font-mono text-sm">
                <span className="text-zinc-900 font-bold">{d.count}</span>
                {drop != null && drop > 0 && (
                  <span className="ml-2 text-xs text-rose-600">↓ {drop}%</span>
                )}
              </span>
            </div>
            <div className="h-6 bg-zinc-100 rounded-sm overflow-hidden">
              <div
                className="h-full bg-brand transition-all group-hover:bg-brand-dark"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
        return <React.Fragment key={d.stage}>{button}</React.Fragment>;
      })}
    </div>
  );
}

export function BarChart({ data, onClick, testid, valueFormatter = (v) => v }) {
  // data: [{ label, value, id? }]
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2" data-testid={testid}>
      {data.map((d) => {
        const pct = Math.round((d.value / max) * 100);
        return (
          <div
            key={d.id || d.label}
            className={`${onClick ? "cursor-pointer hover:opacity-90 active:opacity-80" : ""}`}
            onClick={onClick ? () => onClick(d) : undefined}
            role={onClick ? "button" : undefined}
            data-testid={`bar-${d.id || d.label}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">{d.label}</span>
              <span className="font-mono text-sm font-bold">{valueFormatter(d.value)}</span>
            </div>
            <div className="h-4 bg-zinc-100 rounded-sm overflow-hidden">
              <div className="h-full bg-zinc-900" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DonutBreakdown({ data, testid, colors = ["#ED1C24", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#64748b"] }) {
  // data: [{ label, value }]
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1;
  return (
    <div data-testid={testid}>
      <div className="flex w-full h-3 rounded-sm overflow-hidden mb-3">
        {data.map((d, i) => (
          <div
            key={d.label}
            style={{
              width: `${(d.value / total) * 100}%`,
              backgroundColor: colors[i % colors.length],
            }}
            title={`${d.label}: ${d.value}`}
          />
        ))}
      </div>
      <div className="space-y-1">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="font-mono font-bold">
              {d.value} <span className="text-zinc-400 text-xs">({Math.round((d.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
