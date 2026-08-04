import { useEffect, useState } from "react";
import type { OrderRecord } from "../types";
import { approvalHistoryRows, approvalHistoryStatusLabel, diffOrderDetails, formatDDMMYYYY } from "../utils";
import Modal from "./Modal";
import OrderDetailsReadOnly, { type OrderDetailSectionKey } from "../pages/orders/OrderDetailsReadOnly";

interface OrderPreviewModalProps {
  order: OrderRecord | null;
  orders: OrderRecord[];
  onClose: () => void;
}

type StepKey = "account" | "contact" | "order" | "payment" | "documents" | "approval";

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

function ShieldCheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 1.5l7 2.6v5.4c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V4.1l7-2.6zm3.4 6.1a1 1 0 00-1.4-1.4L9 9.2 7.7 7.9a1 1 0 10-1.4 1.4l2 2a1 1 0 001.4 0l3.7-3.7z"
        clipRule="evenodd"
      />
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
  { key: "approval", label: "Approval Status", icon: <ShieldCheckIcon /> },
];
const STEP_ORDER: StepKey[] = STEPS.map((s) => s.key);

// Read-only free-jump stepper, visually matching CreateOrderModal.tsx's
// OrderFormStepper — duplicated locally rather than imported/shared since
// nothing here is ever locked/disabled (everything's read-only) and this
// component shouldn't couple to CreateOrderModal's internals.
function PreviewStepper({
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

const SECTION_FOR_STEP: Record<Exclude<StepKey, "approval">, OrderDetailSectionKey> = {
  account: "account",
  contact: "contact",
  order: "order",
  payment: "payment",
  documents: "documents",
};

// Universal read-only order preview — opened by clicking an order number in
// any table across the app. Shows the same full order detail sections as
// OrderDetailsReadOnly, split across a CreateOrderModal-style stepper, plus
// an Approval Status step (history + amendment diff + closure details).
export default function OrderPreviewModal({ order, orders, onClose }: OrderPreviewModalProps) {
  const [activeStep, setActiveStep] = useState<StepKey>("account");
  const [visited, setVisited] = useState<Set<StepKey>>(new Set(["account"]));

  useEffect(() => {
    if (order) {
      setActiveStep("account");
      setVisited(new Set(["account"]));
    }
  }, [order]);

  function goTo(key: StepKey) {
    setActiveStep(key);
    setVisited((prev) => new Set(prev).add(key));
  }

  if (!order) return null;

  const predecessor = order.supersedes ? orders.find((o) => o.id === order.supersedes) ?? null : null;
  const successor = orders.find((o) => o.supersedes === order.id) ?? null;
  const changes = predecessor ? diffOrderDetails(predecessor, order) : [];
  const stepIndex = STEP_ORDER.indexOf(activeStep);

  return (
    <Modal open={order != null} onClose={onClose} widthClassName="max-w-4xl">
      <div className="max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">
            {order.orderNo} &nbsp;·&nbsp; {order.client}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {(predecessor || successor) && (
          <p className="mx-6 mt-3 rounded-md bg-amber-50 px-4 py-2 text-xs text-amber-700">
            {predecessor && <>This is an amendment of {predecessor.orderNo}. </>}
            {successor && <>Superseded by {successor.orderNo}.</>}
          </p>
        )}

        <PreviewStepper activeStep={activeStep} visited={visited} onSelect={goTo} />

        <div className="space-y-4 border-t border-slate-200 px-6 py-6">
          {activeStep !== "approval" ? (
            <OrderDetailsReadOnly order={order} sections={[SECTION_FOR_STEP[activeStep]]} />
          ) : (
            <>
              {changes.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-white shadow-sm">
                  <div className="border-b border-amber-200 px-6 py-3">
                    <h3 className="text-sm font-semibold tracking-wide text-slate-700">
                      CHANGES FROM {predecessor?.orderNo}
                    </h3>
                  </div>
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
          {stepIndex === STEP_ORDER.length - 1 ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Close
            </button>
          ) : (
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
    </Modal>
  );
}
