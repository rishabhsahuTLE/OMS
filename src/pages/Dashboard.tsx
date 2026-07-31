import { Fragment, useMemo } from "react";
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
import type { MainTabId, OrderDisplayStage, OrderRecord, OrdersSubTabId } from "../types";
import { PRODUCT_NAMES } from "../products";
import {
  billsInColumn,
  buildFiscalYearColumns,
  daysBetween,
  getDisplayStage,
  getNextActionableStage,
  todayISO,
  totalBilledToDate,
  type ApprovalStageKey,
  type FyColumn,
} from "../utils";

interface DashboardProps {
  orders: OrderRecord[];
  onNavigate: (tab: MainTabId, subTab?: OrdersSubTabId) => void;
}

function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

type TileKey = "all" | OrderDisplayStage;

const STAGE_TILES: { key: TileKey; label: string; dest: OrdersSubTabId; accent: string }[] = [
  { key: "all", label: "All Orders", dest: "approval", accent: "text-slate-900" },
  { key: "approvalPending", label: "Approval Pending", dest: "approval", accent: "text-amber-600" },
  { key: "active", label: "Active", dest: "approval", accent: "text-emerald-600" },
  { key: "agreementOver", label: "Agreement Over", dest: "approval", accent: "text-indigo-600" },
  { key: "closurePending", label: "Closure Pending", dest: "amendCancel", accent: "text-rose-600" },
  { key: "closed", label: "Closed", dest: "amendCancel", accent: "text-slate-500" },
];

// Categorical slots 1/2 of the validated palette (blue/orange) — distinct
// from the pie chart's slots 5-8 below so no hue is shared across two
// different identity dimensions on the same page.
const PRODUCT_COLORS: Record<string, string> = {
  LMS: "#2a78d6",
  Quirio: "#eb6834",
};

const STAGE_PIE_COLORS: Record<ApprovalStageKey, string> = {
  technical: "#e87ba4",
  financial: "#008300",
  cancellationTechnical: "#4a3aa7",
  cancellationFinancial: "#e34948",
};

const STAGE_PIE_LABELS: Record<ApprovalStageKey, string> = {
  technical: "Tech Pending",
  financial: "Fin Pending",
  cancellationTechnical: "TC Pending",
  cancellationFinancial: "FC Pending",
};

interface ManagerRevenueRow {
  manager: string;
  perProduct: { product: string; ytd: number; total: number }[];
  grandTotal: number;
}

function buildManagerRows(
  managers: string[],
  orders: OrderRecord[],
  fyColumns: FyColumn[],
  currentColIdx: number,
  totalFor: (order: OrderRecord) => number
): ManagerRevenueRow[] {
  const elapsedColumns = fyColumns.slice(0, currentColIdx + 1);
  return managers.map((manager) => {
    const perProduct = PRODUCT_NAMES.map((product) => {
      const managerOrders = orders.filter(
        (o) => o.clientManager === manager && o.product === product && o.lifecycleStatus !== "cancelled"
      );
      const ytd = managerOrders.reduce(
        (sum, o) => sum + elapsedColumns.reduce((s, col) => s + (billsInColumn(o, col) ? o.amount : 0), 0),
        0
      );
      const total = managerOrders.reduce((sum, o) => sum + totalFor(o), 0);
      return { product, ytd, total };
    });
    const grandTotal = perProduct.reduce((s, p) => s + p.total, 0);
    return { manager, perProduct, grandTotal };
  });
}

