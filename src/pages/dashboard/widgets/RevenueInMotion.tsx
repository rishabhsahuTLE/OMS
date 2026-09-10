import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildRevenueMotion, formatINR } from "../shared";
import { DashboardCard, SegmentedBar, type CardSize } from "../ui";

// Current-state snapshot ("how much revenue is stable vs. in transition
// right now") — no Date filter.
export default function RevenueInMotion({
  orders,
  filters,
  size = "lg",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters);
  const motion = buildRevenueMotion(scoped);

  return (
    <DashboardCard title="Revenue in Motion" subtitle="Stable vs. currently in transition" size={size}>
      <div className="flex h-full flex-col justify-center">
        <SegmentedBar
          segments={[
            { key: "active", label: "Active Revenue", value: motion.active, tone: "emerald", display: formatINR(motion.active) },
            {
              key: "amendment",
              label: "Amendment In-flight",
              value: motion.amendmentInFlight,
              tone: "indigo",
              display: formatINR(motion.amendmentInFlight),
            },
            {
              key: "cancellation",
              label: "Cancellation In-flight",
              value: motion.cancellationInFlight,
              tone: "rose",
              display: formatINR(motion.cancellationInFlight),
            },
          ]}
        />
      </div>
    </DashboardCard>
  );
}
