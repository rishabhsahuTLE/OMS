import { ResponsiveContainer, Pie, PieChart, Cell, Tooltip } from "recharts";
import type { MainTabId, OrderRecord, OrdersSubTabId, ReportSubTabId } from "../../types";
import {
  billsInColumn,
  buildFiscalYearColumns,
  daysBetween,
  getDisplayStage,
  getNextActionableStage,
  todayISO,
  type ApprovalStageKey,
} from "../../utils";
import type { Tone } from "./ui";

// Domain calculations shared by the widget components in ./widgets — this
// file knows about orders/stages/roles; ./ui.tsx deliberately doesn't. Every
// function here is a pure transform from `OrderRecord[]` to plain data; the
// widgets decide how to render it.

export type NavigateFn = (
  tab: MainTabId,
  subTab?: ReportSubTabId | OrdersSubTabId,
  params?: Record<string, string>
) => void;

export function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

// Which department owns a given approval stage — Approval Queue, Clearance
// Stats, Rejected — Needs Fix and Age at Stage all use this to scope/order
// their rows per role.
export type RoleDept = "Tech" | "Finance";

export const STAGE_DEPT: Record<ApprovalStageKey, RoleDept> = {
  technical: "Tech",
  financial: "Finance",
  cancellationTechnical: "Tech",
  cancellationFinancial: "Finance",
};

export const STAGE_LABEL: Record<ApprovalStageKey, string> = {
  technical: "Technical",
  financial: "Financial",
  cancellationTechnical: "Cancellation-Technical",
  cancellationFinancial: "Cancellation-Financial",
};

// One color per stage, reused everywhere that stage's name appears (Where
// Orders Are Stuck, Clearance Stats, TAT — This Month) so "Technical" is
// always the same color no matter which widget it's shown in. Muted,
// moderate-saturation hues — never red/rose, which this dashboard reserves
// for status severity (rejected/cancelled/overdue), not category identity.
export const STAGE_COLOR: Record<ApprovalStageKey, string> = {
  technical: "#3d5a80",
  financial: "#2f8f7a",
  cancellationTechnical: "#7d5ba6",
  cancellationFinancial: "#c98a3a",
};

// The date an order actually entered its current actionable stage — used
// consistently everywhere "age at stage" or turnaround time is computed.
export const STAGE_ANCHOR: Record<ApprovalStageKey, (o: OrderRecord) => string> = {
  technical: (o) => o.createdOn,
  financial: (o) => o.technical.date ?? o.createdOn,
  cancellationTechnical: (o) => o.cancellationDetails?.effectFromDate ?? o.createdOn,
  cancellationFinancial: (o) => o.cancellationTechnical.date ?? o.createdOn,
};

// A small categorical palette reused everywhere a chart needs one, so no two
// widgets invent their own — Product-wise Revenue and Revenue Trend by BU in
// particular.
export const PRODUCT_COLORS: Record<string, string> = {
  LMS: "#3e77bc",
  Quirio: "#bc6c52",
};

export const BU_COLORS = ["#4f46e5", "#0d9488", "#d97706", "#e11d48", "#64748b"];

// ---------------------------------------------------------------------------
// Stage Distribution — a 5-bucket taxonomy that maps 1:1 onto
// utils.ts's getDisplayStage, collapsed the same way Manage Orders'
// own "Pending" view tab already merges approvalPending/closurePending
// (OrderApproval.tsx's ViewTab/matchesTab) — toOpen/toAmend are folded in
// alongside approvalPending since they're all pre-Active waits, and
// closurePending gets its own "Cancellation Pending" bucket here (rather
// than being folded into "Pending" too) so an in-flight cancellation reads
// as its own distinct state on the dashboard's stat row.
// ---------------------------------------------------------------------------

export type StageBucketKey = "pending" | "active" | "agreementOver" | "cancellationPending" | "closed";

