import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BUSINESS_UNITS, type OrderRecord } from "../../../types";
import { billsInColumn, buildFiscalYearColumns } from "../../../utils";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { BU_COLORS, formatINR } from "../shared";
import { DashboardCard, EmptyState, type CardSize } from "../ui";

// The chart's own x-axis already IS the time dimension (a fixed April–March
// fiscal year), so the global Date filter isn't applied on top of it — see
// filters.ts. BU/Product still narrow which orders' revenue counts; if the
// BU filter narrows things down to one or two Business Units, that doubles
// as the "allow BU selection to avoid an unreadable chart" requirement
// without a second, redundant per-widget control.
export default function RevenueTrend({
  orders,
  filters,
  size = "lg",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  size?: CardSize;
}) {
  const scoped = applyStructuralFilters(orders, filters).filter((o) => o.lifecycleStatus !== "cancelled");
  const fyColumns = buildFiscalYearColumns(new Date());
  const activeBUs = BUSINESS_UNITS.filter((bu) => scoped.some((o) => o.bu === bu));

  const data = fyColumns.map((col) => {
    const row: Record<string, number | string> = { month: col.label };
    activeBUs.forEach((bu) => {
      row[bu] = scoped.filter((o) => o.bu === bu && billsInColumn(o, col)).reduce((sum, o) => sum + o.amount, 0);
    });
    return row;
  });

  return (
    <DashboardCard title={`Revenue Trend by Business Unit — FY ${fyColumns[0].year}–${fyColumns[11].year}`} size={size}>
      {activeBUs.length === 0 ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e1e0d9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#898781" }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
            />
            <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {activeBUs.map((bu, i) => (
              <Line key={bu} type="monotone" dataKey={bu} name={bu} stroke={BU_COLORS[i % BU_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </DashboardCard>
  );
}
