import type { OrderRecord } from "../../types";
import OrderDetailsReadOnly from "./OrderDetailsReadOnly";

interface CancellationConfirmProps {
  order: OrderRecord;
  onBack: () => void;
  onConfirm: (order: OrderRecord) => void;
}

// The whole order shown strictly for reference (nothing editable) with a
// single decision at the bottom: confirm cancellation, or back out.
export default function CancellationConfirm({ order, onBack, onConfirm }: CancellationConfirmProps) {
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

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <p className="text-sm text-slate-500">
          Initiating cancellation moves this order into Cancellation In Progress, where it awaits TC/FC approval.
        </p>
        <div className="flex shrink-0 gap-3">
          <button onClick={onBack} className="rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(order)}
            className="rounded-md border border-rose-300 px-5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            Cancellation Initiation
          </button>
        </div>
      </div>
    </div>
  );
}
