import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { formatINR } from "../shared";
import { DashboardCard, type CardSize } from "../ui";

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

  return (
    <DashboardCard title="Outstanding Balance (To Close)" size={size}>
      <div className="flex h-full items-center justify-between">
        <p className={compact ? "text-lg font-bold text-rose-600" : "text-2xl font-bold text-rose-600"}>{formatINR(total)}</p>
        <p className="text-xs text-slate-400">
          across {rows.length} order{rows.length === 1 ? "" : "s"}
        </p>
      </div>
    </DashboardCard>
  );
}
