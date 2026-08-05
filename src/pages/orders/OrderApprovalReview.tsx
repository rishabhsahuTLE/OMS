import { useState } from "react";
import type { ApprovalState, OrderRecord } from "../../types";
import {
  CURRENT_USER_EMAIL,
  approvalHistoryRows,
  approvalHistoryStatusLabel,
  deriveCreatedByName,
  diffOrderDetails,
  formatDDMMYYYY,
  getNextActionableStage,
  todayISO,
  withRecomputedLifecycle,
  type ApprovalStageKey,
} from "../../utils";
import OrderDetailsReadOnly, { type OrderDetailSectionKey } from "./OrderDetailsReadOnly";

interface OrderApprovalReviewProps {
  order: OrderRecord;
  orders: OrderRecord[];
  // "view" (from the Approvals tab's View action) suppresses the Process
  // Order form entirely — read-only lookup only. Defaults to "process" so
  // the existing approve/reject flow is unaffected.
  mode?: "view" | "process";
  onBack: () => void;
  onUpdateOrder: (record: OrderRecord) => void;
}

const readonlyClass = "w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600";

const STAGE_LABELS: Record<ApprovalStageKey, string> = {
  technical: "Tech",
  financial: "Fin",
  cancellationTechnical: "TC",
  cancellationFinancial: "FC",
};

// Same top-line stepper as CreateOrderModal.tsx / OrderPreviewModal.tsx —
// duplicated locally rather than shared, per this codebase's existing
// convention (see OrderPreviewModal.tsx's own note) — nothing here is ever
// locked/disabled the way CreateOrderModal's amendment fields are, so the
// shape is closer to OrderPreviewModal's read-only stepper, just with a
// final actionable step instead of a read-only one.
type StepKey = "account" | "contact" | "order" | "payment" | "documents" | "process";

function BriefcaseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4a2 2 0 012-2h2a2 2 0 012 2v1h2a2 2 0 012 2v2H3V7a2 2 0 012-2h2V4zm2 0v1h2V4H9zM3 10h14v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3.5 2.5c.5-.5 1.3-.5 1.8 0l1.7 1.7c.4.4.5 1 .2 1.5l-.8 1.4a11 11 0 004.5 4.5l1.4-.8c.5-.3 1.1-.2 1.5.2l1.7 1.7c.5.5.5 1.3 0 1.8l-1.1 1.1c-.6.6-1.5.9-2.3.6-3-.9-5.8-2.6-8-4.9-2.3-2.2-4-5-4.9-8-.3-.8 0-1.7.6-2.3L3.5 2.5z" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 00-1 1v14a1 1 0 001.45.9L6 17l1.55.9a1 1 0 001 0L10 17l1.55.9a1 1 0 001 0L14 17l1.55.9A1 1 0 0017 17V3a1 1 0 00-1-1H4zm2 4h8v1.5H6V6zm0 3h8v1.5H6V9zm0 3h5v1.5H6V12z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm2 1v1h12V6H4zm0 3v5h12V9H4z" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8 4a3 3 0 016 0v7a5 5 0 01-10 0V6a1 1 0 112 0v5a3 3 0 006 0V4a1 1 0 10-2 0v6a1 1 0 11-2 0V4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 2a1 1 0 00-1 1v1H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H8V3a1 1 0 00-1-1zM6 9.7l1.4-1.4L9 9.9l4-4L14.4 7.3 9 12.7 6 9.7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
    </svg>
  );
}

const STEPS: { key: StepKey; label: string; icon: React.ReactNode }[] = [
  { key: "account", label: "Account Details", icon: <BriefcaseIcon /> },
  { key: "contact", label: "Contact Details", icon: <PhoneIcon /> },
  { key: "order", label: "Order Details", icon: <ReceiptIcon /> },
  { key: "payment", label: "Payment Details", icon: <CardIcon /> },
  { key: "documents", label: "Documents", icon: <PaperclipIcon /> },
  { key: "process", label: "Process Order", icon: <ClipboardCheckIcon /> },
];
const STEP_ORDER: StepKey[] = STEPS.map((s) => s.key);

const SECTION_FOR_STEP: Record<Exclude<StepKey, "process">, OrderDetailSectionKey> = {
  account: "account",
  contact: "contact",
  order: "order",
  payment: "payment",
  documents: "documents",
};

