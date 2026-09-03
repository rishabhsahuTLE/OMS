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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BUSINESS_UNITS, type OrderDisplayStage, type OrderRecord, type OrdersSubTabId } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import { buildManagerStats } from "../ManagerReport";
import {
  billsInColumn,
  buildFiscalYearColumns,
  daysBetween,
  getDisplayStage,
  isBillingOpenInColumn,
} from "../../utils";
import {
  agreementEndDate,
  buildOrderNotifications,
  buildStuckData,
  DashCard,
  DEPT_STYLES,
  formatINR,
  StuckOrdersPie,
  type NavigateFn,
  type NotificationItem,
} from "./shared";

interface AdminDashboardProps {
  orders: OrderRecord[];
  onNavigate: NavigateFn;
}

type TileKey = "all" | OrderDisplayStage;

const STAGE_TILES: { key: TileKey; label: string; dest: OrdersSubTabId; accent: string }[] = [
  { key: "all", label: "All Orders", dest: "approval", accent: "text-slate-900" },
  { key: "approvalPending", label: "Pending", dest: "approval", accent: "text-amber-600" },
  { key: "active", label: "Active", dest: "approval", accent: "text-emerald-600" },
  { key: "agreementOver", label: "Agreement Over", dest: "approval", accent: "text-indigo-600" },
  { key: "closurePending", label: "Cancellation Pending", dest: "amendCancel", accent: "text-rose-600" },
  { key: "closed", label: "Closed", dest: "approval", accent: "text-slate-500" },
];

interface TatPair {
  end: string;
  days: number;
}

const TAT_STAGES: { key: string; label: string; pairs: (orders: OrderRecord[]) => TatPair[] }[] = [
  {
    key: "technical",
    label: "Tech",
    pairs: (orders) =>
      orders.filter((o) => o.technical.date).map((o) => ({ end: o.technical.date as string, days: daysBetween(o.createdOn, o.technical.date as string) })),
  },
  {
    key: "financial",
    label: "Fin",
    pairs: (orders) =>
      orders
        .filter((o) => o.technical.date && o.financial.date)
        .map((o) => ({ end: o.financial.date as string, days: daysBetween(o.technical.date as string, o.financial.date as string) })),
  },
  {
    key: "cancellationTechnical",
    label: "TC",
    pairs: (orders) =>
      orders
        .filter((o) => o.cancellationDetails && o.cancellationTechnical.date)
        .map((o) => ({
          end: o.cancellationTechnical.date as string,
          days: daysBetween(o.cancellationDetails!.effectFromDate, o.cancellationTechnical.date as string),
        })),
  },
  {
    key: "cancellationFinancial",
    label: "FC",
    pairs: (orders) =>
      orders
        .filter((o) => o.cancellationTechnical.date && o.cancellationFinancial.date)
        .map((o) => ({
          end: o.cancellationFinancial.date as string,
          days: daysBetween(o.cancellationTechnical.date as string, o.cancellationFinancial.date as string),
        })),
  },
];

// Mock data is generated from a fixed reference date (see mockOrders.ts), so
// no stage reliably has real decisions landing in the actual current/last
// calendar month — Cancellation-Technical in particular can have zero
// decided orders at all. Rather than showing an empty tile, every stage
// falls back to an illustrative number + direction here; the card title
// flags it as mock data whenever any stage is using this fallback.
const MOCK_TAT_FALLBACK: Record<string, { avg: number; pct: number }> = {
  technical: { avg: 3.2, pct: -6 },
  financial: { avg: 2.5, pct: 4 },
  cancellationTechnical: { avg: 4.1, pct: -9 },
  cancellationFinancial: { avg: 3.6, pct: 3 },
};

// Same fixed-reference-date issue as MOCK_TAT_FALLBACK above — no mock order
// currently has an outstanding balance, and Cancellation-Technical rarely
// has any pending orders either.
const MOCK_OUTSTANDING = { total: 186500, count: 2 };

function monthKeyOf(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return y * 12 + (m - 1);
}

function avgDays(rows: TatPair[]): number | null {
  return rows.length === 0 ? null : rows.reduce((sum, p) => sum + p.days, 0) / rows.length;
}

const PRODUCT_COLORS: Record<string, string> = {
  LMS: "#2a78d6",
  Quirio: "#eb6834",
};

const BU_COLORS = ["#4f46e5", "#0d9488", "#d97706", "#e11d48", "#64748b"];

