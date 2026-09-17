import { useState } from "react";
import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildTatStats, buildTurnaroundSummary, type TatPeriod } from "../shared";
import { DashboardCard, toneHex, type CardSize } from "../ui";

const PERIOD_OPTIONS: { key: TatPeriod; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "Quarter" },
  { key: "all", label: "All time" },
];

// A single alert colour for any bar past the average-clearance threshold —
// deliberately one colour, not one per stage, so "past the line" reads as
// one consistent signal rather than a second categorical palette.
const BASE_COLOR = toneHex("indigo");
const ALERT_COLOR = toneHex("rose");

export default function TurnaroundTime({
  orders,
  filters,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const [period, setPeriod] = useState<TatPeriod>("month");
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const summary = buildTurnaroundSummary(scoped, period);
  const stats = buildTatStats(scoped, period);
  const usingFallback = summary.usingFallback || stats.some((s) => s.usingFallback);

  // Same scale for the by-stage bars and the avg-clearance threshold line,
  // so the dashed marker's position is directly comparable to every bar.
  const maxValue = Math.max(1, summary.avgClearance, ...stats.map((s) => s.avgDays));
  const avgPct = Math.min(100, (summary.avgClearance / maxValue) * 100);

  return (
    <DashboardCard
      title="Turnaround time"
      subtitle={usingFallback ? "Some figures use illustrative data" : undefined}
      size={size}
      action={
        <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setPeriod(o.key)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                period === o.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50">
        <SummaryStat label="Avg Clearance" value={summary.avgClearance} unit="d" />
        <SummaryStat label="Median" value={summary.median} unit="d" />
        <SummaryStat label="Orders Cleared" value={summary.ordersCleared} />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">By Stage</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="inline-block h-0 w-4 border-t border-dashed border-slate-400" />
          Avg {summary.avgClearance.toFixed(1)}d
        </p>
      </div>

      {/* Every cell below is placed with an explicit gridRow (not left to
          auto-flow) because the dashed threshold line spans rows 1..N in
          column 2 via its own explicit placement — CSS Grid resolves all
          explicitly-positioned items first, so leaving the bar cells to
          auto-place would make them dodge around that reserved column,
          shifting every row over by one column. */}
      <div className="mt-3 grid gap-y-3" style={{ gridTemplateColumns: "128px 1fr 52px" }}>
        {stats.map((s, i) => {
          const alert = s.avgDays > summary.avgClearance;
          const pct = Math.min(100, (s.avgDays / maxValue) * 100);
          const row = i + 1;
          return (
            <div key={s.key} className="contents">
              <span className="flex items-center text-sm leading-tight text-slate-600" style={{ gridColumn: 1, gridRow: row }}>
                {s.label}
              </span>
              <span className="flex items-center" style={{ gridColumn: 2, gridRow: row }}>
                <span className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: alert ? ALERT_COLOR : BASE_COLOR }}
                  />
                </span>
              </span>
              <span
                className={`flex items-center justify-end text-sm ${alert ? "font-bold text-rose-600" : "text-slate-500"}`}
                style={{ gridColumn: 3, gridRow: row }}
              >
                {s.avgDays.toFixed(1)}d
              </span>
            </div>
          );
        })}
        {/* Dashed avg-clearance line, spanning every bar row's track column
            so it reads as one continuous threshold rather than 4 separate
            markers. */}
        <div className="relative" style={{ gridColumn: 2, gridRow: `1 / ${stats.length + 1}` }}>
          <span className="pointer-events-none absolute inset-y-0 border-l border-dashed border-slate-400" style={{ left: `${avgPct}%` }} />
        </div>
      </div>
    </DashboardCard>
  );
}

function SummaryStat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {unit ? value.toFixed(1) : Math.round(value)}
        {unit && <span className="ml-0.5 text-sm font-normal text-slate-400">{unit}</span>}
      </p>
    </div>
  );
}
