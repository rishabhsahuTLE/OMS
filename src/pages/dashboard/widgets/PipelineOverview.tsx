import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, inDateRange, type DashboardFilters } from "../filters";
import { buildPipelineStats, formatINR } from "../shared";
import { DashboardCard, KPI, SegmentedBar, type CardSize } from "../ui";

// "Created during period" reading of Date — of the orders created in the
// selected window, how much value is Active vs still Pending right now.
export default function PipelineOverview({
  orders,
  filters,
  size = "lg",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true }).filter((o) => inDateRange(o.createdOn, filters.dateRange));
  const pipeline = buildPipelineStats(scoped);

  return (
    <DashboardCard title="Pipeline Overview" subtitle="Contracted value, active vs. still pending" size={size}>
      <div className="flex h-full flex-col justify-center">
        <KPI label="Total Contracted Value" value={formatINR(pipeline.total)} tone="indigo" size="lg" />
        <div className="mt-4">
          <SegmentedBar
            segments={[
              { key: "active", label: "Active", value: pipeline.active, tone: "emerald", display: formatINR(pipeline.active) },
              { key: "pending", label: "Pending", value: pipeline.pending, tone: "amber", display: formatINR(pipeline.pending) },
            ]}
          />
        </div>
      </div>
    </DashboardCard>
  );
}
