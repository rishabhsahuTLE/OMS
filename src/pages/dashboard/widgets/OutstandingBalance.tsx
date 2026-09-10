import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { formatINR } from "../shared";
import { DashboardCard, KPI, type CardSize } from "../ui";

// Current-state widget (unresolved exposure right now) — no Date filter.
export default function OutstandingBalance({
  orders,
  filters,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters);
  const rows = scoped.filter((o) => o.cancellationDetails && o.billingStatus !== "closed");
  const total = rows.reduce((sum, o) => sum + (o.cancellationDetails?.outstandingBalance ?? 0), 0);
  const avgPerOrder = rows.length > 0 ? total / rows.length : 0;

  return (
    <DashboardCard title="Outstanding Balance (To Close)" size={size}>
      <div className="flex h-full items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Total outstanding</p>
          <p className="text-3xl font-bold text-rose-600">{formatINR(total)}</p>
          <p className="text-xs text-slate-400">
            across {rows.length} order{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <KPI label="Avg. per order" value={formatINR(avgPerOrder)} tone="slate" size="lg" align="right" />
      </div>
    </DashboardCard>
  );
}
