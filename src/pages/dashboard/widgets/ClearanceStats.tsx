import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, inDateRange, type DashboardFilters } from "../filters";
import { buildClearanceComparison, STAGE_COLOR } from "../shared";
import { DashboardCard, KPI, SegmentedBar, type CardSize } from "../ui";

// "Decided during period" reading of Date — filters by each stage's own
// decision date, not order.createdOn (see shared.tsx's buildClearanceComparison).
export default function ClearanceStats({
  orders,
  filters,
  size = "sm",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const stats = buildClearanceComparison(scoped, (d) => inDateRange(d, filters.dateRange));

  return (
    <DashboardCard title="Clearance Stats" size={size}>
      <div className="flex items-start justify-between gap-4">
        <KPI
          label="Technical Clearance"
          value={`${stats.technicalAvg.toFixed(1)}d`}
          sublabel={`avg over ${stats.technicalN}`}
          color={STAGE_COLOR.technical}
        />
        <KPI
          label="Financial Clearance"
          value={`${stats.financialAvg.toFixed(1)}d`}
          sublabel={`avg over ${stats.financialN}`}
          color={STAGE_COLOR.financial}
          align="right"
        />
      </div>
      <div className="mt-3">
        <SegmentedBar
          segments={[
            {
              key: "technical",
              label: "Technical",
              value: stats.technicalAvg,
              tone: "amber",
              color: STAGE_COLOR.technical,
              display: `${stats.technicalAvg.toFixed(1)}d`,
            },
            {
              key: "financial",
              label: "Financial",
              value: stats.financialAvg,
              tone: "emerald",
              color: STAGE_COLOR.financial,
              display: `${stats.financialAvg.toFixed(1)}d`,
            },
          ]}
        />
      </div>
    </DashboardCard>
  );
}
