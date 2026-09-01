import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { OrderDisplayStage, OrderRecord, OrdersSubTabId } from "../../types";
import { buildFiscalYearColumns, daysBetween, getDisplayStage } from "../../utils";
import BdDashboard from "./BdDashboard";
import FinanceDashboard from "./FinanceDashboard";
import { DashCard, formatINR, type NavigateFn } from "./shared";
import TechDashboard from "./TechDashboard";

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

interface TatStageDef {
  key: string;
  label: string;
  color: string;
  pairs: (orders: OrderRecord[]) => { end: string; days: number }[];
}

const TAT_STAGES: TatStageDef[] = [
  {
    key: "technical",
    label: "Tech",
    color: "#e87ba4",
    pairs: (orders) =>
      orders.filter((o) => o.technical.date).map((o) => ({ end: o.technical.date as string, days: daysBetween(o.createdOn, o.technical.date as string) })),
  },
  {
    key: "financial",
    label: "Fin",
    color: "#008300",
    pairs: (orders) =>
      orders
        .filter((o) => o.technical.date && o.financial.date)
        .map((o) => ({ end: o.financial.date as string, days: daysBetween(o.technical.date as string, o.financial.date as string) })),
  },
  {
    key: "cancellationTechnical",
    label: "TC",
    color: "#4a3aa7",
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
    color: "#e34948",
    pairs: (orders) =>
      orders
        .filter((o) => o.cancellationTechnical.date && o.cancellationFinancial.date)
        .map((o) => ({
          end: o.cancellationFinancial.date as string,
          days: daysBetween(o.cancellationTechnical.date as string, o.cancellationFinancial.date as string),
        })),
  },
];

function monthKeyOf(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return y * 12 + (m - 1);
}

export default function AdminDashboard({ orders, onNavigate }: AdminDashboardProps) {
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
    orders.forEach((o) => {
      const stage = getDisplayStage(o);
      stats[stage].count += 1;
      stats[stage].revenue += o.amount;
      stats.all.count += 1;
      stats.all.revenue += o.amount;
    });
    return stats;
  }, [orders]);

  const fyColumns = useMemo(() => buildFiscalYearColumns(new Date()), []);

  // Every stage's average turnaround, bucketed by the month the decision
  // landed in — a monthly trend to compare against, not just one all-time
  // average per stage. A month with no decided orders for a stage is left
  // `null` (not 0) so the line skips/connects across the gap instead of
  // falsely dipping to "0-day turnaround."
  const tatTrend = useMemo(() => {
    const stagePairs = TAT_STAGES.map((stage) => ({ key: stage.key, pairs: stage.pairs(orders) }));
    return fyColumns.map((col) => {
      const colKey = col.year * 12 + col.month0;
      const row: Record<string, number | string | null> = { month: col.label };
      stagePairs.forEach(({ key, pairs }) => {
        const inMonth = pairs.filter((p) => monthKeyOf(p.end) === colKey);
        row[key] = inMonth.length > 0 ? inMonth.reduce((sum, p) => sum + p.days, 0) / inMonth.length : null;
      });
      return row;
    });
  }, [orders, fyColumns]);

  return (
    <div className="flex flex-col gap-6">
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

      <DashCard title={`Avg Turnaround by Stage — Monthly, FY ${fyColumns[0].year}–${fyColumns[11].year}`}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={tatTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e1e0d9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#898781" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(1)}d`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {TAT_STAGES.map((stage) => (
              <Line
                key={stage.key}
                type="monotone"
                dataKey={stage.key}
                name={stage.label}
                stroke={stage.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </DashCard>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-6">
        <h2 className="text-base font-semibold text-slate-800">Tech</h2>
        <TechDashboard orders={orders} onNavigate={onNavigate} />
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-6">
        <h2 className="text-base font-semibold text-slate-800">Finance</h2>
        <FinanceDashboard orders={orders} onNavigate={onNavigate} />
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-6">
        <h2 className="text-base font-semibold text-slate-800">BD / Client Manager</h2>
        <BdDashboard orders={orders} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
