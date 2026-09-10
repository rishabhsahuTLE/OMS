import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { formatINR } from "../shared";
import { DashboardCard, KPI, type CardSize } from "../ui";

// Current-state widget (unresolved exposure right now) — no Date filter.
export default function OutstandingBalance({
  orders,
  filters,
  compact = false,
  size = "sm",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  compact?: boolean;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters);
  const rows = scoped.filter((o) => o.cancellationDetails && o.billingStatus !== "closed");
  const total = rows.reduce((sum, o) => sum + (o.cancellationDetails?.outstandingBalance ?? 0), 0);
  const avgPerOrder = rows.length > 0 ? total / rows.length : 0;

  return (
    <DashboardCard title="Outstanding Balance (To Close)" size={size}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">Total outstanding</p>
          <p className={compact ? "text-lg font-bold text-rose-600" : "text-2xl font-bold text-rose-600"}>{formatINR(total)}</p>
          <p className="text-xs text-slate-400">
            across {rows.length} order{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <KPI label="Avg. per order" value={formatINR(avgPerOrder)} tone="slate" size={compact ? "sm" : "md"} align="right" />
      </div>
    </DashboardCard>
  );
}