export default function AdminDashboard({ orders, onNavigate }: AdminDashboardProps) {
  const liveOrders = useMemo(() => orders.filter((o) => o.lifecycleStatus !== "cancelled"), [orders]);
  const fyColumns = useMemo(() => buildFiscalYearColumns(new Date()), []);

  // Scopes the top KPI tiles to one Client Manager — the tiles themselves
  // are the stage-wise distribution now, so this filter replaces what used
  // to be a separate "Stage Distribution" tile at the bottom of the page.
  const [selectedManager, setSelectedManager] = useState("all");
  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);
  const scopedOrders = useMemo(
    () => (selectedManager === "all" ? orders : orders.filter((o) => o.clientManager === selectedManager)),
    [orders, selectedManager]
  );

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
    scopedOrders.forEach((o) => {
      const stage = getDisplayStage(o);
      stats[stage].count += 1;
      stats[stage].revenue += o.amount;
      stats.all.count += 1;
      stats.all.revenue += o.amount;
    });
    return stats;
  }, [scopedOrders]);

  // Every notification event across all three departments, plus the
  // Agreement Over events BD's own tab synthesizes — this is the one place
  // meant to show everything, unlike each role tab's own dept-scoped feed.
  // Deliberately org-wide (not scoped by the manager filter above).
  const alerts = useMemo<NotificationItem[]>(() => {
    const orderEvents = orders.flatMap(buildOrderNotifications);
    const agreementOverEvents: NotificationItem[] = orders
      .filter((o) => getDisplayStage(o) === "agreementOver")
      .map((o) => ({
        order: o,
        dept: "BD",
        message: "Agreement period has ended — review renewal or amendment",
        date: agreementEndDate(o),
        rejected: false,
      }));
    return [...orderEvents, ...agreementOverEvents]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 20);
  }, [orders]);

  const billingDue = useMemo(() => {
    const toOpen = orders.filter((o) => getDisplayStage(o) === "toOpen");
    const toAmend = orders.filter((o) => getDisplayStage(o) === "toAmend");
    const toClose = orders.filter((o) => o.lifecycleStatus === "cancelled" && o.billingStatus === "open");
    const total = toOpen.length + toAmend.length + toClose.length;
    const amount = [...toOpen, ...toAmend, ...toClose].reduce((sum, o) => sum + o.amount, 0);
    return { toOpen: toOpen.length, toAmend: toAmend.length, toClose: toClose.length, total, amount };
  }, [orders]);

  // No mock order currently has an unresolved outstanding balance, so this
  // would otherwise always render ₹0 — falls back to an illustrative figure,
  // flagged in the card title, same pattern as the TAT tile below.
  const outstanding = useMemo(() => {
    const rows = orders.filter((o) => o.cancellationDetails && o.billingStatus !== "closed");
    const total = rows.reduce((sum, o) => sum + (o.cancellationDetails?.outstandingBalance ?? 0), 0);
    const usingMock = rows.length === 0;
    return usingMock ? { ...MOCK_OUTSTANDING, usingMock } : { total, count: rows.length, usingMock };
  }, [orders]);

  const stuckData = useMemo(() => buildStuckData(orders), [orders]);
  const stuckUsesMock = stuckData.some((d) => d.mock);

  // This-month vs last-month average turnaround per stage, with the
  // direction of change — an increase is worse (red, up-arrow), a decrease
  // is better (green, down-arrow). Mock data is generated from a fixed
  // reference date (see mockOrders.ts), so it rarely if ever has real
  // decisions landing in the actual current/previous calendar month — when
  // that happens, this falls back to each stage's all-time average instead
  // of showing an empty tile, and the card title flags it as mock data.
  const tatMonthly = useMemo(() => {
    const now = new Date();
    const thisMonthKey = now.getFullYear() * 12 + now.getMonth();
    const lastMonthKey = thisMonthKey - 1;
    return TAT_STAGES.map((s) => {
      const pairs = s.pairs(orders);
      const thisAvg = avgDays(pairs.filter((p) => monthKeyOf(p.end) === thisMonthKey));
      const lastAvg = avgDays(pairs.filter((p) => monthKeyOf(p.end) === lastMonthKey));
      const realPctChange = thisAvg != null && lastAvg != null && lastAvg !== 0 ? ((thisAvg - lastAvg) / lastAvg) * 100 : null;
      const allTimeAvg = avgDays(pairs);
      const mock = MOCK_TAT_FALLBACK[s.key];
      const usingFallback = realPctChange == null;
      return {
        key: s.key,
        label: s.label,
        displayAvg: thisAvg ?? allTimeAvg ?? mock.avg,
        pctChange: realPctChange ?? mock.pct,
        usingFallback,
      };
    });
  }, [orders]);
  const tatUsesFallback = tatMonthly.some((t) => t.usingFallback);

  const activeBUs = useMemo(() => BUSINESS_UNITS.filter((bu) => liveOrders.some((o) => o.bu === bu)), [liveOrders]);

  const buTrendData = useMemo(
    () =>
      fyColumns.map((col) => {
        const row: Record<string, number | string> = { month: col.label };
        let total = 0;
        activeBUs.forEach((bu) => {
          const rev = liveOrders.filter((o) => o.bu === bu && billsInColumn(o, col)).reduce((sum, o) => sum + o.amount, 0);
          row[bu] = rev;
          total += rev;
        });
        row.Total = total;
        return row;
      }),
    [liveOrders, fyColumns, activeBUs]
  );

  const productMetrics = useMemo(
    () =>
      PRODUCT_NAMES.map((product) => ({
        product,
        label: product,
        revenue: liveOrders.filter((o) => o.product === product).reduce((sum, o) => sum + o.amount, 0),
      })).filter((m) => m.revenue > 0),
    [liveOrders]
  );

  const managerStats = useMemo(() => buildManagerStats(liveOrders).sort((a, b) => b.amount - a.amount), [liveOrders]);

  const revenueMotion = useMemo(() => {
    let inMotion = 0;
    let settled = 0;
    liveOrders.forEach((o) => {
      if (o.lifecycleStatus === "active") settled += o.amount;
      else if (o.lifecycleStatus === "cancellationInProgress" || (o.supersedes && o.lifecycleStatus === "inactive")) {
        inMotion += o.amount;
      }
    });
    return { inMotion, settled };
  }, [liveOrders]);

  const revenueSummary = useMemo(() => {
    let projected = 0;
    let opened = 0;
    fyColumns.forEach((col) => {
      liveOrders.forEach((o) => {
        if (!billsInColumn(o, col)) return;
        projected += o.amount;
        if (isBillingOpenInColumn(o, col)) opened += o.amount;
      });
    });
    return { projected, opened };
  }, [liveOrders, fyColumns]);

  return (
    <div className="flex flex-col gap-6">
      <DashCard
        title="Stage Distribution"
        action={
          <select
            value={selectedManager}
            onChange={(e) => setSelectedManager(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="all">All Managers</option>
            {managerOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STAGE_TILES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onNavigate("orders", t.dest, t.key === "all" ? undefined : { stage: t.key })}
              className="flex flex-col items-start gap-1 rounded-md border border-slate-100 bg-slate-50 p-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="text-xs font-medium text-slate-500">{t.label}</span>
              <span className={`text-2xl font-bold ${t.accent}`}>{stageStats[t.key].count}</span>
              <span className="text-xs font-semibold text-slate-500">{formatINR(stageStats[t.key].revenue)}</span>
            </button>
          ))}
        </div>
      </DashCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DashCard
          title="Billing Actions Due"
          action={
            <button
              type="button"
              onClick={() => onNavigate("orders", "closeBilling")}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              Go to Close Billing →
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-bold text-slate-800">{billingDue.toOpen}</p>
              <p className="text-xs text-slate-500">To Open</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{billingDue.toAmend}</p>
              <p className="text-xs text-slate-500">To Amend</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{billingDue.toClose}</p>
              <p className="text-xs text-slate-500">To Close</p>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">{formatINR(billingDue.amount)} total contracted value</p>
        </DashCard>

        <DashCard title={`Outstanding Balance (To Close)${outstanding.usingMock ? " (mock data)" : ""}`}>
          <div className="flex h-full items-center justify-between">
            <p className="text-2xl font-bold text-rose-600">{formatINR(outstanding.total)}</p>
            <p className="text-xs text-slate-400">across {outstanding.count} order{outstanding.count === 1 ? "" : "s"}</p>
          </div>
        </DashCard>

        <DashCard title={`TAT — This Month${tatUsesFallback ? " (mock data)" : ""}`}>
          <div className="grid grid-cols-2 gap-2">
            {tatMonthly.map((t) => (
              <div key={t.key} className="rounded-md border border-slate-100 bg-slate-50 p-2 text-center">
                <p className="text-xs font-medium text-slate-500">{t.label}</p>
                <p className="text-base font-bold text-slate-800">{t.displayAvg.toFixed(1)}d</p>
                <p
                  className={`flex items-center justify-center gap-1 text-[11px] font-semibold ${
                    t.pctChange > 0.5 ? "text-rose-600" : t.pctChange < -0.5 ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  {t.pctChange > 0.5 ? "▲" : t.pctChange < -0.5 ? "▼" : "–"} {Math.abs(t.pctChange).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DashCard title={`Where Orders Are Stuck (by revenue)${stuckUsesMock ? " (mock data)" : ""}`}>
          <StuckOrdersPie data={stuckData} />
        </DashCard>

        <DashCard title="Product-wise Revenue">
          {productMetrics.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No orders to show.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={productMetrics} dataKey="revenue" nameKey="label" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {productMetrics.map((m) => (
                    <Cell key={m.product} fill={PRODUCT_COLORS[m.product] ?? "#64748b"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </DashCard>

        <DashCard title="Alerts">
          {alerts.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No recent activity.</p>
          ) : (
            <div className="flex max-h-72 flex-col divide-y divide-slate-100 overflow-y-auto">
              {alerts.map((n, i) => (
                <div key={`${n.order.id}-${i}`} className={`flex items-center gap-2 border-l-4 py-2 pl-2 ${DEPT_STYLES[n.dept].border}`}>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate("orders", n.dept === "BD" ? "approval" : "amendCancel", {
                        stage: getDisplayStage(n.order),
                        q: n.order.orderNo,
                      })
                    }
                    className="min-w-0 flex-1 text-left hover:bg-slate-50"
                  >
                    <span className="block truncate text-sm text-slate-700">
                      <span className="font-medium text-slate-800">{n.order.orderNo}</span> — {n.message}
                    </span>
                    <span className={`text-xs font-semibold ${DEPT_STYLES[n.dept].text}`}>{n.dept}</span>
                  </button>
                  {n.rejected && (
                    <button
                      type="button"
                      onClick={() => onNavigate("orders", "approval", { edit: n.order.id })}
                      className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      Edit
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DashCard>
      </div>

      <DashCard title={`Revenue Trend by Business Unit — FY ${fyColumns[0].year}–${fyColumns[11].year}`}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={buTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
            <Line
              type="monotone"
              dataKey="Total"
              name="Total"
              stroke="#1b2333"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </DashCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DashCard title="Revenue In Motion">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">In Motion</p>
              <p className="text-xl font-bold text-amber-600">{formatINR(revenueMotion.inMotion)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-500">Settled Active</p>
              <p className="text-xl font-bold text-slate-700">{formatINR(revenueMotion.settled)}</p>
            </div>
          </div>
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            {(() => {
              const total = revenueMotion.inMotion + revenueMotion.settled;
              const motionPct = total > 0 ? (revenueMotion.inMotion / total) * 100 : 0;
              return (
                <>
                  <div className="h-full bg-amber-500" style={{ width: `${motionPct}%` }} />
                  <div className="h-full bg-slate-400" style={{ width: `${100 - motionPct}%` }} />
                </>
              );
            })()}
          </div>
        </DashCard>

        <DashCard title="Revenue — Opened vs Projected (per FBD)">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Opened</p>
              <p className="text-xl font-bold text-emerald-600">{formatINR(revenueSummary.opened)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-500">Projected</p>
              <p className="text-xl font-bold text-slate-700">{formatINR(revenueSummary.projected)}</p>
            </div>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{
                width: `${revenueSummary.projected > 0 ? Math.min(100, (revenueSummary.opened / revenueSummary.projected) * 100) : 0}%`,
              }}
            />
          </div>
        </DashCard>
      </div>

      <DashCard title="Manager-wise Revenue">
        {managerStats.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No orders to show.</p>
        ) : (
          <div className="flex max-h-64 flex-col divide-y divide-slate-100 overflow-y-auto">
            {managerStats.map((m) => (
              <button
                key={m.manager}
                type="button"
                onClick={() => onNavigate("report", "managerReport", { manager: m.manager })}
                className="flex items-center justify-between gap-3 py-2 text-left first:pt-0 hover:bg-slate-50"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-slate-800">{m.manager}</span>
                  <span className="text-xs text-slate-400">{m.total} order{m.total === 1 ? "" : "s"}</span>
                </span>
                <span className="text-sm font-semibold text-slate-700">{formatINR(m.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </DashCard>
    </div>
  );
}
