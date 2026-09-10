import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildStageBuckets, formatINR, type NavigateFn, type StageBucketStat } from "../shared";
import { DashboardCard, EmptyState, toneBg, type CardSize } from "../ui";

const SLICE_HEX: Record<string, string> = {
  emerald: "#10b981",
  amber: "#d97706",
  rose: "#e11d48",
  indigo: "#4f46e5",
  violet: "#7c3aed",
  slate: "#94a3b8",
};

// Current-state widget: shows where orders sit *right now*, so the global
// Date filter deliberately does not apply here (see filters.ts's header
// comment on why Date isn't blindly applied everywhere) — only the
// structural filters (BU/Product/Manager) narrow the picture.
export default function StageDistribution({
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
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const buckets = buildStageBuckets(scoped);
  const hasData = buckets.some((b) => b.count > 0);
  // A zero-count bucket still needs its row in the list below, but handing
  // it to the Pie leaves an odd empty notch in the ring (paddingAngle still
  // reserves a gap for a 0-value slice) — so the arc itself only gets the
  // buckets that actually have something in them.
  const sliceData = buckets.filter((b) => b.count > 0);

  function handleClick(bucket: StageBucketStat) {
    onNavigate("orders", "approval", { stage: bucket.stageParam });
  }

  return (
    <DashboardCard title="Stage Distribution" subtitle="Where every order sits right now" size={size}>
      {!hasData ? (
        <EmptyState />
      ) : (
        <div className="flex h-full flex-col justify-center gap-4 sm:flex-row sm:items-center">
          <div className="mx-auto w-full max-w-[280px] shrink-0">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={sliceData}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={110}
                  paddingAngle={sliceData.length > 1 ? 2 : 0}
                  onClick={(d) => handleClick(d.payload as StageBucketStat)}
                  cursor="pointer"
                >
                  {sliceData.map((b) => (
                    <Cell key={b.key} fill={SLICE_HEX[b.tone]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(_v, _n, entry) => {
                    const b = entry.payload as StageBucketStat;
                    return [`${b.count} orders, ${formatINR(b.revenue)} (${b.pct.toFixed(0)}%)`, b.label];
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-1">
            {buckets.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => handleClick(b)}
                className="flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneBg(b.tone)}`} />
                  {b.label}
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="text-base font-semibold text-slate-800">{b.count}</span>
                  <span className="text-xs text-slate-400">{formatINR(b.revenue)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
