import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildTatStats } from "../shared";
import { DashboardCard, HorizontalBarRow, tatHealth, type CardSize } from "../ui";

// TAT is inherently "this month" by definition, so the global Date filter is
// not applied a second time on top of it (see filters.ts) — BU/Product/
// Manager still narrow which orders count.
export default function TatThisMonth({
  orders,
  filters,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const stats = buildTatStats(scoped);
  const maxValue = Math.max(1, ...stats.map((s) => s.avgDays));
  const usingFallback = stats.some((s) => s.usingFallback);

  return (
    <DashboardCard title="TAT — This Month" subtitle={usingFallback ? "Some stages use illustrative data" : undefined} size={size}>
      <div className="flex h-full flex-col justify-center gap-6">
        {stats.map((s) => (
          <HorizontalBarRow
            key={s.key}
            label={s.label}
            sublabel={`n=${s.sampleCount}`}
            value={`${s.avgDays.toFixed(1)}d`}
            maxValue={maxValue}
            tone={tatHealth(s.avgDays)}
            title={`${s.label}: ${s.avgDays.toFixed(1)} days average, ${s.sampleCount} order${s.sampleCount === 1 ? "" : "s"}`}
          />
        ))}
      </div>
    </DashboardCard>
  );
}