export const STAGE_BUCKETS: { key: StageBucketKey; label: string; tone: Tone; stageParam: string }[] = [
  { key: "pending", label: "Pending", tone: "amber", stageParam: "approvalPending" },
  { key: "active", label: "Active", tone: "emerald", stageParam: "active" },
  { key: "agreementOver", label: "Agreement Over", tone: "indigo", stageParam: "agreementOver" },
  { key: "cancellationPending", label: "Cancellation Pending", tone: "rose", stageParam: "closurePending" },
  { key: "closed", label: "Closed", tone: "slate", stageParam: "closed" },
];

export function stageBucketOf(order: OrderRecord): StageBucketKey {
  const stage = getDisplayStage(order);
  if (stage === "active") return "active";
  if (stage === "agreementOver") return "agreementOver";
  if (stage === "closurePending") return "cancellationPending";
  if (stage === "closed") return "closed";
  return "pending"; // approvalPending, toOpen, toAmend
}

export interface StageBucketStat {
  key: StageBucketKey;
  label: string;
  tone: Tone;
  stageParam: string;
  count: number;
  revenue: number;
  pct: number;
}

export function buildStageBuckets(orders: OrderRecord[]): StageBucketStat[] {
  const counts = new Map<StageBucketKey, { count: number; revenue: number }>();
  STAGE_BUCKETS.forEach((b) => counts.set(b.key, { count: 0, revenue: 0 }));
  orders.forEach((o) => {
    const c = counts.get(stageBucketOf(o))!;
    c.count += 1;
    c.revenue += o.amount;
  });
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
  return STAGE_BUCKETS.map((b) => {
    const c = counts.get(b.key)!;
    return { ...b, ...c, pct: totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0 };
  });
}

// ---------------------------------------------------------------------------
// Where Orders Are Stuck (by revenue)
// ---------------------------------------------------------------------------

export const STUCK_STAGES: { key: ApprovalStageKey; label: string; color: string }[] = [
  { key: "technical", label: "Technical", color: STAGE_COLOR.technical },
  { key: "financial", label: "Financial", color: STAGE_COLOR.financial },
  { key: "cancellationTechnical", label: "Cancellation-Technical", color: STAGE_COLOR.cancellationTechnical },
  { key: "cancellationFinancial", label: "Cancellation-Financial", color: STAGE_COLOR.cancellationFinancial },
];

// Mock data is generated from a fixed reference date (see mockOrders.ts), so
// a stage — Cancellation-Technical especially — can have zero pending orders
// on any given day. Rather than silently dropping that slice, it falls back
// to an illustrative one so the chart shape stays meaningful.
const MOCK_STUCK_FALLBACK: Record<ApprovalStageKey, { revenue: number; count: number }> = {
  technical: { revenue: 850000, count: 4 },
  financial: { revenue: 620000, count: 3 },
  cancellationTechnical: { revenue: 245000, count: 2 },
  cancellationFinancial: { revenue: 310000, count: 2 },
};

export interface StuckSlice {
  key: ApprovalStageKey;
  label: string;
  color: string;
  revenue: number;
  count: number;
  pct: number;
  mock: boolean;
}

export function buildStuckData(orders: OrderRecord[]): StuckSlice[] {
  const raw = STUCK_STAGES.map((s) => {
    const rows = orders.filter((o) => {
      if (o.lifecycleStatus === "cancelled") return false;
      const actionable = getNextActionableStage(o);
      return actionable?.key === s.key && o[s.key].status === "pending";
    });
    if (rows.length > 0) {
      return { key: s.key, label: s.label, color: s.color, revenue: rows.reduce((sum, o) => sum + o.amount, 0), count: rows.length, mock: false };
    }
    const fallback = MOCK_STUCK_FALLBACK[s.key];
    return { key: s.key, label: s.label, color: s.color, revenue: fallback.revenue, count: fallback.count, mock: true };
  });
  const total = raw.reduce((sum, d) => sum + d.revenue, 0);
  return raw.map((d) => ({ ...d, pct: total > 0 ? (d.revenue / total) * 100 : 0 }));
}

