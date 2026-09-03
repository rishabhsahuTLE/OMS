import { useEffect, useMemo, useRef, useState } from "react";
import type { OrderDisplayStage, OrderRecord } from "../../types";
import { getDisplayStage } from "../../utils";
import {
  agreementEndDate,
  ApprovalQueueList,
  buildOrderNotifications,
  buildStuckData,
  currentStageInfo,
  DashCard,
  DEPT_STYLES,
  formatINR,
  StuckOrdersPie,
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

  const rejectedNotifications = useMemo(
    () => scopedOrders.flatMap(buildOrderNotifications).filter((n) => n.dept === "BD" && n.rejected),
    [scopedOrders]
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

  const stuckData = useMemo(() => buildStuckData(scopedOrders), [scopedOrders]);
  const stuckUsesMock = stuckData.some((d) => d.mock);

  const pipeline = useMemo(() => {
    let pending = 0;
    let active = 0;
    scopedOrders.forEach((o) => {
      const stage = getDisplayStage(o);
      if (stage === "active" || stage === "agreementOver") active += o.amount;
      else if (stage !== "closed") pending += o.amount;
    });
    return { pending, active, total: pending + active };
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

      <DashCard title="Rejected — Needs Fix">
        {rejectedNotifications.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">Nothing rejected right now.</p>
        ) : (
          <div className="flex max-h-64 flex-col divide-y divide-slate-100 overflow-y-auto">
            {rejectedNotifications.map((n, i) => (
              <div key={`${n.order.id}-${i}`} className={`flex items-center gap-2 border-l-4 py-2 pl-2 ${DEPT_STYLES.BD.border}`}>
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
        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs font-medium text-slate-500">Active</p>
            <p className="text-lg font-bold text-emerald-600">{formatINR(pipeline.active)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Pending</p>
            <p className="text-lg font-bold text-amber-600">{formatINR(pipeline.pending)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total</p>
            <p className="text-lg font-bold text-slate-800">{formatINR(pipeline.total)}</p>
          </div>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
          {(() => {
            const activePct = pipeline.total > 0 ? (pipeline.active / pipeline.total) * 100 : 0;
            return (
              <>
                <div className="h-full bg-emerald-500" style={{ width: `${activePct}%` }} />
                <div className="h-full bg-amber-500" style={{ width: `${100 - activePct}%` }} />
              </>
            );
          })()}
        </div>
      </DashCard>

      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <DashCard title="Age at Stage — Order-wise">
          <ApprovalQueueList items={ageQueue} onNavigate={onNavigate} destTab="approval" emptyMessage="Nothing in flight." />
        </DashCard>

        <DashCard title={`Where Orders Are Stuck (by revenue)${stuckUsesMock ? " (mock data)" : ""}`}>
          <StuckOrdersPie data={stuckData} />
        </DashCard>
      </div>

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
    </div>
  );
}
