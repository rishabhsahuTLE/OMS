import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildStuckData, StuckOrdersPie } from "../shared";
import { DashboardCard, type CardSize } from "../ui";

// Current-state widget (revenue stuck right now) — no Date filter, but BU/
// Product/Manager all narrow it.
export default function OrdersStuck({
  orders,
  filters,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const stuck = buildStuckData(scoped);
  const usesMock = stuck.some((d) => d.mock);

  const subtitle = usesMock
    ? "Pending orders distribution, by revenue — some stages use illustrative data"
    : "Pending orders distribution, by revenue";

  return (
    <DashboardCard title="Where Orders Are Stuck (by revenue)" subtitle={subtitle} size={size}>
      <StuckOrdersPie data={stuck} />
    </DashboardCard>
  );
}
