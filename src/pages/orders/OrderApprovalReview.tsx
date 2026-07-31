import { useState } from "react";
import type { ApprovalState, OrderRecord } from "../../types";
import {
  CURRENT_USER_EMAIL,
  deriveCreatedByName,
  diffOrderDetails,
  formatDDMMYYYY,
  getNextActionableStage,
  todayISO,
  withRecomputedLifecycle,
  type ApprovalStageKey,
} from "../../utils";
import OrderDetailsReadOnly from "./OrderDetailsReadOnly";

interface OrderApprovalReviewProps {
  order: OrderRecord;
  orders: OrderRecord[];
  onBack: () => void;
  onUpdateOrder: (record: OrderRecord) => void;
}

const readonlyClass = "w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600";

function historyRows(order: OrderRecord) {
  return [
    { label: "Tech", stage: order.technical },
    { label: "Fin", stage: order.financial },
    { label: "TC", stage: order.cancellationTechnical },
    { label: "FC", stage: order.cancellationFinancial },
  ];
}

function historyStatusLabel(status: ApprovalState) {
  if (status === "confirmed") return "Accepted";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

const STAGE_LABELS: Record<ApprovalStageKey, string> = {
  technical: "Tech",
  financial: "Fin",
  cancellationTechnical: "TC",
  cancellationFinancial: "FC",
};

export default function OrderApprovalReview({ order, orders, onBack, onUpdateOrder }: OrderApprovalReviewProps) {
  const [status, setStatus] = useState("");
  const [agreementAmountInput, setAgreementAmountInput] = useState("");
  const [firstBillingMonth, setFirstBillingMonth] = useState(order.details.firstBillingMonth);
  const [remark, setRemark] = useState("");

  const actionable = getNextActionableStage(order);
  const predecessor = order.supersedes ? orders.find((o) => o.id === order.supersedes) ?? null : null;
  const changes = predecessor ? diffOrderDetails(predecessor, order) : [];
  const agreementMatches = agreementAmountInput.trim() !== "" && Number(agreementAmountInput) === order.amount;
  const canSubmit = actionable !== null && status !== "" && agreementMatches;

  function handleSubmit() {
    if (!actionable || !canSubmit) return;
    const stageUpdate = {
      status: (status === "Approved" ? "confirmed" : "rejected") as ApprovalState,
      date: todayISO(),
      processedBy: deriveCreatedByName(CURRENT_USER_EMAIL),
      remark,
    };
    const updated: OrderRecord = withRecomputedLifecycle({
      ...order,
      [actionable.key]: stageUpdate,
      details: { ...order.details, firstBillingMonth },
    });
    onUpdateOrder(updated);
    onBack();
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 5l-6 5 6 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Approval
        </button>
        <h2 className="text-sm font-semibold tracking-wide text-slate-700">
          {order.orderNo} &nbsp;·&nbsp; {order.client}
        </h2>
      </div>

      <OrderDetailsReadOnly order={order} />

      {predecessor && (
        <div className="rounded-lg border border-amber-200 bg-white shadow-sm">
          <div className="border-b border-amber-200 px-6 py-3">
            <h3 className="text-sm font-semibold tracking-wide text-slate-700">
              CHANGES FROM {predecessor.orderNo}
            </h3>
          </div>
          {changes.length === 0 ? (
            <p className="px-6 py-4 text-sm text-slate-400">No fields differ from the previous version.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Field</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Previously</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {changes.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2 font-medium text-slate-800">{row.label}</td>
                      <td className="px-4 py-2 text-rose-600 line-through">{row.before}</td>
                      <td className="px-4 py-2 text-emerald-700">{row.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-700">APPROVAL HISTORY</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Type</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Status</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Processed By</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Processed On</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyRows(order).map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2 font-medium text-slate-800">{row.label}</td>
                  <td className="px-4 py-2 text-slate-700">{historyStatusLabel(row.stage.status)}</td>
                  <td className="px-4 py-2 text-slate-700">{row.stage.processedBy || "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{row.stage.date ? formatDDMMYYYY(row.stage.date) : "—"}</td>
                  <td className="px-4 py-2 text-slate-700">{row.stage.remark || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-3">
          <h3 className="text-sm font-semibold tracking-wide text-slate-700">PROCESS ORDER</h3>
        </div>

        {order.lifecycleStatus === "active" ? (
          <p className="px-6 py-6 text-sm text-slate-500">
            Tech and Fin are both cleared — this order is Active. Closure can only be initiated from the Manage
            Orders tab, by the order's client manager.
          </p>
        ) : !actionable ? (
          <p className="px-6 py-6 text-sm text-slate-400">
            No further action needed — every approval stage for this order is complete.
          </p>
        ) : (
          <div className="space-y-4 px-6 py-6">
            <div className="grid grid-cols-[200px_1fr] items-center gap-x-4">
              <label className="text-right text-sm font-medium text-slate-700">Approval Type</label>
              <input className={`${readonlyClass} max-w-lg`} value={STAGE_LABELS[actionable.key]} disabled />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-x-4">
              <label className="text-right text-sm font-medium text-slate-700">
                Status<span className="text-rose-500">*</span>
              </label>
              <select
                className="w-full max-w-lg rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">--Select Status--</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-x-4">
              <label className="text-right text-sm font-medium text-slate-700">
                Agreement Amount (₹)<span className="text-rose-500">*</span>
              </label>
              <div className="max-w-lg">
                <input
                  type="number"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  value={agreementAmountInput}
                  onChange={(e) => setAgreementAmountInput(e.target.value)}
                  placeholder="Re-enter the order amount to confirm"
                />
                {agreementAmountInput.trim() !== "" && !agreementMatches && (
                  <p className="mt-1 text-xs text-rose-500">
                    Doesn't match this order's amount (₹{order.amount.toLocaleString("en-IN")}).
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-x-4">
              <label className="text-right text-sm font-medium text-slate-700">First Billing Month</label>
              <input
                type="month"
                className="w-full max-w-lg rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={firstBillingMonth}
                onChange={(e) => setFirstBillingMonth(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-start gap-x-4">
              <label className="pt-2 text-right text-sm font-medium text-slate-700">Remarks</label>
              <textarea
                className="w-full max-w-lg rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button onClick={onBack} className="rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
