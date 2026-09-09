import { useMemo, useState } from "react";
import type { OrderDisplayStage, OrderRecord, OrdersSubTabId } from "../../types";
import { CURRENT_USER_EMAIL, daysBetween, deriveCreatedByName, getDisplayStage, getNextActionableStage, todayISO } from "../../utils";
import {
  ApprovalQueueList,
  buildOrderNotifications,
  DashCard,
  formatINR,
  NotificationTile,
  STAGE_ANCHOR,
  STAGE_DEPT,
  type NavigateFn,
  type QueueItem,
} from "./shared";

interface TechDashboardProps {
  orders: OrderRecord[];
  onNavigate: NavigateFn;
}

// The one identity the whole app has — see utils.ts's CURRENT_USER_EMAIL.
// "Self" throughout this page means actions attributed to this name via
// StageStatus.processedBy; "Others" is every other processedBy value (the
// three simulated reviewers seeded in mock data).
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

export default function TechDashboard({ orders, onNavigate }: TechDashboardProps) {
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

  // Orders genuinely waiting on Tech right now — a rejected Tech/TC stage is
  // BD's to fix and resubmit, not Tech's to re-decide, so it's excluded here
  // (it shows up instead in BD's own "rejected" notifications).
  const queue = useMemo<QueueItem[]>(() => {
    const today = todayISO();
    const items: QueueItem[] = [];
    orders.forEach((order) => {
      if (order.lifecycleStatus === "cancelled") return;
      const actionable = getNextActionableStage(order);
      if (!actionable || STAGE_DEPT[actionable.key] !== "Tech") return;
      if (order[actionable.key].status !== "pending") return;
      items.push({
        order,
        stageLabel: `${actionable.label} approval pending`,
        ageDays: daysBetween(STAGE_ANCHOR[actionable.key](order), today),
      });
    });
    return items;
  }, [orders]);

  // Average days-to-decision across every decided (confirmed or rejected)
  // Tech/Cancellation-Tech stage, split by who actually processed it.
  const clearanceStats = useMemo(() => {
    const pairs: { start: string; end: string; self: boolean }[] = [];
    orders.forEach((order) => {
      if (order.technical.date) {
        pairs.push({
          start: order.createdOn,
          end: order.technical.date,
          self: order.technical.processedBy === SELF_NAME,
        });
      }
      if (order.cancellationDetails && order.cancellationTechnical.date) {
        pairs.push({
          start: order.cancellationDetails.effectFromDate,
          end: order.cancellationTechnical.date,
          self: order.cancellationTechnical.processedBy === SELF_NAME,
        });
      }
    });
    const avg = (rows: typeof pairs) =>
      rows.length === 0 ? 0 : rows.reduce((sum, p) => sum + daysBetween(p.start, p.end), 0) / rows.length;
    const self = pairs.filter((p) => p.self);
    const others = pairs.filter((p) => !p.self);
    return { selfAvg: avg(self), selfN: self.length, othersAvg: avg(others), othersN: others.length };
  }, [orders]);

  // "New comment on an order I approved" would need a comment thread this
  // app doesn't have — this reuses only what already exists: new orders and
  // cancellations landing in Tech's queue.
  const notifications = useMemo(
    () =>
      orders
        .flatMap(buildOrderNotifications)
        .filter((n) => n.dept === "Tech")
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .slice(0, 15),
    [orders]
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

      <DashCard title="Approval Queue">
        <ApprovalQueueList
          items={queue}
          onNavigate={onNavigate}
          destTab="amendCancel"
          emptyMessage="Nothing waiting on Tech right now."
        />
      </DashCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <DashCard title="Notifications">
          {notifications.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No recent activity.</p>
          ) : (
            <NotificationTile items={notifications} onNavigate={onNavigate} />
          )}
        </DashCard>
      </div>
    </div>
  );
}
