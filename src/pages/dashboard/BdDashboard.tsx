import { useMemo, useState } from "react";
import type { OrderDisplayStage, OrderRecord } from "../../types";
import { getDisplayStage } from "../../utils";
import {
  ApprovalQueueList,
  buildOrderNotifications,
  currentStageInfo,
  DashCard,
  DEPT_STYLES,
  formatINR,
  type NavigateFn,
  type NotificationItem,
  type QueueItem,
} from "./shared";

interface BdDashboardProps {
  orders: OrderRecord[];
  onNavigate: NavigateFn;
}

const STAGE_ORDER: OrderDisplayStage[] = [
  "approvalPending",
  "toOpen",
  "toAmend",
  "active",
  "agreementOver",
  "closurePending",
  "closed",
];

const STAGE_LABELS: Record<OrderDisplayStage, string> = {
  approvalPending: "Approval Pending",
  toOpen: "To Open",
  toAmend: "To Amend",
  active: "Active",
  agreementOver: "Agreement Over",
  closurePending: "Cancellation Pending",
  closed: "Closed",
};

// Contracted end-of-agreement month, computed the same way isAgreementOver
// does internally (utils.ts) — used only for the Agreement Over
// notification's displayed/sorted date.
function agreementEndDate(order: OrderRecord): string {
  const { firstBillingMonth, agreement } = order.details;
  if (!firstBillingMonth || !agreement) return order.createdOn;
  const [y, m] = firstBillingMonth.split("-").map(Number);
  const endIdx = y * 12 + (m - 1) + agreement;
  const endY = Math.floor(endIdx / 12);
  const endM = (endIdx % 12) + 1;
  return `${endY}-${String(endM).padStart(2, "0")}-01`;
}

export default function BdDashboard({ orders, onNavigate }: BdDashboardProps) {
  // No login exists, so this one picker serves both a plain BD view and
  // "admin searching a specific manager" identically — default to "All."
  const [selectedManager, setSelectedManager] = useState("all");

  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  const scopedOrders = useMemo(
    () => (selectedManager === "all" ? orders : orders.filter((o) => o.clientManager === selectedManager)),
    [orders, selectedManager]
  );

  const stageDistribution = useMemo(() => {
    const counts: Record<OrderDisplayStage, number> = {
      approvalPending: 0,
      toOpen: 0,
      toAmend: 0,
      active: 0,
      agreementOver: 0,
      closurePending: 0,
      closed: 0,
    };
    scopedOrders.forEach((o) => {
      counts[getDisplayStage(o)] += 1;
    });
    return counts;
  }, [scopedOrders]);

  const ageQueue = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];
    scopedOrders.forEach((order) => {
      const info = currentStageInfo(order);
      if (info) items.push({ order, stageLabel: info.stageLabel, ageDays: info.ageDays });
    });
    return items;
  }, [scopedOrders]);

  const pipeline = useMemo(() => {
    let pending = 0;
    let active = 0;
    scopedOrders.forEach((o) => {
      const stage = getDisplayStage(o);
      if (stage === "active" || stage === "agreementOver") active += o.amount;
      else if (stage !== "closed") pending += o.amount;
    });
    return { pending, active };
  }, [scopedOrders]);

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

  const rejectedNotifications = useMemo(
    () => scopedOrders.flatMap(buildOrderNotifications).filter((n) => n.dept === "BD" && n.rejected),
    [scopedOrders]
  );

  return (
    <div className="flex flex-col gap-6">
      <DashCard title="Client Manager">
        <select
          value={selectedManager}
          onChange={(e) => setSelectedManager(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 sm:w-72"
        >
          <option value="all">All Managers</option>
          {managerOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </DashCard>

      <DashCard title="Stage Distribution">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-lg font-bold text-slate-800">{stageDistribution[stage]}</p>
              <p className="text-xs text-slate-500">{STAGE_LABELS[stage]}</p>
            </div>
          ))}
        </div>
      </DashCard>

      <DashCard title="My Pipeline">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Pending</p>
            <p className="text-xl font-bold text-amber-600">{formatINR(pipeline.pending)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-500">Active</p>
            <p className="text-xl font-bold text-emerald-600">{formatINR(pipeline.active)}</p>
          </div>
        </div>
      </DashCard>

      <DashCard title="Age at Stage — Order-wise">
        <ApprovalQueueList items={ageQueue} onNavigate={onNavigate} destTab="approval" emptyMessage="Nothing in flight." />
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

        <DashCard title="Rejected — Needs Fix">
          {rejectedNotifications.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">Nothing rejected right now.</p>
          ) : (
            <div className="flex max-h-64 flex-col divide-y divide-slate-100 overflow-y-auto">
              {rejectedNotifications.map((n, i) => (
                <div
                  key={`${n.order.id}-${i}`}
                  className={`flex items-center gap-2 border-l-4 py-2 pl-2 ${DEPT_STYLES.BD.border}`}
                >
                  <button
                    type="button"
                    onClick={() => onNavigate("orders", "approval", { stage: getDisplayStage(n.order), q: n.order.orderNo })}
                    className="min-w-0 flex-1 text-left hover:underline"
                  >
                    <span className="block truncate text-sm text-slate-700">
                      <span className="font-medium text-slate-800">{n.order.orderNo}</span> — {n.message}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("orders", "approval", { edit: n.order.id })}
                    className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </DashCard>
      </div>
    </div>
  );
}