// Free-jump stepper — click any section to go straight to it, same
// interaction as CreateOrderModal's OrderFormStepper / OrderPreviewModal's
// PreviewStepper.
function ReviewStepper({
  activeStep,
  visited,
  onSelect,
}: {
  activeStep: StepKey;
  visited: Set<StepKey>;
  onSelect: (key: StepKey) => void;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const current = s.key === activeStep;
          const complete = visited.has(s.key) && !current;
          const circleClass = current
            ? "border-indigo-600 bg-indigo-600 text-white"
            : complete
            ? "border-emerald-400 bg-emerald-50 text-emerald-600"
            : "border-slate-300 bg-white text-slate-400";
          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => onSelect(s.key)}
                title={s.label}
                className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${circleClass}`}
              >
                {s.icon}
                {complete && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                    <CheckIcon />
                  </span>
                )}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 ${complete ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex">
        {STEPS.map((s) => (
          <div
            key={s.key}
            className={`flex-1 px-1 text-center text-[11px] font-medium leading-tight last:flex-none last:w-9 ${
              s.key === activeStep ? "text-indigo-700" : "text-slate-500"
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrderApprovalReview({
  order,
  orders,
  mode = "process",
  onBack,
  onUpdateOrder,
}: OrderApprovalReviewProps) {
  const [activeStep, setActiveStep] = useState<StepKey>("account");
  const [visited, setVisited] = useState<Set<StepKey>>(new Set(["account"]));
  const [status, setStatus] = useState("");
  const [agreementAmountInput, setAgreementAmountInput] = useState("");
  const [firstBillingMonth, setFirstBillingMonth] = useState(order.details.firstBillingMonth);
  const [remark, setRemark] = useState("");

  const actionable = getNextActionableStage(order);
  const predecessor = order.supersedes ? orders.find((o) => o.id === order.supersedes) ?? null : null;
  const changes = predecessor ? diffOrderDetails(predecessor, order) : [];
  const agreementMatches = agreementAmountInput.trim() !== "" && Number(agreementAmountInput) === order.amount;
  const canSubmit = actionable !== null && status !== "" && agreementMatches;

  function goTo(key: StepKey) {
    setActiveStep(key);
    setVisited((prev) => new Set(prev).add(key));
  }

  const stepIndex = STEP_ORDER.indexOf(activeStep);

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
          Back to Approvals
        </button>
        <h2 className="text-sm font-semibold tracking-wide text-slate-700">
          {order.orderNo} &nbsp;·&nbsp; {order.client}
        </h2>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {predecessor && (
          <p className="mx-6 mt-4 rounded-md bg-amber-50 px-4 py-2 text-xs text-amber-700">
            This is an amendment of {predecessor.orderNo} — see the changes on the Process Order step.
          </p>
        )}

        <ReviewStepper activeStep={activeStep} visited={visited} onSelect={goTo} />

        <div className="space-y-4 border-t border-slate-200 px-6 py-6">
          {activeStep !== "process" ? (
            <OrderDetailsReadOnly order={order} sections={[SECTION_FOR_STEP[activeStep]]} />
          ) : (
            <>
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
                      {approvalHistoryRows(order).map((row) => (
                        <tr key={row.label}>
                          <td className="px-4 py-2 font-medium text-slate-800">{row.label}</td>
                          <td className="px-4 py-2 text-slate-700">{approvalHistoryStatusLabel(row.stage.status)}</td>
                          <td className="px-4 py-2 text-slate-700">{row.stage.processedBy || "—"}</td>
                          <td className="px-4 py-2 text-slate-700">
                            {row.stage.date ? formatDDMMYYYY(row.stage.date) : "—"}
                          </td>
                          <td className="px-4 py-2 text-slate-700">{row.stage.remark || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <OrderDetailsReadOnly order={order} sections={["closure"]} />

              <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-3">
                  <h3 className="text-sm font-semibold tracking-wide text-slate-700">PROCESS ORDER</h3>
                </div>

                {mode === "view" ? (
                  <p className="px-6 py-6 text-sm text-slate-400">
                    Read-only view. Use the Approve/Reject action from the list to record a decision on this order.
                  </p>
                ) : order.lifecycleStatus === "active" ? (
                  <p className="px-6 py-6 text-sm text-slate-500">
                    Tech and Fin are both cleared — this order is Active. Cancellation can only be initiated from the
                    Manage Orders tab, by the order's client manager.
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
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={() => stepIndex > 0 && goTo(STEP_ORDER[stepIndex - 1])}
            disabled={stepIndex === 0}
            className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          {stepIndex < STEP_ORDER.length - 1 && (
            <button
              type="button"
              onClick={() => goTo(STEP_ORDER[stepIndex + 1])}
              className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
