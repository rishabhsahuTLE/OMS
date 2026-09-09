import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
  CURRENT_USER_EMAIL,
  daysBetween,
  deriveCreatedByName,
  getDisplayStage,
  getNextActionableStage,
  todayISO,
} from "../../utils";
import { ApprovalQueueList, DashCard, formatINR, STAGE_ANCHOR, STAGE_DEPT, type NavigateFn, type QueueItem } from "./shared";

interface FinanceDashboardProps {
  orders: OrderRecord[];
  onNavigate: NavigateFn;
}

const PRODUCT_COLORS: Record<string, string> = {
  LMS: "#2a78d6",
  Quirio: "#eb6834",
};

// A small categorical palette for the BU-wise stacked trend — enough slots
// for every BUSINESS_UNITS value without repeating a hue.
const BU_COLORS = ["#4f46e5", "#0d9488", "#d97706", "#e11d48", "#64748b"];

// The one identity the whole app has — see utils.ts's CURRENT_USER_EMAIL.
const SELF_NAME = deriveCreatedByName(CURRENT_USER_EMAIL);

// Same Stage Distribution tile set/styling as AdminDashboard.tsx, kept in
// sync deliberately — every role dashboard's Stage Distribution should look
// and behave identically, just scoped to that role's own orders.
type TileKey = "all" | OrderDisplayStage;

const STAGE_TILES: { key: TileKey; label: string; dest: OrdersSubTabId; accent: string }[] = [
  { key: "all", label: "All Orders", dest: "approval", accent: "text-slate-900" },
  { key: "approvalPending", label: "Pending", dest: "approval", accent: "text-amber-600" },
  { key: "active", label: "Active", dest: "approval", accent: "text-emerald-600" },
  { key: "agreementOver", label: "Agreement Over", dest: "approval", accent: "text-indigo-600" },
  { key: "closurePending", label: "Cancellation Pending", dest: "amendCancel", accent: "text-rose-600" },
  { key: "closed", label: "Closed", dest: "approval", accent: "text-slate-500" },
];

export default function FinanceDashboard({ orders, onNavigate }: FinanceDashboardProps) {
  const liveOrders = useMemo(() => orders.filter((o) => o.lifecycleStatus !== "cancelled"), [orders]);
  const fyColumns = useMemo(() => buildFiscalYearColumns(new Date()), []);

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

  // Average days-to-decision across every decided (confirmed or rejected)
  // Fin/Cancellation-Fin stage, split by who actually processed it — the
  // Finance-owned mirror of Tech's own Clearance Stats tile.
  const clearanceStats = useMemo(() => {
    const pairs: { start: string; end: string; self: boolean }[] = [];
    orders.forEach((order) => {
      if (order.technical.date && order.financial.date) {
        pairs.push({
          start: order.technical.date,
          end: order.financial.date,
          self: order.financial.processedBy === SELF_NAME,
        });
      }
      if (order.cancellationTechnical.date && order.cancellationFinancial.date) {
        pairs.push({
          start: order.cancellationTechnical.date,
          end: order.cancellationFinancial.date,
          self: order.cancellationFinancial.processedBy === SELF_NAME,
        });
      }
    });
    const avg = (rows: typeof pairs) =>
      rows.length === 0 ? 0 : rows.reduce((sum, p) => sum + daysBetween(p.start, p.end), 0) / rows.length;
    const self = pairs.filter((p) => p.self);
    const others = pairs.filter((p) => !p.self);
    return { selfAvg: avg(self), selfN: self.length, othersAvg: avg(others), othersN: others.length };
  }, [orders]);

  const queue = useMemo<QueueItem[]>(() => {
    const today = todayISO();
    const items: QueueItem[] = [];
    orders.forEach((order) => {
      if (order.lifecycleStatus === "cancelled") return;
      const actionable = getNextActionableStage(order);
      if (!actionable || STAGE_DEPT[actionable.key] !== "Finance") return;
      if (order[actionable.key].status !== "pending") return;
      items.push({
        order,
        stageLabel: `${actionable.label} approval pending`,
        ageDays: daysBetween(STAGE_ANCHOR[actionable.key](order), today),
      });
    });
    return items;
  }, [orders]);

  // Every billing action currently sitting on Finance's plate, across all
  // three Open/Close Billing buckets — same one-line conditions
  // CloseBilling.tsx uses for its own tab filters.
  const billingDue = useMemo(() => {
    const toOpen = orders.filter((o) => getDisplayStage(o) === "toOpen");
    const toAmend = orders.filter((o) => getDisplayStage(o) === "toAmend");
    const toClose = orders.filter((o) => o.lifecycleStatus === "cancelled" && o.billingStatus === "open");
    const total = toOpen.length + toAmend.length + toClose.length;
    const amount = [...toOpen, ...toAmend, ...toClose].reduce((sum, o) => sum + o.amount, 0);
    return { toOpen: toOpen.length, toAmend: toAmend.length, toClose: toClose.length, total, amount };
  }, [orders]);

  const productMetrics = useMemo(
    () =>
      PRODUCT_NAMES.map((product) => ({
        product,
        label: product,
        revenue: liveOrders.filter((o) => o.product === product).reduce((sum, o) => sum + o.amount, 0),
      })).filter((m) => m.revenue > 0),
    [liveOrders]
  );

  const activeBUs = useMemo(
    () => BUSINESS_UNITS.filter((bu) => liveOrders.some((o) => o.bu === bu)),
    [liveOrders]
  );

  const buTrendData = useMemo(
    () =>
      fyColumns.map((col) => {
        const row: Record<string, number | string> = { month: col.label };
        activeBUs.forEach((bu) => {
          row[bu] = liveOrders
            .filter((o) => o.bu === bu && billsInColumn(o, col))
            .reduce((sum, o) => sum + o.amount, 0);
        });
        return row;
      }),
    [liveOrders, fyColumns, activeBUs]
  );

  const managerStats = useMemo(
    () => buildManagerStats(liveOrders).sort((a, b) => b.amount - a.amount),
    [liveOrders]
  );

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DashCard title="Approver Queue">
          <ApprovalQueueList
            items={queue}
            onNavigate={onNavigate}
            destTab="amendCancel"
            emptyMessage="Nothing waiting on Finance approval right now."
          />
        </DashCard>

        <DashCard title="Product-wise Revenue">
          {productMetrics.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No orders to show.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
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
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <DashCard title="Clearance Stats — Self vs Others">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Your avg TAT</p>
              <p className="text-xl font-bold text-indigo-600">
                {clearanceStats.selfN > 0 ? `${clearanceStats.selfAvg.toFixed(1)}d` : "—"}
              </p>
              <p className="text-xs text-slate-400">n={clearanceStats.selfN}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-500">Others avg TAT</p>
              <p className="text-xl font-bold text-slate-700">
                {clearanceStats.othersN > 0 ? `${clearanceStats.othersAvg.toFixed(1)}d` : "—"}
              </p>
              <p className="text-xs text-slate-400">n={clearanceStats.othersN}</p>
            </div>
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

      <DashCard title={`Revenue Trend by Business Unit — FY ${fyColumns[0].year}–${fyColumns[11].year}`}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={buTrendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              <Bar key={bu} dataKey={bu} name={bu} stackId="bu" fill={BU_COLORS[i % BU_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </DashCard>
    </div>
  );
}
