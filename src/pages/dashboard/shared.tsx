import { useMemo, useState, type ReactNode } from "react";
import type { MainTabId, OrderRecord, OrdersSubTabId, ReportSubTabId } from "../../types";
import {
  daysBetween,
  getDisplayStage,
  getNextActionableStage,
  todayISO,
  type ApprovalStageKey,
} from "../../utils";

export type NavigateFn = (
  tab: MainTabId,
  subTab?: ReportSubTabId | OrdersSubTabId,
  params?: Record<string, string>
) => void;

export function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

// The plain card shell every tile on every role dashboard uses — pulled out
// once these four pages started repeating it dozens of times each.
export function DashCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// Who a notification is for — BD submits, Tech decides first, then Finance;
// a rejection at either stage always bounces back to BD, an approval always
// hands off to whoever acts next. Same pattern for the cancellation pair
// (BD initiates closure -> Tech -> Finance). There's still no real
// login/role system — each role dashboard just filters this down to its own
// department by construction (it only ever asks for its own dept's items),
// rather than a viewer picking a "My View" out of everything.
export type NotificationDept = "BD" | "Tech" | "Finance";

export const DEPT_STYLES: Record<NotificationDept, { border: string; text: string }> = {
  BD: { border: "border-indigo-400", text: "text-indigo-600" },
  Tech: { border: "border-amber-400", text: "text-amber-600" },
  Finance: { border: "border-emerald-400", text: "text-emerald-600" },
};

// Which department owns a given approval stage.
export const STAGE_DEPT: Record<ApprovalStageKey, NotificationDept> = {
  technical: "Tech",
  financial: "Finance",
  cancellationTechnical: "Tech",
  cancellationFinancial: "Finance",
};

// The date an order actually entered its current actionable stage — used
// consistently everywhere "age at stage" or turnaround time is computed.
export const STAGE_ANCHOR: Record<ApprovalStageKey, (o: OrderRecord) => string> = {
  technical: (o) => o.createdOn,
  financial: (o) => o.technical.date ?? o.createdOn,
  cancellationTechnical: (o) => o.cancellationDetails?.effectFromDate ?? o.createdOn,
  cancellationFinancial: (o) => o.cancellationTechnical.date ?? o.createdOn,
};

export interface NotificationItem {
  order: OrderRecord;
  dept: NotificationDept;
  message: string;
  date: string;
  // Structural rejection flag — lets a consumer (e.g. BD's rejected-orders
  // list) filter for rejections without string-matching `message`.
  rejected: boolean;
}

// A chronological log of what already happened on an order — every stage
// leaving "pending" is one event. There's no real notification backend, so
// this is derived entirely from the StageStatus dates already on every
// order (skips anything still "pending", since only confirmed/rejected
// stages carry an actual event date).
export function buildOrderNotifications(order: OrderRecord): NotificationItem[] {
  const events: NotificationItem[] = [
    { order, dept: "Tech", message: "Order submitted — awaiting Technical review", date: order.createdOn, rejected: false },
  ];

  if (order.technical.status === "confirmed") {
    events.push({
      order,
      dept: "Finance",
      message: "Technical approved — ready for Financial review",
      date: order.technical.date as string,
      rejected: false,
    });
  } else if (order.technical.status === "rejected") {
    events.push({ order, dept: "BD", message: "Technical rejected", date: order.technical.date as string, rejected: true });
  }

  if (order.financial.status === "confirmed") {
    events.push({
      order,
      dept: "BD",
      message: "Financial approved — order is now Active",
      date: order.financial.date as string,
      rejected: false,
    });
  } else if (order.financial.status === "rejected") {
    events.push({ order, dept: "BD", message: "Financial rejected", date: order.financial.date as string, rejected: true });
  }

  if (order.cancellationDetails) {
    events.push({
      order,
      dept: "Tech",
      message: "Closure initiated — awaiting Cancellation-Technical review",
      date: order.cancellationDetails.effectFromDate,
      rejected: false,
    });
  }

  if (order.cancellationTechnical.status === "confirmed") {
    events.push({
      order,
      dept: "Finance",
      message: "Cancellation-Technical approved — ready for Cancellation-Financial review",
      date: order.cancellationTechnical.date as string,
      rejected: false,
    });
  } else if (order.cancellationTechnical.status === "rejected") {
    events.push({
      order,
      dept: "BD",
      message: "Cancellation-Technical rejected",
      date: order.cancellationTechnical.date as string,
      rejected: true,
    });
  }

  if (order.cancellationFinancial.status === "confirmed") {
    events.push({
      order,
      dept: "BD",
      message: "Cancellation-Financial approved — order is now Closed",
      date: order.cancellationFinancial.date as string,
      rejected: false,
    });
  } else if (order.cancellationFinancial.status === "rejected") {
    events.push({
      order,
      dept: "BD",
      message: "Cancellation-Financial rejected",
      date: order.cancellationFinancial.date as string,
      rejected: true,
    });
  }

  return events;
}

