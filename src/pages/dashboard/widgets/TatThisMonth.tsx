import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildTatStats, STAGE_DEPT, type RoleDept } from "../shared";
import { DashboardCard, HorizontalBarRow, tatHealth, type CardSize } from "../ui";

// TAT is inherently "this month" by definition, so the global Date filter is
// not applied a second time on top of it (see filters.ts) — BU/Product/
// Manager still narrow which orders count.
export default function TatThisMonth({
  orders,
  filters,
  dept,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  // Tech emphasizes Technical/Cancellation-Technical, Finance emphasizes
  // Financial/Cancellation-Financial; leave undefined for BD/Admin to show
  // every stage with equal weight.
  dept?: RoleDept;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const stats = buildTatStats(scoped);
  const ordered = dept ? [...stats].sort((a, b) => Number(STAGE_DEPT[b.key] === dept) - Number(STAGE_DEPT[a.key] === dept)) : stats;
  const maxValue = Math.max(1, ...stats.map((s) => s.avgDays));
  const usingFallback = stats.some((s) => s.usingFallback);

  return (
    <DashboardCard title="TAT — This Month" subtitle={usingFallback ? "Some stages use illustrative data" : undefined} size={size}>
      <div className="flex flex-col gap-3">
        {ordered.map((s) => (
          <HorizontalBarRow
            key={s.key}
            label={s.label}
            sublabel={`n=${s.sampleCount}`}
            value={`${s.avgDays.toFixed(1)}d`}
            maxValue={maxValue}
            tone={tatHealth(s.avgDays)}
            muted={dept ? STAGE_DEPT[s.key] !== dept : false}
            title={`${s.label}: ${s.avgDays.toFixed(1)} days average, ${s.sampleCount} order${s.sampleCount === 1 ? "" : "s"}`}
          />
        ))}
      </div>
    </DashboardCard>
  );
}
