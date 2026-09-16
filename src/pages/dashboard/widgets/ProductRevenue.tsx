import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { OrderRecord } from "../../../types";
import { PRODUCT_NAMES } from "../../../products";
import { applyStructuralFilters, inDateRange, type DashboardFilters } from "../filters";
import { formatINR, PRODUCT_COLORS } from "../shared";
import { DashboardCard, EmptyState, type CardSize } from "../ui";

// "Created during period" reading of Date: of the non-cancelled orders
// created in the selected window, revenue split by product.
export default function ProductRevenue({
  orders,
  filters,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters)
    .filter((o) => o.lifecycleStatus !== "cancelled")
    .filter((o) => inDateRange(o.createdOn, filters.dateRange));
  const totalRevenue = scoped.reduce((sum, o) => sum + o.amount, 0);
  const metrics = PRODUCT_NAMES.map((product) => {
    const rows = scoped.filter((o) => o.product === product);
    const revenue = rows.reduce((sum, o) => sum + o.amount, 0);
    return { product, label: product, revenue, count: rows.length, pct: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0 };
  }).filter((m) => m.revenue > 0);

  return (
    <DashboardCard title="Product-wise Revenue" size={size} bodyClassName="flex flex-col items-center justify-center">
      {metrics.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mx-auto w-full max-w-[260px]">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={metrics} dataKey="revenue" nameKey="label" cx="50%" cy="50%" innerRadius={54} outerRadius={92} paddingAngle={2}>
                {metrics.map((m) => (
                  <Cell key={m.product} fill={PRODUCT_COLORS[m.product] ?? "#64748b"} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, _n, entry) => {
                  const m = entry.payload as (typeof metrics)[number];
                  return [`${formatINR(Number(v))} (${m.count} orders, ${m.pct.toFixed(0)}%)`, m.label];
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardCard>
  );
}
