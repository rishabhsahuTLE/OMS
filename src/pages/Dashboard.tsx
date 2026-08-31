import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  type PieSectorDataItem,
} from "recharts";
import type { MainTabId, OrderDisplayStage, OrderRecord, OrdersSubTabId, ReportSubTabId } from "../types";
import { PRODUCT_NAMES } from "../products";
import DateRangePicker, { type DateRange } from "../components/DateRangePicker";
import {
  billsInColumn,
  buildFiscalYearColumns,
  daysBetween,
  getDisplayStage,
  todayISO,
  type ApprovalStageKey,
} from "../utils";

type NavigateFn = (
  tab: MainTabId,
  subTab?: ReportSubTabId | OrdersSubTabId,
  params?: Record<string, string>
) => void;

interface DashboardProps {
  orders: OrderRecord[];
  onNavigate: NavigateFn;
}

// Placeholder options only — there's no real Business Unit field on any
// order/client in this app yet, so this select doesn't filter anything.
const BU_OPTIONS = ["Univ-Ops", "Premiere Institutes", "Univ BD", "IMPACT", "Enterprise", "Enterprise CEP"];

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

type TileKey = "all" | OrderDisplayStage;

const STAGE_TILES: { key: TileKey; label: string; dest: OrdersSubTabId; accent: string }[] = [
  { key: "all", label: "All Orders", dest: "approval", accent: "text-slate-900" },
  // Lands on Manage Orders' merged "Pending" tab, so the tile label matches
  // what the user will actually see there.
  { key: "approvalPending", label: "Pending", dest: "approval", accent: "text-amber-600" },
  { key: "active", label: "Active", dest: "approval", accent: "text-emerald-600" },
  { key: "agreementOver", label: "Agreement Over", dest: "approval", accent: "text-indigo-600" },
  // Lands on the Approvals tab, which keeps this as its own distinct
  // "Cancellation Pending" tab.
  { key: "closurePending", label: "Cancellation Pending", dest: "amendCancel", accent: "text-rose-600" },
  // Manage Orders (not Approvals) is where Closed orders still live now that
  // Approvals is pending-only.
  { key: "closed", label: "Closed", dest: "approval", accent: "text-slate-500" },
];

// Categorical slots 1/2 of the validated palette (blue/orange) — distinct
// from the pie chart's slots 5-8 below so no hue is shared across two
// different identity dimensions on the same page.
const PRODUCT_COLORS: Record<string, string> = {
  LMS: "#2a78d6",
  Quirio: "#eb6834",
};

// Dedicated slots for the monthly trend's two series — deliberately not
// reusing PRODUCT_COLORS (which mean "LMS"/"Quirio" everywhere else on this
// page) since revenue/quantity here is a different, product-agnostic axis.
const TREND_COLORS = { revenue: "#0d9488", quantity: "#64748b" };

const STAGE_PIE_COLORS: Record<ApprovalStageKey, string> = {
  technical: "#e87ba4",
  financial: "#008300",
  cancellationTechnical: "#4a3aa7",
  cancellationFinancial: "#e34948",
};

const STAGE_PIE_LABELS: Record<ApprovalStageKey, string> = {
  technical: "Tech",
  financial: "Fin",
  cancellationTechnical: "TC",
  cancellationFinancial: "FC",
};

// Who a notification is for — BD submits, Tech decides first, then Finance;
// a rejection at either stage always bounces back to BD, an approval always
// hands off to whoever acts next. Same pattern for the cancellation pair
// (BD initiates closure -> Tech -> Finance). Eventually this filters by the
// logged-in user's actual role/team; for now every notification is shown to
// everyone, color-coded and labeled with its destined department instead.
type NotificationDept = "BD" | "Tech" | "Finance";

const DEPT_STYLES: Record<NotificationDept, { border: string; text: string }> = {
  BD: { border: "border-indigo-400", text: "text-indigo-600" },
  Tech: { border: "border-amber-400", text: "text-amber-600" },
  Finance: { border: "border-emerald-400", text: "text-emerald-600" },
};

interface NotificationItem {
  order: OrderRecord;
  dept: NotificationDept;
  message: string;
  date: string;
}

