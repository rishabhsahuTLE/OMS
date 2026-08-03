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
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  type PieSectorDataItem,
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

// A macOS-style sliding switch (Wi-Fi/Bluetooth toggle look) rather than two
// independently-colored buttons — one pill glides between the two slots on
// click, with the labels layered on top so it still reads as text, not a
// bare on/off. Assumes exactly two options (true for PRODUCT_NAMES today).
function ProductToggle({ value, onChange }: { value: string; onChange: (product: string) => void }) {
  const activeIndex = PRODUCT_NAMES.indexOf(value);
  return (
    <div className="relative flex w-40 shrink-0 rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
      <div
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-indigo-600 shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {PRODUCT_NAMES.map((product) => (
        <button
          key={product}
          type="button"
          onClick={() => onChange(product)}
          className={`relative z-10 flex-1 rounded-full px-3 py-1.5 text-center transition-colors duration-200 ${
            value === product ? "text-white" : "text-slate-600 hover:text-slate-800"
          }`}
        >
          {product}
        </button>
      ))}
    </div>
  );
}

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

// Tech/Fin are activation-side (reviewed from Manage Orders); TC/FC are
// cancellation-side (reviewed from Approvals) — same split the "needs
// attention" ticker below uses for its own click destinations.
const STAGE_PIE_DEST: Record<ApprovalStageKey, OrdersSubTabId> = {
  technical: "approval",
  financial: "approval",
  cancellationTechnical: "amendCancel",
  cancellationFinancial: "amendCancel",
};

// Recharts' activeShape render prop — the hovered slice draws itself slightly
// larger and grows a centered name/value readout, replacing the always-on
// text labels this chart used to render around the ring.
function renderActivePieSlice(props: PieSectorDataItem) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <text x={cx} y={(cy ?? 0) - 6} textAnchor="middle" className="fill-slate-800 text-sm font-semibold">
        {(payload as { label: string }).label}
      </text>
      <text x={cx} y={(cy ?? 0) + 14} textAnchor="middle" className="fill-slate-500 text-xs">
        {value} order{value === 1 ? "" : "s"}
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
}

interface AttentionItem {
  order: OrderRecord;
  reason: string;
  age: number;
}

// Auto-advances one tile at a time (looping), pausing ATTENTION_STEP_MS
// between steps; hovering the carousel suspends it so it's readable, and the
// arrow buttons step manually (also looping) independent of the timer.
const ATTENTION_STEP_MS = 2500;

function ChevronArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        d={direction === "left" ? "M12.5 5l-5 5 5 5" : "M7.5 5l5 5-5 5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AttentionTiles({
  items,
  onNavigate,
}: {
  items: AttentionItem[];
  onNavigate: (tab: MainTabId, subTab?: OrdersSubTabId) => void;
}) {
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      if (!pausedRef.current) setIndex((i) => (i + 1) % items.length);
    }, ATTENTION_STEP_MS);
    return () => clearInterval(id);
  }, [items.length]);

  function step(delta: number) {
    setIndex((i) => (i + delta + items.length) % items.length);
  }

  const item = items[index % items.length];

  return (
    <div
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      className="flex items-center gap-2"
    >
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Previous"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50"
      >
        <ChevronArrowIcon direction="left" />
      </button>

      <button
        type="button"
        onClick={() =>
          onNavigate("orders", item.order.lifecycleStatus === "cancellationInProgress" ? "amendCancel" : "approval")
        }
        className={`flex flex-1 flex-col gap-1.5 rounded-lg border border-slate-200 p-3 text-left shadow-sm transition-colors hover:border-indigo-300 ${
          item.order.amended ? "bg-yellow-50" : "bg-white"
        }`}
      >
        <span className="truncate text-sm font-medium text-slate-800">{item.order.orderNo}</span>
        <span className="truncate text-xs text-slate-500">{item.order.client}</span>
        <span className="text-xs text-slate-500">{item.reason}</span>
        <span className="text-xs font-semibold text-rose-600">{item.age} days</span>
      </button>

      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Next"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50"
      >
        <ChevronArrowIcon direction="right" />
      </button>
    </div>
  );
}

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

