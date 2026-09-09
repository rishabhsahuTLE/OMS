import { useEffect, useMemo, useRef, useState } from "react";
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
import { billsInColumn, buildFiscalYearColumns, getDisplayStage } from "../../utils";
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

interface BdDashboardProps {
  orders: OrderRecord[];
  onNavigate: NavigateFn;
}

const PRODUCT_COLORS: Record<string, string> = {
  LMS: "#2a78d6",
  Quirio: "#eb6834",
};

const BU_COLORS = ["#4f46e5", "#0d9488", "#d97706", "#e11d48", "#64748b"];

// Same Stage Distribution tile set/styling as AdminDashboard.tsx, kept in
// sync deliberately — every role dashboard's Stage Distribution should look
// and behave identically. BD already has its own Client Manager filter above
// this card (the checkbox dropdown below), so unlike Tech/Finance/Admin this
// card has no second, redundant manager-select control of its own.
type TileKey = "all" | OrderDisplayStage;

const STAGE_TILES: { key: TileKey; label: string; dest: OrdersSubTabId; accent: string }[] = [
  { key: "all", label: "All Orders", dest: "approval", accent: "text-slate-900" },
  { key: "approvalPending", label: "Pending", dest: "approval", accent: "text-amber-600" },
  { key: "active", label: "Active", dest: "approval", accent: "text-emerald-600" },
  { key: "agreementOver", label: "Agreement Over", dest: "approval", accent: "text-indigo-600" },
  { key: "closurePending", label: "Cancellation Pending", dest: "amendCancel", accent: "text-rose-600" },
  { key: "closed", label: "Closed", dest: "approval", accent: "text-slate-500" },
];

// A dropdown of checkboxes rather than a single-select — no auth exists, so
// this is the one control that scopes every other tile below it, and an
// admin comparing several managers at once needs to select more than one.
function ClientManagerFilter({
  managerOptions,
  selected,
  onToggle,
  onClear,
}: {
  managerOptions: string[];
  selected: Set<string>;
  onToggle: (manager: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const label = selected.size === 0 ? "All Managers" : `${selected.size} Manager${selected.size === 1 ? "" : "s"} selected`;

  return (
    <div ref={ref} className="relative inline-block w-full sm:w-72">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      >
        <span>{label}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={onClear}
            className="block w-full px-3 py-1.5 text-left text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Clear (show all)
          </button>
          {managerOptions.map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={selected.has(m)}
                onChange={() => onToggle(m)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
              />
              {m}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BdDashboard({ orders, onNavigate }: BdDashboardProps) {
  // No login exists — an empty selection means "no filter", so this serves
  // both a plain BD view and an admin comparing several managers at once.
  const [selectedManagers, setSelectedManagers] = useState<Set<string>>(new Set());

  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  function toggleManager(manager: string) {
    setSelectedManagers((prev) => {
      const next = new Set(prev);
      if (next.has(manager)) next.delete(manager);
      else next.add(manager);
      return next;
    });
  }

  const scopedOrders = useMemo(
    () => (selectedManagers.size === 0 ? orders : orders.filter((o) => selectedManagers.has(o.clientManager))),
    [orders, selectedManagers]
  );

  const liveScopedOrders = useMemo(() => scopedOrders.filter((o) => o.lifecycleStatus !== "cancelled"), [scopedOrders]);
  const fyColumns = useMemo(() => buildFiscalYearColumns(new Date()), []);

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

  const stuckData = useMemo(() => buildStuckData(scopedOrders), [scopedOrders]);
  const stuckUsesMock = stuckData.some((d) => d.mock);

  // Every billing action currently sitting against this manager scope, across
  // all three Open/Close Billing buckets — same conditions Finance's own tile
  // uses (see FinanceDashboard.tsx), just scoped by the manager filter above.
  const billingDue = useMemo(() => {
    const toOpen = scopedOrders.filter((o) => getDisplayStage(o) === "toOpen");
    const toAmend = scopedOrders.filter((o) => getDisplayStage(o) === "toAmend");
    const toClose = scopedOrders.filter((o) => o.lifecycleStatus === "cancelled" && o.billingStatus === "open");
    const total = toOpen.length + toAmend.length + toClose.length;
    const amount = [...toOpen, ...toAmend, ...toClose].reduce((sum, o) => sum + o.amount, 0);
    return { toOpen: toOpen.length, toAmend: toAmend.length, toClose: toClose.length, total, amount };
  }, [scopedOrders]);

  const productMetrics = useMemo(
    () =>
      PRODUCT_NAMES.map((product) => ({
        product,
        label: product,
        revenue: liveScopedOrders.filter((o) => o.product === product).reduce((sum, o) => sum + o.amount, 0),
      })).filter((m) => m.revenue > 0),
    [liveScopedOrders]
  );

  const activeBUs = useMemo(
    () => BUSINESS_UNITS.filter((bu) => liveScopedOrders.some((o) => o.bu === bu)),
    [liveScopedOrders]
  );

  const buTrendData = useMemo(
    () =>
      fyColumns.map((col) => {
        const row: Record<string, number | string> = { month: col.label };
        activeBUs.forEach((bu) => {
          row[bu] = liveScopedOrders
            .filter((o) => o.bu === bu && billsInColumn(o, col))
            .reduce((sum, o) => sum + o.amount, 0);
        });
        return row;
      }),
    [liveScopedOrders, fyColumns, activeBUs]
  );

  const managerStats = useMemo(
    () => buildManagerStats(liveScopedOrders).sort((a, b) => b.amount - a.amount),
    [liveScopedOrders]
  );

  const updateNotifications = useMemo<NotificationItem[]>(() => {
    const orderUpdates = scopedOrders.flatMap(buildOrderNotifications).filter((n) => n.dept === "BD" && !n.rejected);
    const agreementOverEvents: NotificationItem[] = scopedOrders
      .filter((o) => getDisplayStage(o) === "agreementOver")
      .map((o) => ({
        order: o,
        dept: "BD",
        message: "Agreement period has ended — review renewal or amendment",
        date: agreementEndDate(o),
        rejected: false,
      }));
    return [...orderUpdates, ...agreementOverEvents]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 15);
  }, [scopedOrders]);

  return (
    <div className="flex flex-col gap-6">
      <DashCard title="Client Manager">
        <ClientManagerFilter
          managerOptions={managerOptions}
          selected={selectedManagers}
          onToggle={toggleManager}
          onClear={() => setSelectedManagers(new Set())}
        />
      </DashCard>

      <DashCard title="Stage Distribution">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DashCard title="Notifications">
          {updateNotifications.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No recent activity.</p>
          ) : (
            <div className="flex max-h-64 flex-col divide-y divide-slate-100 overflow-y-auto">
              {updateNotifications.map((n, i) => (
                <button
                  key={`${n.order.id}-${i}`}
                  type="button"
                  onClick={() => onNavigate("orders", "approval", { stage: getDisplayStage(n.order), q: n.order.orderNo })}
                  className={`flex items-start gap-2 border-l-4 py-2 pl-2 text-left first:pt-0 hover:bg-slate-50 ${DEPT_STYLES.BD.border}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-700">
                      <span className="font-medium text-slate-800">{n.order.orderNo}</span> — {n.message}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
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
        <DashCard title={`Where Orders Are Stuck (by revenue)${stuckUsesMock ? " (mock data)" : ""}`}>
          <StuckOrdersPie data={stuckData} />
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
    </div>
  );
}
