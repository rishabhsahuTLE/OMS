import { useMemo, useState } from "react";
import type { ApprovalState, OrderLifecycleStatus, OrderRecord } from "../../types";
import { todayISO } from "../../utils";

interface OrderApprovalProps {
  orders: OrderRecord[];
  onUpdateOrder: (record: OrderRecord) => void;
}

type ViewTab = "all" | "inactive" | "cancellationInProgress";

const VIEW_TABS: { key: ViewTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inactive", label: "Inactive" },
  { key: "cancellationInProgress", label: "Cancellation In Progress" },
];

const LIFECYCLE_LABELS: Record<OrderLifecycleStatus, string> = {
  inactive: "Inactive",
  active: "Active",
  cancellationInProgress: "Cancellation In Progress",
  cancelled: "Cancelled",
};

const LIFECYCLE_BADGE_CLASS: Record<OrderLifecycleStatus, string> = {
  inactive: "bg-slate-200 text-slate-700",
  active: "bg-emerald-100 text-emerald-700",
  cancellationInProgress: "bg-amber-100 text-amber-800",
  cancelled: "bg-rose-200 text-rose-800",
};

type StageKey = "technical" | "financial" | "cancellationTechnical" | "cancellationFinancial";

function cycleStatus(status: ApprovalState): ApprovalState {
  if (status === "pending") return "confirmed";
  if (status === "confirmed") return "rejected";
  return "pending";
}

// After any T/F/TC/FC change, check whether the order should move to the
// next lifecycle stage — inactive -> active once both activation stages are
// confirmed, cancellationInProgress -> cancelled once both cancellation
// stages are confirmed. Any other lifecycle stage is left untouched here.
function withRecomputedLifecycle(order: OrderRecord): OrderRecord {
  if (
    order.lifecycleStatus === "inactive" &&
    order.technical.status === "confirmed" &&
    order.financial.status === "confirmed"
  ) {
    return { ...order, lifecycleStatus: "active" };
  }
  if (
    order.lifecycleStatus === "cancellationInProgress" &&
    order.cancellationTechnical.status === "confirmed" &&
    order.cancellationFinancial.status === "confirmed"
  ) {
    return { ...order, lifecycleStatus: "cancelled" };
  }
  return order;
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
    </svg>
  );
}

function StageBadge({
  status,
  editable,
  onClick,
}: {
  status: ApprovalState;
  editable: boolean;
  onClick: () => void;
}) {
  const cls =
    status === "confirmed"
      ? "bg-emerald-100 text-emerald-600"
      : status === "rejected"
      ? "bg-rose-100 text-rose-600"
      : "bg-slate-200 text-slate-500";
  return (
    <button
      type="button"
      disabled={!editable}
      onClick={onClick}
      title={editable ? "Click to change" : "Not editable at this stage"}
      className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-opacity ${cls} ${
        editable ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-50"
      }`}
    >
      {status === "confirmed" ? <CheckIcon /> : status === "rejected" ? <CrossIcon /> : "P"}
    </button>
  );
}

export default function OrderApproval({ orders, onUpdateOrder }: OrderApprovalProps) {
  const [tab, setTab] = useState<ViewTab>("all");

  const filtered = useMemo(() => {
    if (tab === "inactive") return orders.filter((o) => o.lifecycleStatus === "inactive");
    if (tab === "cancellationInProgress") return orders.filter((o) => o.lifecycleStatus === "cancellationInProgress");
    return orders;
  }, [orders, tab]);

  function handleCycleStage(order: OrderRecord, stage: StageKey) {
    const nextStatus = cycleStatus(order[stage].status);
    const updated: OrderRecord = {
      ...order,
      [stage]: { status: nextStatus, date: nextStatus === "pending" ? null : todayISO() },
    };
    onUpdateOrder(withRecomputedLifecycle(updated));
  }

  function handleRequestCancellation(order: OrderRecord) {
    onUpdateOrder({ ...order, lifecycleStatus: "cancellationInProgress" });
  }

  function rowClass(order: OrderRecord) {
    if (order.lifecycleStatus === "cancelled") return "bg-rose-100 hover:bg-rose-200";
    if (order.amended) return "bg-yellow-100 hover:bg-yellow-200";
    return "hover:bg-slate-50";
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-2">
        {VIEW_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-slate-800 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">T/F:</span> activation approval, editable while Inactive
        &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">TC/FC:</span> cancellation approval, editable during
        Cancellation In Progress &nbsp;·&nbsp; Click a badge to cycle{" "}
        <span className="mx-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 align-middle text-[9px] font-semibold text-slate-500">
          P
        </span>{" "}
        →{" "}
        <span className="mx-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 align-middle text-emerald-600">
          <CheckIcon />
        </span>{" "}
        →{" "}
        <span className="mx-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 align-middle text-rose-600">
          <CrossIcon />
        </span>{" "}
        &nbsp;·&nbsp; rows highlighted{" "}
        <span className="rounded bg-rose-200 px-1.5 py-0.5 text-rose-800">red</span> are cancelled,{" "}
        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-800">yellow</span> are amended.
      </p>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                Order #
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                Client
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                Product
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                Client Manager
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600">
                Amount (₹)
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                T
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                F
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                TC
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                FC
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                Status
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((order) => (
              <tr key={order.id} className={`transition-colors ${rowClass(order)}`}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{order.orderNo}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={order.client}>
                  {order.client}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.product}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.clientManager}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {order.amount.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  <StageBadge
                    status={order.technical.status}
                    editable={order.lifecycleStatus === "inactive"}
                    onClick={() => handleCycleStage(order, "technical")}
                  />
                </td>
                <td className="px-4 py-3">
                  <StageBadge
                    status={order.financial.status}
                    editable={order.lifecycleStatus === "inactive"}
                    onClick={() => handleCycleStage(order, "financial")}
                  />
                </td>
                <td className="px-4 py-3">
                  <StageBadge
                    status={order.cancellationTechnical.status}
                    editable={order.lifecycleStatus === "cancellationInProgress"}
                    onClick={() => handleCycleStage(order, "cancellationTechnical")}
                  />
                </td>
                <td className="px-4 py-3">
                  <StageBadge
                    status={order.cancellationFinancial.status}
                    editable={order.lifecycleStatus === "cancellationInProgress"}
                    onClick={() => handleCycleStage(order, "cancellationFinancial")}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${LIFECYCLE_BADGE_CLASS[order.lifecycleStatus]}`}
                  >
                    {LIFECYCLE_LABELS[order.lifecycleStatus]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {order.lifecycleStatus === "active" && (
                    <button
                      type="button"
                      onClick={() => handleRequestCancellation(order)}
                      className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Request Cancellation
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                  No orders match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