export default function Dashboard({ orders, onNavigate }: DashboardProps) {
  const [selectedProduct, setSelectedProduct] = useState(PRODUCT_NAMES[0]);
  const [selectedProjectionProduct, setSelectedProjectionProduct] = useState(PRODUCT_NAMES[0]);

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

  const selectedProductMonthly = useMemo(
    () => revenueByProduct.find((r) => r.product === selectedProduct)?.monthly ?? [],
    [revenueByProduct, selectedProduct]
  );

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

  const managerChartData = useMemo(
    () =>
      [...revenueSummaryRows]
        .sort((a, b) => b.grandTotal - a.grandTotal)
        .map((r) => ({
          manager: r.manager,
          ...Object.fromEntries(r.perProduct.map((p) => [p.product, p.total])),
        })),
    [revenueSummaryRows]
  );

  const managerProjectionChartData = useMemo(
    () =>
      revenueProjectionRows
        .map((r) => ({
          manager: r.manager,
          value: r.perProduct.find((p) => p.product === selectedProjectionProduct)?.total ?? 0,
        }))
        .sort((a, b) => b.value - a.value),
    [revenueProjectionRows, selectedProjectionProduct]
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

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-700">
            {selectedProduct} Revenue — FY {fyColumns[0].year}–{fyColumns[11].year}
          </h3>
          <ProductToggle value={selectedProduct} onChange={setSelectedProduct} />
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={selectedProductMonthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} fill={PRODUCT_COLORS[selectedProduct]}>
              {selectedProductMonthly.map((m, i) => (
                <Cell key={i} fillOpacity={m.isCurrent ? 1 : 0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Orders Stuck by Approval Stage</h3>
          {stageStuck.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Nothing pending right now.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stageStuck}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  activeShape={renderActivePieSlice}
                  onClick={(entry) => {
                    const key = (entry.payload as { key: ApprovalStageKey }).key;
                    onNavigate("orders", STAGE_PIE_DEST[key]);
                  }}
                  className="cursor-pointer"
                >
                  {stageStuck.map((s) => (
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
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Needs Immediate Attention</h3>
          {attentionItems.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">All caught up — nothing needs attention.</p>
          ) : (
            <AttentionTiles items={attentionItems} onNavigate={onNavigate} />
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Revenue by Account Manager</h3>
        <ResponsiveContainer width="100%" height={Math.max(220, managerChartData.length * 32)}>
          <BarChart data={managerChartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#e1e0d9" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#898781" }}
              axisLine={{ stroke: "#c3c2b7" }}
              tickLine={false}
              tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
            />
            <YAxis
              type="category"
              dataKey="manager"
              width={130}
              tick={{ fontSize: 11, fill: "#52514e" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="LMS" stackId="revenue" fill={PRODUCT_COLORS.LMS} />
            <Bar dataKey="Quirio" stackId="revenue" fill={PRODUCT_COLORS.Quirio} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Revenue Projection by Account Manager — FY {fyColumns[0].year}–{fyColumns[11].year}
          </h3>
          <ProductToggle value={selectedProjectionProduct} onChange={setSelectedProjectionProduct} />
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, managerProjectionChartData.length * 32)}>
          <BarChart
            data={managerProjectionChartData}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} stroke="#e1e0d9" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#898781" }}
              axisLine={{ stroke: "#c3c2b7" }}
              tickLine={false}
              tickFormatter={(v: number) => `₹${(v / 100000).toFixed(0)}L`}
            />
            <YAxis
              type="category"
              dataKey="manager"
              width={130}
              tick={{ fontSize: 11, fill: "#52514e" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={PRODUCT_COLORS[selectedProjectionProduct]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
