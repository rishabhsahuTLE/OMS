import { useMemo, useState } from "react";
import type { ApprovalState, Client, OrderLifecycleStatus, OrderRecord } from "../../types";
import OrderApprovalReview from "./OrderApprovalReview";
import CreateOrderModal from "./CreateOrderModal";

interface OrderApprovalProps {
  orders: OrderRecord[];
  onUpdateOrder: (record: OrderRecord) => void;
  // Create used to be its own tab — it now lives behind the "Create" button
  // here, rendered exactly as it was, just toggled locally instead of routed.
  clients: Client[];
  onCreateOrder: (record: OrderRecord) => void;
  createOrderPrefill: { clientId: string; product: string } | null;
  createOrderKey: number;
  onResetCreateOrder: () => void;
  onRequestAmend: (order: OrderRecord) => void;
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

function EditIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a2 2 0 01-.878.507l-3 .857a.5.5 0 01-.618-.618l.857-3a2 2 0 01.507-.878l8.5-8.5z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 5l-6 5 6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Display-only now — stage changes only happen through the review/process
// page, one at a time, in order (see OrderApprovalReview.tsx).
function StageBadge({ status }: { status: ApprovalState }) {
  const cls =
    status === "confirmed"
      ? "bg-emerald-100 text-emerald-600"
      : status === "rejected"
      ? "bg-rose-100 text-rose-600"
      : "bg-slate-200 text-slate-500";
  return (
    <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${cls}`}>
      {status === "confirmed" ? <CheckIcon /> : status === "rejected" ? <CrossIcon /> : "P"}
    </span>
  );
}

export default function OrderApproval({
  orders,
  onUpdateOrder,
  clients,
  onCreateOrder,
  createOrderPrefill,
  createOrderKey,
  onResetCreateOrder,
  onRequestAmend,
}: OrderApprovalProps) {
  const [tab, setTab] = useState<ViewTab>("all");
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (tab === "inactive") return orders.filter((o) => o.lifecycleStatus === "inactive");
    if (tab === "cancellationInProgress") return orders.filter((o) => o.lifecycleStatus === "cancellationInProgress");
    return orders;
  }, [orders, tab]);

  function rowClass(order: OrderRecord) {
    if (order.lifecycleStatus === "cancelled") return "bg-rose-100 hover:bg-rose-200";
    if (order.amended) return "bg-yellow-100 hover:bg-yellow-200";
    return "hover:bg-slate-50";
  }

  const reviewOrder = reviewOrderId ? orders.find((o) => o.id === reviewOrderId) ?? null : null;

  // Same CreateOrderModal, same embedded rendering, same props it had as its
  // own tab — only the entry point (a button here instead of a sidebar tab)
  // changed.
  if (creating) {
    return (
      <div className="flex h-full flex-col gap-4">
        <button
          onClick={() => setCreating(false)}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <BackIcon />
          Back to Manage Orders
        </button>
        <CreateOrderModal
          key={createOrderKey}
          open
          embedded
          clients={clients}
          orders={orders}
          prefillClientId={createOrderPrefill?.clientId}
          prefillProduct={createOrderPrefill?.product}
          onCreate={onCreateOrder}
          onUpdate={onUpdateOrder}
          onClose={() => {}}
          onReset={onResetCreateOrder}
          onRequestAmend={onRequestAmend}
        />
      </div>
    );
  }

  if (reviewOrder) {
    return (
      <OrderApprovalReview
        order={reviewOrder}
        orders={orders}
        onBack={() => setReviewOrderId(null)}
        onUpdateOrder={onUpdateOrder}
        onRequestCancellation={(order) => {
          onUpdateOrder({ ...order, lifecycleStatus: "cancellationInProgress" });
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
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

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <PlusIcon />
          Create
        </button>
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">Tech</span> — Technical Approval and{" "}
        <span className="font-medium text-slate-600">Fin</span> — Financial Approval decide activation;{" "}
        <span className="font-medium text-slate-600">TC</span>/<span className="font-medium text-slate-600">FC</span>{" "}
        are their cancellation-stage counterparts. Statuses are shown here for reference only — open a row's Edit
        action to process it; approvals happen strictly in order (Tech before Fin, TC before FC).
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
                Tech
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                Fin
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
                  <StageBadge status={order.technical.status} />
                </td>
                <td className="px-4 py-3">
                  <StageBadge status={order.financial.status} />
                </td>
                <td className="px-4 py-3">
                  <StageBadge status={order.cancellationTechnical.status} />
                </td>
                <td className="px-4 py-3">
                  <StageBadge status={order.cancellationFinancial.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${LIFECYCLE_BADGE_CLASS[order.lifecycleStatus]}`}
                  >
                    {LIFECYCLE_LABELS[order.lifecycleStatus]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setReviewOrderId(order.id)}
                    title="Review & process"
                    className="text-teal-600 hover:text-teal-800"
                  >
                    <EditIcon />
                  </button>
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
