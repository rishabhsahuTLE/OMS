import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, inDateRange, type DashboardFilters } from "../filters";
import { buildStuckData, StuckOrdersPie } from "../shared";
import { DashboardCard, type CardSize } from "../ui";

// "Created during period" reading of Date: of the orders created in the
// selected window, which are stuck (still pending) right now.
export default function OrdersStuck({
  orders,
  filters,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true }).filter((o) =>
    inDateRange(o.createdOn, filters.dateRange)
  );
  const stuck = buildStuckData(scoped);
  const usesMock = stuck.some((d) => d.mock);

  const subtitle = usesMock
    ? "Pending orders distribution, by revenue — some stages use illustrative data"
    : "Pending orders distribution, by revenue";

  return (
    <DashboardCard
      title="Where Orders Are Stuck (by revenue)"
      subtitle={subtitle}
      size={size}
      bodyClassName="flex flex-col items-center justify-center"
    >
      <StuckOrdersPie data={stuck} />
    </DashboardCard>
  );
}
