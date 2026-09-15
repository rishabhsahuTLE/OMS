import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { OrderRecord } from "../../../types";
import { getDisplayStage } from "../../../utils";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { type NavigateFn } from "../shared";
import { Button, DashboardCard, EmptyState, toneHex, type CardSize, type Tone } from "../ui";

// Current-state operational widget — no Date filter (see filters.ts), BU +
// Product apply, Client Manager doesn't (billing workload isn't scoped to a
// manager's own portfolio in the prompt's filter-logic notes).
//
// The three buckets are given distinct meaning rather than three identical
// numbers: To Open is routine/expected (neutral), To Amend needs a decision
// (amber), To Close is money sitting unclosed (rose) — the one furthest
// along and most worth acting on first. Rendered as a donut (no legend rows,
// no amount line) to match the other two cards in this row — see
// widgetCatalog.tsx's "chart" tier — with the Close Billing action as the
// one thing besides the chart itself.
const BUCKETS: { key: "toOpen" | "toAmend" | "toClose"; label: string; tone: Tone }[] = [
  { key: "toOpen", label: "To Open", tone: "slate" },
  { key: "toAmend", label: "To Amend", tone: "amber" },
  { key: "toClose", label: "To Close", tone: "rose" },
];

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
  const counts = {
    toOpen: scoped.filter((o) => getDisplayStage(o) === "toOpen").length,
    toAmend: scoped.filter((o) => getDisplayStage(o) === "toAmend").length,
    toClose: scoped.filter((o) => o.lifecycleStatus === "cancelled" && o.billingStatus === "open").length,
  };
  const data = BUCKETS.map((b) => ({ ...b, count: counts[b.key] })).filter((b) => b.count > 0);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <DashboardCard
      title="Billing Actions Due"
      subtitle="Orders waiting on a billing action"
      size={size}
      accent="indigo"
      bodyClassName="flex flex-col"
    >
      <div className="flex flex-1 items-center justify-center">
        {total === 0 ? (
          <EmptyState message="No billing actions due." />
        ) : (
          <div className="mx-auto w-full max-w-[260px]">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={54} outerRadius={92} paddingAngle={2}>
                  {data.map((d) => (
                    <Cell key={d.key} fill={toneHex(d.tone)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _n, entry) => {
                    const d = entry.payload as (typeof data)[number];
                    return [`${v} order${Number(v) === 1 ? "" : "s"}`, d.label];
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-auto flex justify-center border-t border-slate-100 pt-3">
        <Button onClick={() => onNavigate("orders", "closeBilling")}>Close Billing</Button>
      </div>
    </DashboardCard>
  );
}
