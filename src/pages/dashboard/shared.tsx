import { ResponsiveContainer, Pie, PieChart, Cell, Tooltip } from "recharts";
import type { MainTabId, OrderRecord, OrdersSubTabId, ReportSubTabId } from "../../types";
import {
  daysBetween,
  getDisplayStage,
  getNextActionableStage,
  isAmendmentPending,
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
  LMS: "#2a78d6",
  Quirio: "#eb6834",
};

export const BU_COLORS = ["#4f46e5", "#0d9488", "#d97706", "#e11d48", "#64748b"];

// ---------------------------------------------------------------------------
// Stage Distribution — the 5-bucket display taxonomy already used by Manage
// Orders' own view tabs (OrderApproval.tsx's ViewTab/matchesTab), reused
// here rather than inventing a second stage vocabulary for the dashboard.
// ---------------------------------------------------------------------------

export type StageBucketKey = "pending" | "amendmentPending" | "active" | "agreementOver" | "cancelled";

export const STAGE_BUCKETS: { key: StageBucketKey; label: string; tone: Tone; stageParam: string }[] = [
  { key: "pending", label: "Pending", tone: "amber", stageParam: "approvalPending" },
  { key: "amendmentPending", label: "Amendment Pending", tone: "violet", stageParam: "amendmentPending" },
  { key: "active", label: "Active", tone: "emerald", stageParam: "active" },
  { key: "agreementOver", label: "Agreement Over", tone: "indigo", stageParam: "agreementOver" },
  { key: "cancelled", label: "Cancelled", tone: "rose", stageParam: "closed" },
];

// approvalPending/closurePending/toOpen/toAmend all collapse into "Pending"
// here (same merge OrderApproval.tsx's own "Pending" tab already does for
// approvalPending+closurePending — toOpen/toAmend are folded in alongside
// them since they're pre-Active waits without their own dedicated tab).
export function stageBucketOf(order: OrderRecord): StageBucketKey {
  if (isAmendmentPending(order)) return "amendmentPending";
  const stage = getDisplayStage(order);
  if (stage === "active") return "active";
  if (stage === "agreementOver") return "agreementOver";
  if (stage === "closed") return "cancelled";
  return "pending";
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
  { key: "technical", label: "Technical", color: "#d97706" },
  { key: "financial", label: "Financial", color: "#059669" },
  { key: "cancellationTechnical", label: "Cancellation-Technical", color: "#4f46e5" },
  { key: "cancellationFinancial", label: "Cancellation-Financial", color: "#e11d48" },
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
  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="revenue" nameKey="label" cx="50%" cy="50%" innerRadius={58} outerRadius={96} paddingAngle={2}>
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
      {/* A custom legend, not recharts' own <Legend>, is what keeps this in
          the same Technical -> Financial -> Cancellation-Technical ->
          Cancellation-Financial chronological order as `data` — recharts'
          auto-derived legend payload doesn't reliably preserve source order. */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5">
        {data.map((d) => (
          <span key={d.key} className="flex items-center gap-2 text-xs text-slate-600">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            {d.label} ({d.count})
          </span>
        ))}
      </div>
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
}

const TAT_PAIR_BUILDERS: Record<ApprovalStageKey, (orders: OrderRecord[]) => TatPair[]> = {
  technical: (orders) =>
    orders.filter((o) => o.technical.date).map((o) => ({ end: o.technical.date as string, days: daysBetween(o.createdOn, o.technical.date as string) })),
  financial: (orders) =>
    orders
      .filter((o) => o.technical.date && o.financial.date)
      .map((o) => ({ end: o.financial.date as string, days: daysBetween(o.technical.date as string, o.financial.date as string) })),
  cancellationTechnical: (orders) =>
    orders
      .filter((o) => o.cancellationDetails && o.cancellationTechnical.date)
      .map((o) => ({
        end: o.cancellationTechnical.date as string,
        days: daysBetween(o.cancellationDetails!.effectFromDate, o.cancellationTechnical.date as string),
      })),
  cancellationFinancial: (orders) =>
    orders
      .filter((o) => o.cancellationTechnical.date && o.cancellationFinancial.date)
      .map((o) => ({
        end: o.cancellationFinancial.date as string,
        days: daysBetween(o.cancellationTechnical.date as string, o.cancellationFinancial.date as string),
      })),
};

// Mock data is generated from a fixed reference date (see mockOrders.ts), so
// a stage can easily have zero decisions landing in the real current
// calendar month — this falls back to that stage's all-time average, and
// (if there's no history at all) to an illustrative figure, flagged via
// `usingFallback`.
const TAT_MOCK_FALLBACK: Record<ApprovalStageKey, number> = {
  technical: 3.2,
  financial: 2.5,
  cancellationTechnical: 4.1,
  cancellationFinancial: 3.6,
};

function monthKeyOf(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return y * 12 + (m - 1);
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

export function buildTatStats(orders: OrderRecord[]): TatStat[] {
  const now = new Date();
  const thisMonthKey = now.getFullYear() * 12 + now.getMonth();
  return (Object.keys(TAT_PAIR_BUILDERS) as ApprovalStageKey[]).map((key) => {
    const pairs = TAT_PAIR_BUILDERS[key](orders);
    const thisMonthPairs = pairs.filter((p) => monthKeyOf(p.end) === thisMonthKey);
    const thisAvg = avgDays(thisMonthPairs);
    const allAvg = avgDays(pairs);
    return {
      key,
      label: STAGE_LABEL[key],
      avgDays: thisAvg ?? allAvg ?? TAT_MOCK_FALLBACK[key],
      sampleCount: thisMonthPairs.length > 0 ? thisMonthPairs.length : pairs.length,
      usingFallback: thisAvg == null,
    };
  });
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
// My Pipeline (BD only)
// ---------------------------------------------------------------------------

export interface PipelineStats {
  active: number;
  pending: number;
  total: number;
}

export function buildPipelineStats(orders: OrderRecord[]): PipelineStats {
  let pending = 0;
  let active = 0;
  orders.forEach((o) => {
    const stage = getDisplayStage(o);
    if (stage === "active" || stage === "agreementOver") active += o.amount;
    else if (stage !== "closed") pending += o.amount;
  });
  return { pending, active, total: pending + active };
}
