import { useState } from "react";
import type { OrderRecord } from "../../types";
import OrderPreviewModal from "../../components/OrderPreviewModal";

interface BillingActionConfirmProps {
  orders: OrderRecord[];
  allOrders: OrderRecord[];
  actionLabel: string;
  description: string;
  onBack: () => void;
  onConfirm: (orders: OrderRecord[]) => void;
}

// Same page-swap pattern as CancellationConfirm.tsx (Back button + header +
// a plain "SELECTED ORDERS" summary table + a confirm section) — reused here
// for the Close Billing tab's batch actions. Unlike cancellation initiation,
// a billing status flip has no mandatory fields to collect, so the
// confirmation section is just an explanatory sentence plus Back/Confirm.
export default function BillingActionConfirm({
  orders,
  allOrders,
  actionLabel,
  description,
  onBack,
  onConfirm,
}: BillingActionConfirmProps) {
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);

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
          {actionLabel} — {orders.length} Order{orders.length > 1 ? "s" : ""}
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

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <p className="text-sm text-slate-500">{description}</p>
        <div className="flex shrink-0 gap-3">
          <button onClick={onBack} className="rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
            Back
          </button>
          <button
            onClick={() => onConfirm(orders)}
            className="rounded-md border border-indigo-300 px-5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Confirm {actionLabel}
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
