import type { OrderRecord } from "../../../types";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildStageBuckets, formatINR, type NavigateFn } from "../shared";
import { DashboardCard, EmptyState, toneClass, type CardSize, type Tone } from "../ui";

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
  const totalCount = scoped.length;
  const totalRevenue = scoped.reduce((sum, o) => sum + o.amount, 0);

  function handleClick(stageParam: string) {
    onNavigate("orders", "approval", { stage: stageParam });
  }

  return (
    <DashboardCard title="Stage Distribution" subtitle="Where every order sits right now" size={size}>
      {totalCount === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="All Orders" count={totalCount} amount={totalRevenue} highlighted onClick={() => handleClick("all")} />
          {buckets.map((b) => (
            <StatTile key={b.key} label={b.label} count={b.count} amount={b.revenue} tone={b.tone} onClick={() => handleClick(b.stageParam)} />
          ))}
        </div>
      )}
    </DashboardCard>
  );
}

function StatTile({
  label,
  count,
  amount,
  tone,
  highlighted,
  onClick,
}: {
  label: string;
  count: number;
  amount: number;
  tone?: Tone;
  highlighted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-col items-start rounded-lg border p-4 text-left transition-colors ${
        highlighted ? "border-indigo-200 bg-indigo-50/60 hover:bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span className="truncate text-xs font-medium text-slate-500">{label}</span>
      <span className={`mt-1 text-2xl font-bold ${highlighted ? "text-slate-900" : toneClass(tone ?? "slate")}`}>{count}</span>
      <span className="mt-0.5 truncate text-xs text-slate-400">{formatINR(amount)}</span>
    </button>
  );
}
