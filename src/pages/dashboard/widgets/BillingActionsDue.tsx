import type { OrderRecord } from "../../../types";
import { getDisplayStage } from "../../../utils";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { formatINR, type NavigateFn } from "../shared";
import { DashboardCard, type CardSize } from "../ui";

// Current-state operational widget — no Date filter (see filters.ts), BU +
// Product apply, Client Manager doesn't (billing workload isn't scoped to a
// manager's own portfolio in the prompt's filter-logic notes).
export default function BillingActionsDue({
  orders,
  filters,
  onNavigate,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters);
  const toOpen = scoped.filter((o) => getDisplayStage(o) === "toOpen");
  const toAmend = scoped.filter((o) => getDisplayStage(o) === "toAmend");
  const toClose = scoped.filter((o) => o.lifecycleStatus === "cancelled" && o.billingStatus === "open");
  const amount = [...toOpen, ...toAmend, ...toClose].reduce((sum, o) => sum + o.amount, 0);

  return (
    <DashboardCard
      title="Billing Actions Due"
      size={size}
      action={
        <button
          type="button"
          onClick={() => onNavigate("orders", "closeBilling")}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          View Close Billing →
        </button>
      }
    >
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xl font-bold text-slate-800">{toOpen.length}</p>
          <p className="text-xs text-slate-500">To Open</p>
        </div>
        <div>
          <p className="text-xl font-bold text-slate-800">{toAmend.length}</p>
          <p className="text-xs text-slate-500">To Amend</p>
        </div>
        <div>
          <p className="text-xl font-bold text-slate-800">{toClose.length}</p>
          <p className="text-xs text-slate-500">To Close</p>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">{formatINR(amount)} contracted value</p>
    </DashboardCard>
  );
}
