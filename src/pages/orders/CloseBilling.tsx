import { useMemo, useState } from "react";
import type { BillingStatus, OrderRecord } from "../../types";
import { usePagination } from "../../utils";
import ConfirmDialog from "../../components/ConfirmDialog";
import PaginationFooter from "../../components/PaginationFooter";
import OrderPreviewModal from "../../components/OrderPreviewModal";

interface CloseBillingProps {
  orders: OrderRecord[];
  onUpdateOrder: (record: OrderRecord) => void;
}

type BillingViewTab = "toOpen" | "toClose" | "closed";

const VIEW_TABS: { key: BillingViewTab; label: string }[] = [
  { key: "toOpen", label: "To Open" },
  { key: "toClose", label: "To Close" },
  { key: "closed", label: "Closed" },
];

// Finance-owned billing closure, entirely separate from the Tech/Fin/TC/FC
// approval chain: an activated order's billing has to be explicitly Opened
// before it runs, and a cancelled order's billing has to be explicitly
// Closed once cancellation finishes — this tab is where both happen, plus a
// "Closed" bucket to catch and reverse mistakes.
function toOpenFilter(o: OrderRecord): boolean {
  return o.lifecycleStatus === "active" && o.billingStatus === "notOpened";
}
function toCloseFilter(o: OrderRecord): boolean {
  return o.lifecycleStatus === "cancelled" && o.billingStatus === "open";
}
function closedFilter(o: OrderRecord): boolean {
  return o.billingStatus === "closed";
}

const TAB_FILTERS: Record<BillingViewTab, (o: OrderRecord) => boolean> = {
  toOpen: toOpenFilter,
  toClose: toCloseFilter,
  closed: closedFilter,
};

const BILLING_BADGE_LABEL: Record<BillingStatus, string> = {
  notOpened: "Not Opened",
  open: "Open",
  closed: "Closed",
};

const BILLING_BADGE_CLASS: Record<BillingStatus, string> = {
  notOpened: "bg-slate-200 text-slate-600",
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-rose-200 text-rose-800",
};

function BillingStatusBadge({ status }: { status: BillingStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${BILLING_BADGE_CLASS[status]}`}>
      {BILLING_BADGE_LABEL[status]}
    </span>
  );
}

function rowClass(order: OrderRecord) {
  if (order.lifecycleStatus === "cancelled") return "bg-rose-100 hover:bg-rose-200";
  if (order.amended) return "bg-yellow-100 hover:bg-yellow-200";
  return "hover:bg-slate-50";
}

interface PendingAction {
  order: OrderRecord;
  kind: "open" | "close" | "reopen";
}

const ACTION_LABEL: Record<PendingAction["kind"], string> = {
  open: "Open Billing",
  close: "Close Billing",
  reopen: "Reopen",
};

const ACTION_NEXT_STATUS: Record<PendingAction["kind"], BillingStatus> = {
  open: "open",
  close: "closed",
  reopen: "open",
};

export default function CloseBilling({ orders, onUpdateOrder }: CloseBillingProps) {
  const [tab, setTab] = useState<BillingViewTab>("toOpen");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const byTab = orders.filter(TAB_FILTERS[tab]);
    const q = search.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter(
      (o) => o.client.toLowerCase().includes(q) || o.orderNo.toLowerCase().includes(q) || o.clientManager.toLowerCase().includes(q)
    );
  }, [orders, tab, search]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageRows, totalRecords } = usePagination(filtered);

  function actionFor(): PendingAction["kind"] {
    return tab === "toOpen" ? "open" : tab === "toClose" ? "close" : "reopen";
  }

  function confirmMessage(action: PendingAction): string {
    if (action.kind === "open") return `Open billing for ${action.order.orderNo}? Its billing status will move to Open.`;
    if (action.kind === "close")
      return `Close billing for ${action.order.orderNo}? Its billing status will move to Closed.`;
    return `Reopen billing for ${action.order.orderNo}? This does not affect its cancellation status — it will move back to "To Close".`;
  }

  function handleConfirm() {
    if (!pending) return;
    onUpdateOrder({ ...pending.order, billingStatus: ACTION_NEXT_STATUS[pending.kind] });
    setPending(null);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 gap-2">
          {VIEW_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-64 shrink-0">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.6 4.2l3.6 3.6a1 1 0 01-1.4 1.4l-3.6-3.6A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, order #, or manager…"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">To Open</span> — activated orders whose billing hasn't started
        yet. <span className="font-medium text-slate-600">To Close</span> — cancelled orders (both TC and FC
        confirmed) still awaiting billing closure. <span className="font-medium text-slate-600">Closed</span> —
        billing already closed; reopening one sends it back to "To Close" without affecting its cancellation status.
      </p>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Order #
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Client
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Product
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Client Manager
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-right font-semibold text-slate-600">
                  Amount (₹)
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Billing Status
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((order) => {
                const kind = actionFor();
                return (
                  <tr key={order.id} className={`transition-colors ${rowClass(order)}`}>
                    <td className="whitespace-nowrap px-4 py-2 font-medium">
                      <button
                        type="button"
                        onClick={() => setPreviewOrderId(order.id)}
                        className="text-indigo-700 hover:underline"
                      >
                        {order.orderNo}
                      </button>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-slate-700" title={order.client}>
                      {order.client}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-700">{order.product}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-700">{order.clientManager}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right text-slate-700">
                      {order.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <BillingStatusBadge status={order.billingStatus} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setPending({ order, kind })}
                        className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        {ACTION_LABEL[kind]}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No orders in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationFooter
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          totalRecords={totalRecords}
        />
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? ACTION_LABEL[pending.kind] : ""}
        message={pending ? confirmMessage(pending) : ""}
        confirmLabel={pending ? ACTION_LABEL[pending.kind] : ""}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />

      <OrderPreviewModal
        order={previewOrderId ? orders.find((o) => o.id === previewOrderId) ?? null : null}
        orders={orders}
        onClose={() => setPreviewOrderId(null)}
      />
    </div>
  );
}
