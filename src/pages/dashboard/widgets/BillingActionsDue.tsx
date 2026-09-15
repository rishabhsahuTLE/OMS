import type { OrderRecord } from "../../../types";
import { getDisplayStage } from "../../../utils";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { formatINR, type NavigateFn } from "../shared";
import { Button, DashboardCard, toneClass, type CardSize, type Tone } from "../ui";

// Current-state operational widget — no Date filter (see filters.ts), BU +
// Product apply, Client Manager doesn't (billing workload isn't scoped to a
// manager's own portfolio in the prompt's filter-logic notes).
//
// The three buckets are given distinct meaning rather than three identical
// numbers: To Open is routine/expected (neutral), To Amend needs a decision
// (amber), To Close is money sitting unclosed (rose) — the one furthest
// along and most worth acting on first. Stacked rows rather than a 3-column
// KPI grid — this card now shares a row with the two donut widgets (see
// widgetCatalog.tsx's "chart" tier), so it needs to read well in one narrow
// column instead of the full-width row it used to have to itself.
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
      subtitle="Orders waiting on a billing action"
      size={size}
      accent="indigo"
      bodyClassName="flex flex-col"
    >
      <div className="flex flex-col gap-2">
        <ActionRow label="To Open" count={toOpen.length} tone="slate" />
        <ActionRow label="To Amend" count={toAmend.length} tone="amber" />
        <ActionRow label="To Close" count={toClose.length} tone="rose" />
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="min-w-0 text-xs text-slate-400">{formatINR(amount)} contracted value pending action</p>
        <span className="shrink-0">
          <Button onClick={() => onNavigate("orders", "closeBilling")}>Close Billing</Button>
        </span>
      </div>
    </DashboardCard>
  );
}

function ActionRow({ label, count, tone }: { label: string; count: number; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className={`text-lg font-bold ${toneClass(tone)}`}>{count}</span>
    </div>
  );
}
