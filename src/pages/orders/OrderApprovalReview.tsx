import { useState } from "react";
import type { ApprovalState, OrderRecord } from "../../types";
import { getProduct } from "../../products";
import {
  CURRENT_USER_EMAIL,
  deriveCreatedByName,
  formatDDMMYYYY,
  getNextActionableStage,
  todayISO,
  withRecomputedLifecycle,
  type ApprovalStageKey,
} from "../../utils";

interface OrderApprovalReviewProps {
  order: OrderRecord;
  onBack: () => void;
  onUpdateOrder: (record: OrderRecord) => void;
  onRequestCancellation: (order: OrderRecord) => void;
}

const readonlyClass = "w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-3">
        <h3 className="text-sm font-semibold tracking-wide text-slate-700">{title}</h3>
      </div>
      <div className="space-y-4 px-6 py-5">{children}</div>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-x-4">
      <label className="text-right text-sm font-medium text-slate-700">{label}</label>
      <input className={`${readonlyClass} max-w-lg`} value={value || "—"} disabled />
    </div>
  );
}

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

export default function OrderApprovalReview({
  order,
  onBack,
  onUpdateOrder,
  onRequestCancellation,
}: OrderApprovalReviewProps) {
  const [status, setStatus] = useState("");
  const [agreementAmountInput, setAgreementAmountInput] = useState("");
  const [firstBillingMonth, setFirstBillingMonth] = useState(order.details.firstBillingMonth);
  const [remark, setRemark] = useState("");

  const product = getProduct(order.product);
  const actionable = getNextActionableStage(order);
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

      <Section title="ACCOUNT DETAILS">
        <ReadRow label="Client Name" value={order.client} />
        <ReadRow label="Client Manager" value={order.clientManager} />
        <ReadRow label="Billing Address" value={order.details.billingAddress} />
        <ReadRow label="Billing State" value={order.details.billingState} />
        <ReadRow label="Billing City" value={order.details.billingCity} />
        <ReadRow label="Delivery Address" value={order.details.deliveryAddress} />
        <ReadRow label="Delivery State" value={order.details.deliveryState} />
        <ReadRow label="Delivery City" value={order.details.deliveryCity} />
        <ReadRow label="Customer GST No." value={order.details.gstNo || "NA"} />
      </Section>

      <Section title="CONTACT DETAILS">
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">SPOC Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">SPOC Email</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">SPOC Mobile</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.details.spocs.map((s, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-slate-700">{s.name || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{s.email || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{s.mobile || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{s.remarks || "—"}</td>
                </tr>
              ))}
              {order.details.spocs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                    No SPOCs on record.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="ORDER DETAILS">
        <ReadRow label="Product" value={order.product} />
        <ReadRow label="Date Of Sign" value={formatDDMMYYYY(order.dateOfSign)} />
        <ReadRow label="Plan" value={order.details.plan} />
        <ReadRow label="One Time (₹)" value={order.details.oneTime != null ? String(order.details.oneTime) : ""} />
        <ReadRow label="GST Process" value={order.details.gstProcess} />
        <ReadRow label="Select GST" value={order.details.selectGst} />
        {product?.fields(order.details as unknown as Record<string, string>).map((field) => (
          <ReadRow
            key={field.key}
            label={field.label}
            value={String(order.details[field.key as keyof typeof order.details] ?? "")}
          />
        ))}
        <ReadRow label="First Billing Month" value={order.details.firstBillingMonth} />
        <ReadRow label="Billing Cycle" value={order.billingCycle} />
        <ReadRow label="Agreement" value={order.details.agreement != null ? `${order.details.agreement} months` : ""} />
      </Section>

      <Section title="PAYMENT DETAILS">
        <ReadRow label="Advance (₹)" value={order.details.advance != null ? String(order.details.advance) : ""} />
        <ReadRow label="TDS (₹)" value={order.details.tds != null ? String(order.details.tds) : ""} />
        <ReadRow label="Net Amount (₹)" value={order.details.netAmount.toLocaleString("en-IN")} />
        <ReadRow label="Credit Period" value={order.details.creditPeriod != null ? `${order.details.creditPeriod} days` : ""} />
      </Section>

      <Section title="DOCUMENT DETAILS">
        {order.details.documents.length === 0 ? (
          <p className="text-sm text-slate-400">No documents attached.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-700">
            {order.details.documents.map((d, i) => (
              <li key={i}>
                {d.name || "(unnamed)"} — {d.fileName || "no file"}
              </li>
            ))}
          </ul>
        )}
      </Section>

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
          <div className="flex items-center justify-between px-6 py-6">
            <p className="text-sm text-slate-500">
              Tech and Fin are both cleared — this order is Active. To move it into cancellation approval, request
              cancellation.
            </p>
            <button
              onClick={() => onRequestCancellation(order)}
              className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Request Cancellation
            </button>
          </div>
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
                className="rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
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
