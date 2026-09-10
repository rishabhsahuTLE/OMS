import type { OrderRecord } from "../../../types";
import { billsInColumn, buildFiscalYearColumns, isBillingOpenInColumn } from "../../../utils";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { formatINR } from "../shared";
import { DashboardCard, type CardSize } from "../ui";

// Fiscal-year (April–March) projection — the chart's own scope already IS
// the year, so the global Date filter isn't applied on top (see filters.ts).
export default function OpenedVsProjected({
  orders,
  filters,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters).filter((o) => o.lifecycleStatus !== "cancelled");
  const fyColumns = buildFiscalYearColumns(new Date());
  let projected = 0;
  let opened = 0;
  fyColumns.forEach((col) => {
    scoped.forEach((o) => {
      if (!billsInColumn(o, col)) return;
      projected += o.amount;
      if (isBillingOpenInColumn(o, col)) opened += o.amount;
    });
  });
  const pct = projected > 0 ? Math.min(100, (opened / projected) * 100) : 0;

  return (
    <DashboardCard title="Revenue — Opened vs Projected" subtitle={`FY ${fyColumns[0].year}–${fyColumns[11].year}`} size={size}>
      <div className="flex h-full flex-col justify-center">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Opened</p>
            <p className="text-2xl font-bold text-emerald-600">{formatINR(opened)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-500">Projected (full FY)</p>
            <p className="text-2xl font-bold text-slate-700">{formatINR(projected)}</p>
          </div>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-right text-sm text-slate-400">{pct.toFixed(1)}% opened</p>
      </div>
    </DashboardCard>
  );
}