function buildOrderNotifications(order: OrderRecord): NotificationItem[] {
  const events: NotificationItem[] = [
    { order, dept: "Tech", message: "Order submitted — awaiting Technical review", date: order.createdOn },
  ];

  if (order.technical.status === "confirmed") {
    events.push({
      order,
      dept: "Finance",
      message: "Technical approved — ready for Financial review",
      date: order.technical.date as string,
    });
  } else if (order.technical.status === "rejected") {
    events.push({ order, dept: "BD", message: "Technical rejected", date: order.technical.date as string });
  }

  if (order.financial.status === "confirmed") {
    events.push({
      order,
      dept: "BD",
      message: "Financial approved — order is now Active",
      date: order.financial.date as string,
    });
  } else if (order.financial.status === "rejected") {
    events.push({ order, dept: "BD", message: "Financial rejected", date: order.financial.date as string });
  }

  if (order.cancellationDetails) {
    events.push({
      order,
      dept: "Tech",
      message: "Closure initiated — awaiting Cancellation-Technical review",
      date: order.cancellationDetails.effectFromDate,
    });
  }

  if (order.cancellationTechnical.status === "confirmed") {
    events.push({
      order,
      dept: "Finance",
      message: "Cancellation-Technical approved — ready for Cancellation-Financial review",
      date: order.cancellationTechnical.date as string,
    });
  } else if (order.cancellationTechnical.status === "rejected") {
    events.push({
      order,
      dept: "BD",
      message: "Cancellation-Technical rejected",
      date: order.cancellationTechnical.date as string,
    });
  }

  if (order.cancellationFinancial.status === "confirmed") {
    events.push({
      order,
      dept: "BD",
      message: "Cancellation-Financial approved — order is now Closed",
      date: order.cancellationFinancial.date as string,
    });
  } else if (order.cancellationFinancial.status === "rejected") {
    events.push({
      order,
      dept: "BD",
      message: "Cancellation-Financial rejected",
      date: order.cancellationFinancial.date as string,
    });
  }

  return events;
}

// Every one of the four approval decisions — Tech, Fin, Cancellation-Tech,
// Cancellation-Fin — is actually made on the Approvals screen; Manage Orders
// has no approve/reject action at all (create/amend/close-initiate only).
const STAGE_PIE_DEST: Record<ApprovalStageKey, OrdersSubTabId> = {
  technical: "amendCancel",
  financial: "amendCancel",
  cancellationTechnical: "amendCancel",
  cancellationFinancial: "amendCancel",
};

// Tech/Fin both fall under the "Approval Pending" stage tab; TC/FC both fall
// under "Closure Pending" — the finest-grained filter the existing stage
// tabs can express (there's no separate filter for exactly which of the pair
// is next).
const STAGE_PIE_FILTER: Record<ApprovalStageKey, OrderDisplayStage> = {
  technical: "approvalPending",
  financial: "approvalPending",
  cancellationTechnical: "closurePending",
  cancellationFinancial: "closurePending",
};

