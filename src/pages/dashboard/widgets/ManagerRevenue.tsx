import { useMemo, useState } from "react";
import type { OrderRecord } from "../../../types";
import SortArrow from "../../../components/SortArrow";
import { toggleSortState, type SortState } from "../../../utils";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildManagerForecast, formatINR, type ForecastQuarter, type ManagerForecastRow, type NavigateFn } from "../shared";
import { DashboardCard, EmptyState, type CardSize } from "../ui";

type SortKey = "manager" | "orders" | "forecast";

const QUARTER_OPTIONS: { key: ForecastQuarter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "q3", label: "Q3" },
  { key: "q4", label: "Q4" },
];

// A small fixed palette, hashed by manager name so each manager keeps the
// same avatar colour across renders/sorts without needing a lookup table.
const AVATAR_COLORS = ["#4f46e5", "#0d9488", "#d97706", "#e11d48", "#7c3aed", "#0891b2", "#059669", "#db2777"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const ROW_COLUMNS = "minmax(0,1.3fr) 60px minmax(0,1.8fr) 130px";

// Forecast is inherently forward-looking (projected revenue), so it runs its
// own quarter toggle (All/Q3/Q4) rather than the dashboard's historical Date
// filter — same self-scoped pattern as Turnaround Time's period toggle.
export default function ManagerRevenue({
  orders,
  filters,
  onNavigate,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
  size?: CardSize;
}) {
  const [quarter, setQuarter] = useState<ForecastQuarter>("all");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "forecast", direction: "desc" });

  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const { rows, total } = useMemo(() => buildManagerForecast(scoped, quarter), [scoped, quarter]);

  const sorted = useMemo(() => {
    const base = [...rows].sort((a, b) => {
      if (sort.key === "manager") return a.manager.localeCompare(b.manager);
      if (sort.key === "orders") return a.orders - b.orders;
      return a.forecast - b.forecast;
    });
    return sort.direction === "asc" ? base : base.reverse();
  }, [rows, sort]);

  const top = sorted.slice(0, 4);

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSortState(prev, key));
  }

  return (
    <DashboardCard
      title="Manager forecast"
      subtitle="Projected revenue from orders under each manager, phased by first billing date"
      size={size}
      action={
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total Forecast</p>
            <p className="text-lg font-bold text-slate-900">{formatINR(total)}</p>
          </div>
          <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
            {QUARTER_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setQuarter(o.key)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  quarter === o.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div
            className="grid items-center gap-x-3 border-b border-slate-100 pb-2"
            style={{ gridTemplateColumns: ROW_COLUMNS }}
          >
            <SortableHeader label="Manager" sortKey="manager" sort={sort} onSort={handleSort} />
            <SortableHeader label="Orders" sortKey="orders" sort={sort} onSort={handleSort} align="right" />
            <SortableHeader label="Forecast" sortKey="forecast" sort={sort} onSort={handleSort} />
            <span className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-slate-400">Share of Total</span>
          </div>

          <div className="divide-y divide-slate-50">
            {top.map((r) => (
              <ManagerRow key={r.manager} row={r} onClick={() => onNavigate("report", "managerReport", { manager: r.manager })} />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400">Forecast = contracted value of open orders, recognised from each order's first billing date</p>
            <button
              type="button"
              onClick={() => onNavigate("report", "managerReport")}
              className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              View all {rows.length} manager{rows.length === 1 ? "" : "s"} →
            </button>
          </div>
        </>
      )}
    </DashboardCard>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState<SortKey>;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`-mx-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
        align === "right" ? "justify-end" : "justify-start"
      } ${active ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
    >
      {label}
      <SortArrow direction={active ? sort.direction : "asc"} active={active} />
    </button>
  );
}

function ManagerRow({ row, onClick }: { row: ManagerForecastRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full items-center gap-x-3 py-3 text-left transition-colors hover:bg-slate-50"
      style={{ gridTemplateColumns: ROW_COLUMNS }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ backgroundColor: avatarColor(row.manager) }}
        >
          {initials(row.manager)}
        </span>
        <span className="truncate text-sm font-medium text-slate-800">{row.manager}</span>
      </span>
      <span className="text-right text-sm text-slate-600">{row.orders}</span>
      <span className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-right text-sm font-semibold text-slate-800">{formatINR(row.forecast)}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full bg-slate-800" style={{ width: `${row.share}%` }} />
        </span>
      </span>
      <span className="text-right text-sm text-slate-400">{row.share.toFixed(0)}%</span>
    </button>
  );
}
