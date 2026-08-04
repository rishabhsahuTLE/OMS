import { useState } from "react";
import type { CancellationDetails, OrderRecord } from "../../types";
import OrderPreviewModal from "../../components/OrderPreviewModal";

interface CancellationConfirmProps {
  orders: OrderRecord[];
  // Full order list (not just this batch) — needed for the order-preview
  // modal's predecessor/successor lookups when an order in the batch is an
  // amendment successor.
  allOrders: OrderRecord[];
  onBack: () => void;
  onConfirm: (orders: OrderRecord[], details: CancellationDetails) => void;
}

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

function Required() {
  return <span className="text-rose-500">*</span>;
}

// The selected orders shown as a plain summary list (not full read-only
// details — there can be several, of different clients/products), plus the
// mandatory closure-request details collected here — applied identically to
// every order in the selection. The only place closure is ever initiated
// from, by the order's client manager (Manage Orders tab).
export default function CancellationConfirm({ orders, allOrders, onBack, onConfirm }: CancellationConfirmProps) {
  const [effectFromDate, setEffectFromDate] = useState("");
  const [outstandingBalance, setOutstandingBalance] = useState("");
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);

  const hasInactive = orders.some((o) => o.lifecycleStatus === "inactive");
  const hasActive = orders.some((o) => o.lifecycleStatus !== "inactive");

  function handleConfirm() {
    const nextErrors: Record<string, string> = {};
    if (!effectFromDate) nextErrors.effectFromDate = "Effect From Date is required";
    if (outstandingBalance.trim() === "") nextErrors.outstandingBalance = "Outstanding Balance is required";
    if (!reason.trim()) nextErrors.reason = "Reason for Cancellation is required";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onConfirm(orders, {
      effectFromDate,
      outstandingBalance: Number(outstandingBalance),
      reason,
      comments,
    });
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 5l-6 5 6 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h2 className="text-sm font-semibold tracking-wide text-slate-700">
          Cancel {orders.length} Order{orders.length > 1 ? "s" : ""}
        </h2>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-700">SELECTED ORDERS</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Order #</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Client</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Product</th>
                <th className="px-4 py-2 text-right font-medium text-slate-600">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => setPreviewOrderId(o.id)}
                      className="text-indigo-700 hover:underline"
                    >
                      {o.orderNo}
                    </button>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2 text-slate-700" title={o.client}>
                    {o.client}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{o.product}</td>
                  <td className="px-4 py-2 text-right text-slate-700">{o.amount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-700">
            CANCELLATION REQUEST <span className="ml-1 text-xs font-normal text-slate-400">(applied to every order above)</span>
          </h3>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="grid grid-cols-[200px_1fr] items-center gap-x-4">
            <label className="text-right text-sm font-medium text-slate-700">
              Effect From Date<Required />
            </label>
            <div className="max-w-lg">
              <input
                type="date"
                className={inputClass}
                value={effectFromDate}
                onChange={(e) => setEffectFromDate(e.target.value)}
              />
              {errors.effectFromDate && <p className="mt-1 text-xs text-rose-500">{errors.effectFromDate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-[200px_1fr] items-center gap-x-4">
            <label className="text-right text-sm font-medium text-slate-700">
              Outstanding Balance (₹)<Required />
            </label>
            <div className="max-w-lg">
              <input
                type="number"
                className={inputClass}
                value={outstandingBalance}
                onChange={(e) => setOutstandingBalance(e.target.value)}
              />
              {errors.outstandingBalance && <p className="mt-1 text-xs text-rose-500">{errors.outstandingBalance}</p>}
            </div>
          </div>

          <div className="grid grid-cols-[200px_1fr] items-center gap-x-4">
            <label className="text-right text-sm font-medium text-slate-700">
              Reason for Cancellation<Required />
            </label>
            <div className="max-w-lg">
              <input
                type="text"
                className={inputClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              {errors.reason && <p className="mt-1 text-xs text-rose-500">{errors.reason}</p>}
            </div>
          </div>

          <div className="grid grid-cols-[200px_1fr] items-start gap-x-4">
            <label className="pt-2 text-right text-sm font-medium text-slate-700">Comments</label>
            <textarea
              className={`${inputClass} min-h-[70px] max-w-lg resize-y`}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <p className="text-sm text-slate-500">
          {hasInactive && hasActive
            ? "Orders here that haven't been activated yet will move straight to Cancelled; Active/Agreement Over ones will move into a cancellation-pending status, awaiting TC/FC approval."
            : hasInactive
            ? "These orders haven't been activated yet, so cancelling them moves them straight to Cancelled — no Tech/Fin cancellation approval needed."
            : "Cancelling these orders moves them into a cancellation-pending status, awaiting TC/FC approval."}
        </p>
        <div className="flex shrink-0 gap-3">
          <button onClick={onBack} className="rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
            Back
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-md border border-rose-300 px-5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            Confirm Cancellation
          </button>
        </div>
      </div>

      <OrderPreviewModal
        order={previewOrderId ? allOrders.find((o) => o.id === previewOrderId) ?? null : null}
        orders={allOrders}
        onClose={() => setPreviewOrderId(null)}
      />
    </div>
  );
}