// Recharts' activeShape render prop — the hovered slice draws itself slightly
// larger and grows a centered name/value readout. `describeValue` lets each
// pie on this page (order counts, revenue, average days) render its own unit
// in that readout while sharing the same hover/enlarge mechanics.
function makeActivePieShape(describeValue: (payload: { label: string; n?: number }, value: number) => string) {
  return function ActivePieSlice(props: PieSectorDataItem) {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
    const p = payload as { label: string; n?: number };
    return (
      <g>
        <text x={cx} y={(cy ?? 0) - 6} textAnchor="middle" className="fill-slate-800 text-sm font-semibold">
          {p.label}
        </text>
        <text x={cx} y={(cy ?? 0) + 14} textAnchor="middle" className="fill-slate-500 text-xs">
          {describeValue(p, value as number)}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={(outerRadius ?? 0) + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    );
  };
}

const renderCountSlice = makeActivePieShape((_p, v) => `${v} order${v === 1 ? "" : "s"}`);
const renderRevenueSlice = makeActivePieShape((_p, v) => formatINR(v));
const renderTatSlice = makeActivePieShape((p, v) => `${v.toFixed(1)} day${v === 1 ? "" : "s"} avg (n=${p.n ?? 0})`);

interface TrendDotProps {
  cx?: number;
  cy?: number;
  payload?: { isCurrent: boolean };
}

// Emphasizes the current fiscal-year month's point on the trend lines,
// mirroring the amber "current month" treatment used elsewhere on this page.
function makeTrendDot(color: string) {
  return function TrendDot({ cx = 0, cy = 0, payload }: TrendDotProps) {
    const isCurrent = payload?.isCurrent ?? false;
    return (
      <circle cx={cx} cy={cy} r={isCurrent ? 5 : 3} fill={color} stroke={isCurrent ? "#ffffff" : "none"} strokeWidth={isCurrent ? 2 : 0} />
    );
  };
}

// A synthesized activity feed — there's no real notification backend, so
// this is derived entirely from the same StageStatus dates already on every
// order (skips anything still "pending", since only confirmed/rejected
// stages carry an actual event date).
function NotificationTile({ items, onNavigate }: { items: NotificationItem[]; onNavigate: NavigateFn }) {
  const today = todayISO();
  return (
    <div className="flex max-h-64 flex-col divide-y divide-slate-100 overflow-y-auto">
      {items.map((n, i) => (
        <button
          key={`${n.order.id}-${i}`}
          type="button"
          onClick={() =>
            onNavigate("orders", n.dept === "BD" ? "approval" : "amendCancel", {
              stage: getDisplayStage(n.order),
              q: n.order.orderNo,
            })
          }
          className={`flex items-start gap-2 border-l-4 py-2 pl-2 text-left first:pt-0 hover:bg-slate-50 ${DEPT_STYLES[n.dept].border}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-slate-700">
              <span className="font-medium text-slate-800">{n.order.orderNo}</span> — {n.message}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              {daysBetween(n.date, today)}d ago
              <span className={`font-semibold ${DEPT_STYLES[n.dept].text}`}>({n.dept})</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function parseISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

// Date filter is preset-driven (past 1/3/6 months, last year) rather than a
// bare calendar — "custom" is the one case that falls back to the calendar
// popover for a manual range.
type DatePreset = "all" | "1m" | "3m" | "6m" | "1y" | "custom";

const DATE_PRESET_OPTIONS: { key: DatePreset; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "1m", label: "Past 1 Month" },
  { key: "3m", label: "Past 3 Months" },
  { key: "6m", label: "Past 6 Months" },
  { key: "1y", label: "Last Year" },
  { key: "custom", label: "Custom Range" },
];

function computePresetRange(preset: DatePreset): DateRange {
  if (preset === "all" || preset === "custom") return { start: null, end: null };
  const end = new Date();
  const start = new Date(end);
  if (preset === "1m") start.setMonth(start.getMonth() - 1);
  else if (preset === "3m") start.setMonth(start.getMonth() - 3);
  else if (preset === "6m") start.setMonth(start.getMonth() - 6);
  else if (preset === "1y") start.setFullYear(start.getFullYear() - 1);
  return { start, end };
}

// Average days-to-decision across a set of {start,end} date pairs — the
// same day-diff convention Approval.tsx uses for its "Time Taken" columns,
// generalized here across all four approval stages instead of just Tech/Fin.
function avgDays(pairs: { start: string; end: string }[]): number {
  if (pairs.length === 0) return 0;
  const total = pairs.reduce((sum, p) => sum + daysBetween(p.start, p.end), 0);
  return total / pairs.length;
}

export default function Dashboard({ orders, onNavigate }: DashboardProps) {
  // Compact top filter bar — Date (by Order Creation Date, same convention
  // as every other list page's "Created On" filter), BU (Client Type —
  // there's no real Business Unit data in this app — the BU select is
  // presentational only (placeholder options, not wired to any filter);
  // Date and Product still narrow `filteredOrders` below, which every
  // chart/tile on this page is derived from.
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [buFilter, setBuFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");

  function handleDatePresetChange(preset: DatePreset) {
    setDatePreset(preset);
    setDateRange(computePresetRange(preset));
  }

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (dateRange.start && dateRange.end) {
      const startTime = dateRange.start.getTime();
      const endTime = dateRange.end.getTime();
      result = result.filter((o) => {
        const t = parseISO(o.createdOn).getTime();
        return t >= startTime && t <= endTime;
      });
    }
    if (productFilter !== "all") {
      result = result.filter((o) => o.product === productFilter);
    }
    return result;
  }, [orders, dateRange, productFilter]);

  const stageStats = useMemo(() => {
    const stats: Record<TileKey, { count: number; revenue: number }> = {
      all: { count: 0, revenue: 0 },
      approvalPending: { count: 0, revenue: 0 },
      toOpen: { count: 0, revenue: 0 },
      toAmend: { count: 0, revenue: 0 },
      active: { count: 0, revenue: 0 },
      agreementOver: { count: 0, revenue: 0 },
      closurePending: { count: 0, revenue: 0 },
      closed: { count: 0, revenue: 0 },
    };
    filteredOrders.forEach((o) => {
      const stage = getDisplayStage(o);
      stats[stage].count += 1;
      stats[stage].revenue += o.amount;
      stats.all.count += 1;
      stats.all.revenue += o.amount;
    });
    return stats;
  }, [filteredOrders]);

  const fyColumns = useMemo(() => buildFiscalYearColumns(new Date()), []);

  // "Live" (non-cancelled) orders are what every revenue/quantity figure on
  // this page is built from — a cancelled order's historical amount isn't
  // counted as current product/portfolio volume.
  const liveOrders = useMemo(() => filteredOrders.filter((o) => o.lifecycleStatus !== "cancelled"), [filteredOrders]);

  const productMetrics = useMemo(
    () =>
      PRODUCT_NAMES.map((product) => {
        const rows = liveOrders.filter((o) => o.product === product);
        return {
          product,
          label: product,
          count: rows.length,
          revenue: rows.reduce((sum, o) => sum + o.amount, 0),
        };
      }).filter((m) => m.count > 0),
    [liveOrders]
  );

  const monthlyTrendData = useMemo(
    () =>
      fyColumns.map((col) => {
        const billing = liveOrders.filter((o) => billsInColumn(o, col));
        return {
          month: col.label,
          isCurrent: col.isCurrent,
          revenue: billing.reduce((sum, o) => sum + o.amount, 0),
          quantity: billing.length,
        };
      }),
    [liveOrders, fyColumns]
  );

  const topManagers = useMemo(() => {
    const byManager = new Map<string, { count: number; revenue: number }>();
    filteredOrders.forEach((o) => {
      const cur = byManager.get(o.clientManager) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += o.amount;
      byManager.set(o.clientManager, cur);
    });
    return Array.from(byManager.entries())
      .map(([manager, stats]) => ({ manager, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
  }, [filteredOrders]);

  // Average turnaround per stage — Tech/Fin are the activation pair
  // (createdOn -> technical.date -> financial.date, the same day-math
  // Approval.tsx's "Time Taken" columns use); TC/FC are the cancellation
  // pair, anchored at cancellationDetails.effectFromDate (set the moment
  // cancellation is initiated, per initiateClosure() in utils.ts) rather
  // than a proxy date. Both confirmed and rejected outcomes count, since a
  // rejection is still a completed decision with a real date.
  const tatSlices = useMemo(() => {
    const techPairs = filteredOrders.reduce<{ start: string; end: string }[]>((acc, o) => {
      if (o.technical.date) acc.push({ start: o.createdOn, end: o.technical.date });
      return acc;
    }, []);
    const finPairs = filteredOrders.reduce<{ start: string; end: string }[]>((acc, o) => {
      if (o.technical.date && o.financial.date) acc.push({ start: o.technical.date, end: o.financial.date });
      return acc;
    }, []);
    const tcPairs = filteredOrders.reduce<{ start: string; end: string }[]>((acc, o) => {
      if (o.cancellationDetails && o.cancellationTechnical.date) {
        acc.push({ start: o.cancellationDetails.effectFromDate, end: o.cancellationTechnical.date });
      }
      return acc;
    }, []);
    const fcPairs = filteredOrders.reduce<{ start: string; end: string }[]>((acc, o) => {
      if (o.cancellationTechnical.date && o.cancellationFinancial.date) {
        acc.push({ start: o.cancellationTechnical.date, end: o.cancellationFinancial.date });
      }
      return acc;
    }, []);

    const groups: { key: ApprovalStageKey; pairs: { start: string; end: string }[] }[] = [
      { key: "technical", pairs: techPairs },
      { key: "financial", pairs: finPairs },
      { key: "cancellationTechnical", pairs: tcPairs },
      { key: "cancellationFinancial", pairs: fcPairs },
    ];

    return groups
      .map(({ key, pairs }) => ({ key, label: STAGE_PIE_LABELS[key], value: avgDays(pairs), n: pairs.length }))
      .filter((s) => s.n > 0);
  }, [filteredOrders]);

  const notificationItems = useMemo(() => {
    const events = filteredOrders.flatMap(buildOrderNotifications);
    return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 15);
  }, [filteredOrders]);

  return (
    <div className="flex flex-col gap-6">
      {/* -mt-6/-top-6 cancel out <main>'s own p-6 top padding (App.tsx) — that
          padding doesn't scroll away, so without this the bar would always
          sit stuck 24px below the real top of the viewport, with a
          permanent gap of page background showing above it. pt-6 puts that
          same 24px back as this element's own padding instead, so the
          visual spacing looks identical but now scrolls/sticks correctly. */}
      <div className="sticky -top-6 -mt-6 z-30 flex flex-wrap items-center justify-end gap-2 bg-slate-100 pt-6 pb-2">
        <select
          value={datePreset}
          onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {DATE_PRESET_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        {datePreset === "custom" && <DateRangePicker value={dateRange} onChange={setDateRange} />}
        <select
          value={buFilter}
          onChange={(e) => setBuFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="all">All Business Units</option>
          {BU_OPTIONS.map((bu) => (
            <option key={bu} value={bu}>
              {bu}
            </option>
          ))}
        </select>
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="all">All Products</option>
          {PRODUCT_NAMES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGE_TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onNavigate("orders", t.dest, t.key === "all" ? undefined : { stage: t.key })}
            className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300 hover:shadow-md"
          >
            <span className="text-xs font-medium text-slate-500">{t.label}</span>
            <span className={`text-2xl font-bold ${t.accent}`}>{stageStats[t.key].count}</span>
            <span className="text-xs font-semibold text-slate-500">{formatINR(stageStats[t.key].revenue)}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Product-wise Quantity &amp; Revenue</h3>
        {productMetrics.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No orders to show.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-center text-xs font-medium text-slate-500">Quantity (Orders)</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={productMetrics}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    activeShape={renderCountSlice}
                    onClick={(entry) =>
                      onNavigate("report", "billing", { product: (entry.payload as { product: string }).product })
                    }
                    className="cursor-pointer"
                  >
                    {productMetrics.map((m) => (
                      <Cell key={m.product} fill={PRODUCT_COLORS[m.product]} />
                    ))}
                  </Pie>
                  <Tooltip content={() => null} cursor={false} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="mb-2 text-center text-xs font-medium text-slate-500">Revenue</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={productMetrics}
                    dataKey="revenue"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    activeShape={renderRevenueSlice}
                    onClick={(entry) =>
                      onNavigate("report", "billing", { product: (entry.payload as { product: string }).product })
                    }
                    className="cursor-pointer"
                  >
                    {productMetrics.map((m) => (
                      <Cell key={m.product} fill={PRODUCT_COLORS[m.product]} />
                    ))}
                  </Pie>
                  <Tooltip content={() => null} cursor={false} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Monthly Trend — FY {fyColumns[0].year}–{fyColumns[11].year}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={monthlyTrendData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            onClick={() => onNavigate("report", "billing")}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid vertical={false} stroke="#e1e0d9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#898781" }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#898781" }}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDecimals={false}
            />
            <Tooltip
              formatter={(v, name) => (name === "Revenue" ? formatINR(Number(v)) : Number(v))}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={TREND_COLORS.revenue}
              strokeWidth={2}
              dot={makeTrendDot(TREND_COLORS.revenue)}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="quantity"
              name="Quantity"
              stroke={TREND_COLORS.quantity}
              strokeWidth={2}
              dot={makeTrendDot(TREND_COLORS.quantity)}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Top Account Managers</h3>
          <button
            type="button"
            onClick={() => onNavigate("report", "managerReport")}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            View all →
          </button>
        </div>
        {topManagers.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No orders to show.</p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {topManagers.map((m, i) => (
              <button
                key={m.manager}
                type="button"
                onClick={() => onNavigate("report", "managerReport", { manager: m.manager })}
                className="flex items-center justify-between gap-3 py-3 text-left first:pt-0 hover:bg-slate-50"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                    {i + 1}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-slate-800">{m.manager}</span>
                    <span className="text-xs text-slate-400">
                      {m.count} order{m.count === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
                <span className="text-sm font-semibold text-slate-700">{formatINR(m.revenue)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Turnaround Time by Stage</h3>
          {tatSlices.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Not enough decided orders yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={tatSlices}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  activeShape={renderTatSlice}
                  onClick={(entry) => {
                    const key = (entry.payload as { key: ApprovalStageKey }).key;
                    onNavigate("orders", STAGE_PIE_DEST[key], { stage: STAGE_PIE_FILTER[key] });
                  }}
                  className="cursor-pointer"
                >
                  {tatSlices.map((s) => (
                    <Cell key={s.key} fill={STAGE_PIE_COLORS[s.key]} />
                  ))}
                </Pie>
                {/* No visual tooltip box — its mouse-tracking is what drives
                    activeShape's hover-to-enlarge above, so it stays mounted
                    but renders nothing of its own. */}
                <Tooltip content={() => null} cursor={false} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Notifications</h3>
          {notificationItems.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No recent activity.</p>
          ) : (
            <NotificationTile items={notificationItems} onNavigate={onNavigate} />
          )}
        </div>
      </div>
    </div>
  );
}