export function NotificationTile({ items, onNavigate }: { items: NotificationItem[]; onNavigate: NavigateFn }) {
  const today = todayISO();
  return (
    <div className="flex max-h-64 flex-col divide-y divide-slate-100 overflow-y-auto">
      {items.map((n, i) => (
        <button
          key={`${n.order.id}-${i}`}
          type="button"
          onClick={() =>
            onNavigate("orders", n.dept === "BD" ? "approval" : "amendCancel", {
              stage: getDisplayStage(n.order),
              q: n.order.orderNo,
            })
          }
          className={`flex items-start gap-2 border-l-4 py-2 pl-2 text-left first:pt-0 hover:bg-slate-50 ${DEPT_STYLES[n.dept].border}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-slate-700">
              <span className="font-medium text-slate-800">{n.order.orderNo}</span> — {n.message}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              {daysBetween(n.date, today)}d ago
              <span className={`font-semibold ${DEPT_STYLES[n.dept].text}`}>({n.dept})</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

// A small pill flagging an amendment successor inline in a list row, before
// the row is even opened — keyed off the same `amended` flag every table's
// yellow-row highlight already uses house-wide.
export function AmendmentBadge({ order }: { order: OrderRecord }) {
  if (!order.amended) return null;
  return (
    <span className="ml-1.5 inline-flex shrink-0 items-center rounded-full bg-yellow-200 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800">
      Amendment
    </span>
  );
}

export interface QueueItem {
  order: OrderRecord;
  stageLabel: string;
  ageDays: number;
}

// A ranked "whose turn is it" list — oldest at its current stage first by
// default, with a toggle to flip to newest-first. Shared by Tech's and
// Finance's approver queues, and by BD's age-at-stage table.
export function ApprovalQueueList({
  items,
  onNavigate,
  destTab,
  emptyMessage = "Nothing outstanding right now.",
}: {
  items: QueueItem[];
  onNavigate: NavigateFn;
  destTab: OrdersSubTabId;
  emptyMessage?: string;
}) {
  const [sortDir, setSortDir] = useState<"oldest" | "newest">("oldest");
  const sorted = useMemo(
    () => [...items].sort((a, b) => (sortDir === "oldest" ? b.ageDays - a.ageDays : a.ageDays - b.ageDays)),
    [items, sortDir]
  );

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "oldest" ? "newest" : "oldest"))}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          {sortDir === "oldest" ? "Oldest first" : "Newest first"} — switch
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="flex max-h-72 flex-col divide-y divide-slate-100 overflow-y-auto">
          {sorted.map((it) => (
            <button
              key={it.order.id}
              type="button"
              onClick={() => onNavigate("orders", destTab, { stage: getDisplayStage(it.order), q: it.order.orderNo })}
              className="flex items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center text-sm font-medium text-slate-800">
                  {it.order.orderNo}
                  <AmendmentBadge order={it.order} />
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {it.order.client} — {it.order.product} — {it.stageLabel}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-slate-500">{it.ageDays}d</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Contracted end-of-agreement month, computed the same way isAgreementOver
// does internally (utils.ts) — used for the Agreement Over notification's
// displayed/sorted date wherever it's synthesized.
export function agreementEndDate(order: OrderRecord): string {
  const { firstBillingMonth, agreement } = order.details;
  if (!firstBillingMonth || !agreement) return order.createdOn;
  const [y, m] = firstBillingMonth.split("-").map(Number);
  const endIdx = y * 12 + (m - 1) + agreement;
  const endY = Math.floor(endIdx / 12);
  const endM = (endIdx % 12) + 1;
  return `${endY}-${String(endM).padStart(2, "0")}-01`;
}

// Where a given order sits right now, in plain terms, plus how long it's
// been waiting there — null once it's past waiting on anyone (Active,
// Agreement Over, Closed). Used by BD's "age at stage" table, which (unlike
// Tech's/Finance's own queues) needs to cover every stage, not just one
// department's.
export function currentStageInfo(order: OrderRecord): { stageLabel: string; ageDays: number } | null {
  if (order.lifecycleStatus === "cancelled") return null;
  const today = todayISO();
  const actionable = getNextActionableStage(order);
  if (actionable) {
    const rejected = order[actionable.key].status === "rejected";
    return {
      stageLabel: rejected ? `${actionable.label} rejected` : `${actionable.label} approval pending`,
      ageDays: daysBetween(STAGE_ANCHOR[actionable.key](order), today),
    };
  }
  const stage = getDisplayStage(order);
  if (stage === "toOpen" || stage === "toAmend") {
    return {
      stageLabel: stage === "toAmend" ? "Awaiting Finance to complete amendment" : "Awaiting Finance to open billing",
      ageDays: daysBetween(order.financial.date ?? order.createdOn, today),
    };
  }
  return null;
}
