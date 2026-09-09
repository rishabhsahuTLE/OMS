import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildStuckData, formatINR, STAGE_DEPT, StuckOrdersPie, type RoleDept } from "../shared";
import { DashboardCard, type CardSize } from "../ui";

// Current-state widget (revenue stuck right now) — no Date filter, but BU/
// Product/Manager all narrow it.
export default function OrdersStuck({
  orders,
  filters,
  dept,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  dept?: RoleDept;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const stuck = buildStuckData(scoped);
  const usesMock = stuck.some((d) => d.mock);
  const own = dept ? stuck.filter((d) => STAGE_DEPT[d.key] === dept) : [];
  const ownTotal = own.reduce((sum, d) => sum + d.revenue, 0);
  const ownCount = own.reduce((sum, d) => sum + d.count, 0);

  return (
    <DashboardCard title={`Where Orders Are Stuck (by revenue)${usesMock ? " · illustrative" : ""}`} size={size}>
      {dept && (
        <p className="mb-2 text-xs text-slate-500">
          Your bottleneck (<span className="font-semibold text-slate-700">{dept === "Tech" ? "Technical" : "Financial"}</span>):{" "}
          <span className="font-semibold text-slate-800">{formatINR(ownTotal)}</span> across {ownCount} order{ownCount === 1 ? "" : "s"}
        </p>
      )}
      <StuckOrdersPie data={stuck} />
    </DashboardCard>
  );
}