function RevenueTable({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: ManagerRevenueRow[];
}) {
  const totals = useMemo(() => {
    const perProduct = PRODUCT_NAMES.map((product, idx) => ({
      product,
      ytd: rows.reduce((s, r) => s + r.perProduct[idx].ytd, 0),
      total: rows.reduce((s, r) => s + r.perProduct[idx].total, 0),
    }));
    const grandTotal = rows.reduce((s, r) => s + r.grandTotal, 0);
    return { perProduct, grandTotal };
  }, [rows]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <th className="whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                Account Manager
              </th>
              {PRODUCT_NAMES.map((product) => (
                <th
                  key={product}
                  colSpan={2}
                  className="whitespace-nowrap border-l border-slate-200 bg-indigo-50 px-4 py-1.5 text-center font-semibold text-indigo-800"
                >
                  {product}
                </th>
              ))}
              <th className="whitespace-nowrap border-l border-slate-200 bg-slate-50 px-4 py-2 text-right font-semibold text-slate-600">
                Grand Total
              </th>
            </tr>
            <tr>
              <th className="whitespace-nowrap bg-slate-50 px-4 py-1"></th>
              {PRODUCT_NAMES.map((product) => (
                <Fragment key={product}>
                  <th className="whitespace-nowrap border-l border-slate-200 bg-slate-50 px-4 py-1.5 text-right font-medium text-slate-500">
                    YTD
                  </th>
                  <th className="whitespace-nowrap bg-slate-50 px-4 py-1.5 text-right font-medium text-slate-500">
                    Total
                  </th>
                </Fragment>
              ))}
              <th className="whitespace-nowrap border-l border-slate-200 bg-slate-50 px-4 py-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.manager} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{r.manager}</td>
                {r.perProduct.map((p) => (
                  <Fragment key={p.product}>
                    <td className="whitespace-nowrap border-l border-slate-100 px-4 py-2 text-right text-slate-700">
                      {p.ytd > 0 ? formatINR(p.ytd) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-slate-700">
                      {p.total > 0 ? formatINR(p.total) : "—"}
                    </td>
                  </Fragment>
                ))}
                <td className="whitespace-nowrap border-l border-slate-100 px-4 py-2 text-right font-medium text-slate-800">
                  {r.grandTotal > 0 ? formatINR(r.grandTotal) : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold text-slate-800">
              <td className="whitespace-nowrap px-4 py-2">Total</td>
              {totals.perProduct.map((p) => (
                <Fragment key={p.product}>
                  <td className="whitespace-nowrap border-l border-slate-200 px-4 py-2 text-right">
                    {formatINR(p.ytd)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">{formatINR(p.total)}</td>
                </Fragment>
              ))}
              <td className="whitespace-nowrap border-l border-slate-200 px-4 py-2 text-right">
                {formatINR(totals.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Dashboard({ orders, onNavigate }: DashboardProps) {
  const stageCounts = useMemo(() => {
    const counts: Record<TileKey, number> = {
      all: orders.length,
      approvalPending: 0,
      active: 0,
      agreementOver: 0,
      closurePending: 0,
      closed: 0,
    };
    orders.forEach((o) => {
      counts[getDisplayStage(o)]++;
    });
    return counts;
  }, [orders]);

  const fyColumns = useMemo(() => buildFiscalYearColumns(new Date()), []);
  const currentColIdx = fyColumns.findIndex((c) => c.isCurrent);

  const revenueByProduct = useMemo(() => {
    const live = orders.filter((o) => o.lifecycleStatus !== "cancelled");
    return PRODUCT_NAMES.map((product) => {
      const productOrders = live.filter((o) => o.product === product);
      const monthly = fyColumns.map((col) => ({
        month: col.label,
        amount: productOrders.reduce((sum, o) => sum + (billsInColumn(o, col) ? o.amount : 0), 0),
        isCurrent: col.isCurrent,
      }));
      return { product, monthly };
    });
  }, [orders, fyColumns]);

  const stageStuck = useMemo(() => {
    const counts: Record<ApprovalStageKey, number> = {
      technical: 0,
      financial: 0,
      cancellationTechnical: 0,
      cancellationFinancial: 0,
    };
    orders.forEach((o) => {
      const next = getNextActionableStage(o);
      if (next) counts[next.key]++;
    });
    return (Object.keys(counts) as ApprovalStageKey[])
      .map((key) => ({ key, label: STAGE_PIE_LABELS[key], value: counts[key] }))
      .filter((s) => s.value > 0);
  }, [orders]);

  // Priority 1: closure-pending orders (amended predecessors first, oldest
  // first) — these are the "amended/old orders that haven't been closed."
  // Priority 2, only when none of those exist: agreement-over orders that
  // haven't had closure initiated yet — these "need closing" proactively.
  const attentionItems = useMemo(() => {
    const today = todayISO();
    const closurePending = orders
      .filter((o) => getDisplayStage(o) === "closurePending")
      .map((o) => ({
        order: o,
        reason: o.amended ? "Amended predecessor awaiting closure" : "Cancellation in progress",
        age: daysBetween(o.cancellationDetails?.effectFromDate ?? o.createdOn, today),
      }))
      .sort((a, b) => Number(b.order.amended) - Number(a.order.amended) || b.age - a.age);

    if (closurePending.length > 0) return closurePending.slice(0, 10);

    return orders
      .filter((o) => getDisplayStage(o) === "agreementOver")
      .map((o) => ({
        order: o,
        reason: "Agreement over — needs closing",
        age: daysBetween(`${o.details.firstBillingMonth}-01`, today),
      }))
      .sort((a, b) => b.age - a.age)
      .slice(0, 10);
  }, [orders]);

  const managers = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  const revenueSummaryRows = useMemo(
    () => buildManagerRows(managers, orders, fyColumns, currentColIdx, (o) => totalBilledToDate(o, new Date())),
    [managers, orders, fyColumns, currentColIdx]
  );

  const revenueProjectionRows = useMemo(
    () =>
      buildManagerRows(managers, orders, fyColumns, currentColIdx, (o) =>
        fyColumns.reduce((s, col) => s + (billsInColumn(o, col) ? o.amount : 0), 0)
      ),
    [managers, orders, fyColumns, currentColIdx]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGE_TILES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onNavigate("orders", t.dest)}
            className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-300 hover:shadow-md"
          >
            <span className="text-xs font-medium text-slate-500">{t.label}</span>
            <span className={`text-2xl font-bold ${t.accent}`}>{stageCounts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {revenueByProduct.map(({ product, monthly }) => (
          <div key={product} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              {product} Revenue — FY {fyColumns[0].year}–{fyColumns[11].year}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e1e0d9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#898781" }}
                  axisLine={{ stroke: "#c3c2b7" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#898781" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} fill={PRODUCT_COLORS[product]}>
                  {monthly.map((m, i) => (
                    <Cell key={i} fillOpacity={m.isCurrent ? 1 : 0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Orders Stuck by Approval Stage</h3>
          {stageStuck.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Nothing pending right now.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart margin={{ top: 24, bottom: 0, left: 8, right: 8 }}>
                <Pie
                  data={stageStuck}
                  dataKey="value"
                  nameKey="label"
                  cy="52%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {stageStuck.map((s) => (
                    <Cell key={s.key} fill={STAGE_PIE_COLORS[s.key]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${v} order${Number(v) === 1 ? "" : "s"}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Needs Immediate Attention</h3>
          {attentionItems.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">All caught up — nothing needs attention.</p>
          ) : (
            <div className="relative h-56 overflow-hidden">
              <div
                className="attention-scroll-track absolute inset-x-0 top-0"
                style={{ animationDuration: `${attentionItems.length * 4}s` }}
              >
                {[...attentionItems, ...attentionItems].map((item, i) => (
                  <button
                    key={`${item.order.id}-${i}`}
                    type="button"
                    onClick={() =>
                      onNavigate("orders", item.order.lifecycleStatus === "cancellationInProgress" ? "amendCancel" : "approval")
                    }
                    className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-1 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${
                      item.order.amended ? "bg-yellow-50" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-slate-800">{item.order.orderNo}</span>{" "}
                      <span className="text-slate-500">— {item.order.client}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {item.reason} · {item.age}d
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <RevenueTable
        title="Revenue Summary"
        subtitle="Revenue collected to date, by account manager and product"
        rows={revenueSummaryRows}
      />

      <RevenueTable
        title="Revenue Projection"
        subtitle={`Full fiscal year ${fyColumns[0].year}–${fyColumns[11].year} projection, by account manager and product`}
        rows={revenueProjectionRows}
      />
    </div>
  );
}
