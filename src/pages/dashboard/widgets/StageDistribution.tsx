import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildStageBuckets, formatINR, type NavigateFn, type StageBucketStat } from "../shared";
import { DashboardCard, EmptyState, LegendList, toneHex, type CardSize, type LegendItem } from "../ui";

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

  const items: LegendItem[] = buckets.map((b) => ({
    key: b.key,
    label: b.label,
    color: toneHex(b.tone),
    value: String(b.count),
    pct: b.pct,
    onClick: () => handleClick(b),
  }));

  return (
    <DashboardCard title="Stage Distribution" subtitle="Where every order sits right now" size={size}>
      {!hasData ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4 @lg:flex-row @lg:items-center">
          <div className="mx-auto w-full max-w-[240px] shrink-0">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={sliceData}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={sliceData.length > 1 ? 2 : 0}
                  onClick={(d) => handleClick(d.payload as StageBucketStat)}
                  cursor="pointer"
                >
                  {sliceData.map((b) => (
                    <Cell key={b.key} fill={toneHex(b.tone)} />
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
          <LegendList items={items} />
        </div>
      )}
    </DashboardCard>
  );
}
