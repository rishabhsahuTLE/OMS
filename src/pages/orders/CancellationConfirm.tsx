import { useState } from "react";
import type { CancellationDetails, OrderRecord } from "../../types";
import OrderDetailsReadOnly from "./OrderDetailsReadOnly";

interface CancellationConfirmProps {
  order: OrderRecord;
  onBack: () => void;
  onConfirm: (order: OrderRecord, details: CancellationDetails) => void;
}

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

function Required() {
  return <span className="text-rose-500">*</span>;
}

// The whole order shown strictly for reference (nothing editable), plus the
// mandatory cancellation-request details collected here — the only place
// cancellation is ever actually initiated from (both Amend/Cancel's
// "Initiate Cancellation" and the review page's "Request Cancellation"
// route through this same form).
export default function CancellationConfirm({ order, onBack, onConfirm }: CancellationConfirmProps) {
  const [effectFromDate, setEffectFromDate] = useState("");
  const [outstandingBalance, setOutstandingBalance] = useState("");
  const [reason, setReason] = useState("");
  const [comments, setComments] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleConfirm() {
    const nextErrors: Record<string, string> = {};
    if (!effectFromDate) nextErrors.effectFromDate = "Effect From Date is required";
    if (outstandingBalance.trim() === "") nextErrors.outstandingBalance = "Outstanding Balance is required";
    if (!reason.trim()) nextErrors.reason = "Reason for Cancellation is required";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onConfirm(order, {
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
          {order.orderNo} &nbsp;·&nbsp; {order.client}
        </h2>
      </div>

      <OrderDetailsReadOnly order={order} />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-700">CANCELLATION REQUEST</h3>
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
          Initiating cancellation moves this order into Cancellation In Progress, where it awaits TC/FC approval.
        </p>
        <div className="flex shrink-0 gap-3">
          <button onClick={onBack} className="rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-md border border-rose-300 px-5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            Cancellation Initiation
          </button>
        </div>
      </div>
    </div>
  );
}