export function StuckOrdersPie({ data }: { data: StuckSlice[] }) {
  // A LegendList, not recharts' own <Legend>, is what keeps this in the same
  // Technical -> Financial -> Cancellation-Technical -> Cancellation-Financial
  // Donut only, no legend rows below it — the category names/values surface
  // via the hover Tooltip instead, so this card reads as a single chart
  // rather than a chart-plus-table.
  return (
    <div className="mx-auto w-full max-w-[260px]">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="revenue" nameKey="label" cx="50%" cy="50%" innerRadius={54} outerRadius={92} paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, _name, entry) => {
              const payload = entry.payload as { label: string; count: number; pct: number };
              return [`${formatINR(Number(v))} (${payload.count} orders, ${payload.pct.toFixed(0)}%)`, payload.label];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approval Queue
// ---------------------------------------------------------------------------

export interface QueueItem {
  order: OrderRecord;
  stageLabel: string;
  ageDays: number;
  amount: number;
}

export function buildApprovalQueue(orders: OrderRecord[], dept: RoleDept): QueueItem[] {
  const today = todayISO();
  const items: QueueItem[] = [];
  orders.forEach((order) => {
    if (order.lifecycleStatus === "cancelled") return;
    const actionable = getNextActionableStage(order);
    if (!actionable || STAGE_DEPT[actionable.key] !== dept) return;
    if (order[actionable.key].status !== "pending") return;
    items.push({
      order,
      stageLabel: `${actionable.label} approval pending`,
      ageDays: daysBetween(STAGE_ANCHOR[actionable.key](order), today),
      amount: order.amount,
    });
  });
  return items;
}

// ---------------------------------------------------------------------------
// Clearance Stats — Technical vs Financial average time-to-decision,
// literally the two departments compared side by side (not "you vs
// everyone else" — this widget shows the same organization-wide comparison
// on both the Tech and Finance dashboards).
// ---------------------------------------------------------------------------

export interface ClearanceComparison {
  technicalAvg: number;
  technicalN: number;
  financialAvg: number;
  financialN: number;
}

// `withinDecidedDate` narrows to pairs whose *decision* (end) date falls in
// the selected period — the "decided during period" reading of the Date
// filter this widget uses, as opposed to filtering by order.createdOn.
export function buildClearanceComparison(
  orders: OrderRecord[],
  withinDecidedDate: (dateISO: string) => boolean = () => true
): ClearanceComparison {
  const techPairs: { start: string; end: string }[] = [];
  const finPairs: { start: string; end: string }[] = [];
  orders.forEach((order) => {
    if (order.technical.date) techPairs.push({ start: order.createdOn, end: order.technical.date });
    if (order.cancellationDetails && order.cancellationTechnical.date) {
      techPairs.push({ start: order.cancellationDetails.effectFromDate, end: order.cancellationTechnical.date });
    }
    if (order.technical.date && order.financial.date) {
      finPairs.push({ start: order.technical.date, end: order.financial.date });
    }
    if (order.cancellationTechnical.date && order.cancellationFinancial.date) {
      finPairs.push({ start: order.cancellationTechnical.date, end: order.cancellationFinancial.date });
    }
  });
  const avg = (rows: { start: string; end: string }[]) =>
    rows.length === 0 ? 0 : rows.reduce((sum, p) => sum + daysBetween(p.start, p.end), 0) / rows.length;
  const techFiltered = techPairs.filter((p) => withinDecidedDate(p.end));
  const finFiltered = finPairs.filter((p) => withinDecidedDate(p.end));
  return { technicalAvg: avg(techFiltered), technicalN: techFiltered.length, financialAvg: avg(finFiltered), financialN: finFiltered.length };
}

// ---------------------------------------------------------------------------
// TAT — This Month
// ---------------------------------------------------------------------------

interface TatPair {
  end: string;
  days: number;
  orderId: string;
}

const TAT_PAIR_BUILDERS: Record<ApprovalStageKey, (orders: OrderRecord[]) => TatPair[]> = {
  technical: (orders) =>
    orders
      .filter((o) => o.technical.date)
      .map((o) => ({ end: o.technical.date as string, days: daysBetween(o.createdOn, o.technical.date as string), orderId: o.id })),
  financial: (orders) =>
    orders
      .filter((o) => o.technical.date && o.financial.date)
      .map((o) => ({
        end: o.financial.date as string,
        days: daysBetween(o.technical.date as string, o.financial.date as string),
        orderId: o.id,
      })),
  cancellationTechnical: (orders) =>
    orders
      .filter((o) => o.cancellationDetails && o.cancellationTechnical.date)
      .map((o) => ({
        end: o.cancellationTechnical.date as string,
        days: daysBetween(o.cancellationDetails!.effectFromDate, o.cancellationTechnical.date as string),
        orderId: o.id,
      })),
  cancellationFinancial: (orders) =>
    orders
      .filter((o) => o.cancellationTechnical.date && o.cancellationFinancial.date)
      .map((o) => ({
        end: o.cancellationFinancial.date as string,
        days: daysBetween(o.cancellationTechnical.date as string, o.cancellationFinancial.date as string),
        orderId: o.id,
      })),
};

// Mock data is generated from a fixed reference date (see mockOrders.ts), so
// a stage can easily have zero decisions landing in the real current
// calendar month/quarter — this falls back to that stage's all-time average,
// and (if there's no history at all) to an illustrative figure, flagged via
// `usingFallback`.
const TAT_MOCK_FALLBACK: Record<ApprovalStageKey, number> = {
  technical: 3.2,
  financial: 2.5,
  cancellationTechnical: 4.1,
  cancellationFinancial: 3.6,
};

// The Turnaround Time widget's own in-card period toggle (This month /
// Quarter / All time) — independent of the dashboard's global Date filter,
// same as e.g. Billing.tsx's fiscal columns always running off the real
// current date rather than a filterable range.
export type TatPeriod = "month" | "quarter" | "all";

// Standard Indian fiscal year quarters (Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar),
// collapsed into one comparable integer so two ISO dates can be checked for
// "same fiscal quarter" with a single equality check.
function fiscalQuarterIndex(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  const month0 = m - 1;
  const fyStartYear = month0 >= 3 ? y : y - 1;
  const q = Math.floor(((month0 + 9) % 12) / 3);
  return fyStartYear * 4 + q;
}

function periodMatches(iso: string, period: TatPeriod, referenceIso: string): boolean {
  if (period === "all") return true;
  if (period === "month") return iso.slice(0, 7) === referenceIso.slice(0, 7);
  return fiscalQuarterIndex(iso) === fiscalQuarterIndex(referenceIso);
}

function avgDays(rows: TatPair[]): number | null {
  return rows.length === 0 ? null : rows.reduce((sum, p) => sum + p.days, 0) / rows.length;
}

export interface TatStat {
  key: ApprovalStageKey;
  label: string;
  avgDays: number;
  sampleCount: number;
  usingFallback: boolean;
}

export function buildTatStats(orders: OrderRecord[], period: TatPeriod = "month"): TatStat[] {
  const today = todayISO();
  const byStage = (Object.keys(TAT_PAIR_BUILDERS) as ApprovalStageKey[]).map((key) => ({
    key,
    pairs: TAT_PAIR_BUILDERS[key](orders),
  }));
  // Gated at the whole cross-stage pool, same as buildTurnaroundSummary's own
  // fallback gate — so the average line and every bar are always built from
  // the same population. Falling back per stage independently (the old
  // behaviour) let one stage silently substitute an unrelated all-time
  // figure while the average stayed period-only, breaking the invariant
  // below that the average always falls between the fastest/slowest bar.
  const allPairs = byStage.flatMap((s) => s.pairs);
  const periodPairsAll = period === "all" ? allPairs : allPairs.filter((p) => periodMatches(p.end, period, today));
  const poolEmpty = periodPairsAll.length === 0;

  return byStage.map(({ key, pairs }) => {
    const periodPairs = period === "all" ? pairs : pairs.filter((p) => periodMatches(p.end, period, today));
    // Pool has period data somewhere: use this stage's period pairs even if
    // that's empty for this one stage (an honest "no decisions this period"
    // reads as 0, not a mismatched all-time number). Pool is entirely empty:
    // fall back to this stage's own all-time pairs, then the illustrative
    // constant if there's no history at all.
    const usablePairs = poolEmpty ? pairs : periodPairs;
    const avg = avgDays(usablePairs);
    return {
      key,
      label: STAGE_LABEL[key],
      avgDays: avg ?? (poolEmpty ? TAT_MOCK_FALLBACK[key] : 0),
      sampleCount: usablePairs.length,
      usingFallback: poolEmpty || avg == null,
    };
  });
}

// ---------------------------------------------------------------------------
// Turnaround Time — the 3 headline stats (avg/median/orders cleared) pool
// the exact same decisions buildTatStats' 4 by-stage rows are built from
// (every Technical/Financial/Cancellation-Technical/Cancellation-Financial
// decision in the period, one raw day-count per decision) — a plain mean and
// median over that one flat list, not an average of the 4 stage averages
// and *not* a separate "full order lifecycle" span. That's what guarantees
// AVG CLEARANCE always falls between the fastest and slowest stage shown
// below it, so the dashed threshold line is directly comparable to every
// bar instead of some unrelated, larger number.
// ---------------------------------------------------------------------------

export interface TurnaroundSummary {
  avgClearance: number;
  median: number;
  ordersCleared: number;
  usingFallback: boolean;
}

export function buildTurnaroundSummary(orders: OrderRecord[], period: TatPeriod): TurnaroundSummary {
  const today = todayISO();
  const allPairs: TatPair[] = (Object.keys(TAT_PAIR_BUILDERS) as ApprovalStageKey[]).flatMap((key) => TAT_PAIR_BUILDERS[key](orders));
  const periodPairs = period === "all" ? allPairs : allPairs.filter((p) => periodMatches(p.end, period, today));
  const pool = periodPairs.length > 0 ? periodPairs : allPairs;

  const days = pool.map((p) => p.days).sort((a, b) => a - b);
  const avgClearance = days.length > 0 ? days.reduce((sum, d) => sum + d, 0) / days.length : 0;
  const mid = Math.floor(days.length / 2);
  const median = days.length === 0 ? 0 : days.length % 2 === 1 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
  const ordersCleared = new Set(pool.map((p) => p.orderId)).size;

  return { avgClearance, median, ordersCleared, usingFallback: periodPairs.length === 0 && allPairs.length > 0 };
}

// ---------------------------------------------------------------------------
// Rejected — Needs Fix
// ---------------------------------------------------------------------------

export interface RejectedRow {
  order: OrderRecord;
  stageKey: ApprovalStageKey;
  stageLabel: string;
  reason: string;
  rejectedDate: string;
  daysSince: number;
}

export function buildRejectedRows(orders: OrderRecord[]): RejectedRow[] {
  const today = todayISO();
  const rows: RejectedRow[] = [];
  orders.forEach((order) => {
    const actionable = getNextActionableStage(order);
    if (!actionable) return;
    const stage = order[actionable.key];
    if (stage.status !== "rejected") return;
    rows.push({
      order,
      stageKey: actionable.key,
      stageLabel: STAGE_LABEL[actionable.key],
      reason: stage.remark && stage.remark.trim() ? stage.remark : "—",
      rejectedDate: stage.date as string,
      daysSince: daysBetween(stage.date as string, today),
    });
  });
  return rows.sort((a, b) => b.daysSince - a.daysSince);
}

// ---------------------------------------------------------------------------
// Age at Stage — Order-wise
// ---------------------------------------------------------------------------

export interface StageAgeInfo {
  order: OrderRecord;
  stageLabel: string;
  ageDays: number;
  stageKey: ApprovalStageKey | null;
  stageEnteredOn: string;
}

// Where a given order sits right now, in plain terms, plus how long it's
// been waiting there — null once it's past waiting on anyone (Active,
// Agreement Over, Cancelled).
export function currentStageInfo(order: OrderRecord): StageAgeInfo | null {
  if (order.lifecycleStatus === "cancelled") return null;
  const today = todayISO();
  const actionable = getNextActionableStage(order);
  if (actionable) {
    const rejected = order[actionable.key].status === "rejected";
    const enteredOn = STAGE_ANCHOR[actionable.key](order);
    return {
      order,
      stageLabel: rejected ? `${actionable.label} rejected` : `${actionable.label} approval pending`,
      ageDays: daysBetween(enteredOn, today),
      stageKey: actionable.key,
      stageEnteredOn: enteredOn,
    };
  }
  const stage = getDisplayStage(order);
  if (stage === "toOpen" || stage === "toAmend") {
    const enteredOn = order.financial.date ?? order.createdOn;
    return {
      order,
      stageLabel: stage === "toAmend" ? "Awaiting Finance to complete amendment" : "Awaiting Finance to open billing",
      ageDays: daysBetween(enteredOn, today),
      stageKey: null,
      stageEnteredOn: enteredOn,
    };
  }
  return null;
}

export function buildAgeRows(orders: OrderRecord[]): StageAgeInfo[] {
  const rows: StageAgeInfo[] = [];
  orders.forEach((o) => {
    const info = currentStageInfo(o);
    if (info) rows.push(info);
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Revenue in Motion
// ---------------------------------------------------------------------------

export interface RevenueMotionStats {
  active: number;
  amendmentInFlight: number;
  cancellationInFlight: number;
}

export function buildRevenueMotion(orders: OrderRecord[]): RevenueMotionStats {
  let active = 0;
  let amendmentInFlight = 0;
  let cancellationInFlight = 0;
  orders.forEach((o) => {
    if (o.lifecycleStatus === "cancellationInProgress") {
      cancellationInFlight += o.amount;
    } else if (o.supersedes && o.lifecycleStatus === "inactive") {
      amendmentInFlight += o.amount;
    } else if (o.lifecycleStatus === "active") {
      active += o.amount;
    }
  });
  return { active, amendmentInFlight, cancellationInFlight };
}

// ---------------------------------------------------------------------------
// Manager Forecast — projected (contracted) revenue from open orders, one
// row per manager. "All" is every open order's full amount; Q3/Q4 narrow to
// orders that actually bill an occurrence in that fiscal quarter (this
// fiscal year's Oct-Dec / Jan-Mar), via the same billsInColumn() Billing.tsx
// itself uses — an order counts once at its full contracted amount if it
// bills in *any* month of that quarter, not per-month.
// ---------------------------------------------------------------------------

export type ForecastQuarter = "all" | "q3" | "q4";

export interface ManagerForecastRow {
  manager: string;
  orders: number;
  forecast: number;
  share: number;
}

export function buildManagerForecast(orders: OrderRecord[], quarter: ForecastQuarter): { rows: ManagerForecastRow[]; total: number } {
  const open = orders.filter((o) => o.lifecycleStatus !== "cancelled");
  const fyColumns = buildFiscalYearColumns(new Date());
  const quarterCols = quarter === "q3" ? fyColumns.slice(6, 9) : quarter === "q4" ? fyColumns.slice(9, 12) : null;
  const scoped = quarterCols ? open.filter((o) => quarterCols.some((c) => billsInColumn(o, c))) : open;

  const byManager = new Map<string, { orders: number; forecast: number }>();
  scoped.forEach((o) => {
    const cur = byManager.get(o.clientManager) ?? { orders: 0, forecast: 0 };
    cur.orders += 1;
    cur.forecast += o.amount;
    byManager.set(o.clientManager, cur);
  });

  const total = scoped.reduce((sum, o) => sum + o.amount, 0);
  const rows: ManagerForecastRow[] = Array.from(byManager.entries()).map(([manager, v]) => ({
    manager,
    orders: v.orders,
    forecast: v.forecast,
    share: total > 0 ? (v.forecast / total) * 100 : 0,
  }));
  return { rows, total };
}
