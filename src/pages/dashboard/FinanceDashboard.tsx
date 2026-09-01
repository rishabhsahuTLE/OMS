import { useMemo } from "react";
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
import { BUSINESS_UNITS, type OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import { buildManagerStats } from "../ManagerReport";
import {
  billsInColumn,
  buildFiscalYearColumns,
  daysBetween,
  getDisplayStage,
  getNextActionableStage,
  isBillingOpenInColumn,
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

export default function FinanceDashboard({ orders, onNavigate }: FinanceDashboardProps) {
  const liveOrders = useMemo(() => orders.filter((o) => o.lifecycleStatus !== "cancelled"), [orders]);
  const fyColumns = useMemo(() => buildFiscalYearColumns(new Date()), []);

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

  // Money still owed on an order whose cancellation is underway or done but
  // not yet closed — not surfaced anywhere else in the app today.
  const outstanding = useMemo(() => {
    const rows = orders.filter((o) => o.cancellationDetails && o.billingStatus !== "closed");
    return {
      total: rows.reduce((sum, o) => sum + (o.cancellationDetails?.outstandingBalance ?? 0), 0),
      count: rows.length,
    };
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
      <DashCard title="Approver Queue">
        <ApprovalQueueList
          items={queue}
          onNavigate={onNavigate}
          destTab="amendCancel"
          emptyMessage="Nothing waiting on Finance approval right now."
        />
      </DashCard>

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

      <h3 className="-mb-2 text-sm font-semibold text-slate-500">Revenue</h3>

      <DashCard title="Outstanding Balance (To Close)">
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold text-rose-600">{formatINR(outstanding.total)}</p>
          <p className="text-xs text-slate-400">across {outstanding.count} order{outstanding.count === 1 ? "" : "s"}</p>
        </div>
      </DashCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
    </div>
  );
}
