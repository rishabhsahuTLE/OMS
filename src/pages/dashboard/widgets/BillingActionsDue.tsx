import type { OrderRecord } from "../../../types";
import { getDisplayStage } from "../../../utils";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { formatINR, type NavigateFn } from "../shared";
import { Button, DashboardCard, KPI, SegmentedBar, type CardSize } from "../ui";

// Current-state operational widget — no Date filter (see filters.ts), BU +
// Product apply, Client Manager doesn't (billing workload isn't scoped to a
// manager's own portfolio in the prompt's filter-logic notes).
//
// The three buckets are given distinct meaning rather than three identical
// numbers: To Open is routine/expected (neutral), To Amend needs a decision
// (amber), To Close is money sitting unclosed (rose) — the one furthest
// along and most worth acting on first.
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
  const total = toOpen.length + toAmend.length + toClose.length;

  return (
    <DashboardCard title="Billing Actions Due" subtitle="Orders waiting on a billing action" size={size} accent="indigo">
      <div className="grid grid-cols-3 gap-3">
        <KPI label="To Open" value={String(toOpen.length)} tone="slate" size="lg" />
        <KPI label="To Amend" value={String(toAmend.length)} tone="amber" size="lg" />
        <KPI label="To Close" value={String(toClose.length)} tone="rose" size="lg" />
      </div>

      {total > 0 && (
        <div className="mt-4">
          <SegmentedBar
            legend={false}
            segments={[
              { key: "open", label: "To Open", value: toOpen.length, tone: "slate", display: String(toOpen.length) },
              { key: "amend", label: "To Amend", value: toAmend.length, tone: "amber", display: String(toAmend.length) },
              { key: "close", label: "To Close", value: toClose.length, tone: "rose", display: String(toClose.length) },
            ]}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="min-w-0 text-xs text-slate-400">{formatINR(amount)} contracted value pending action</p>
        <span className="shrink-0">
          <Button onClick={() => onNavigate("orders", "closeBilling")}>Close Billing</Button>
        </span>
      </div>
    </DashboardCard>
  );
}
