import { useMemo, useState } from "react";
import type { ApprovalState, CancellationDetails, Client, OrderDisplayStage, OrderRecord } from "../../types";
import CreateOrderModal from "./CreateOrderModal";
import CancellationConfirm from "./CancellationConfirm";
import ConfirmDialog from "../../components/ConfirmDialog";
import { baseOrderNo, canInitiateClose, getDisplayStage, getNextActionableStage, initiateClosure } from "../../utils";

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
}

interface PendingAmendment {
  original: OrderRecord;
  updated: OrderRecord;
  nextOrderNo: string;
}

type ViewTab = "all" | OrderDisplayStage;

const VIEW_TABS: { key: ViewTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approvalPending", label: "Approval Pending" },
  { key: "active", label: "Active" },
  { key: "agreementOver", label: "Agreement Over" },
  { key: "closurePending", label: "Closure Pending" },
  { key: "closed", label: "Closed" },
];

const STAGE_LABELS: Record<OrderDisplayStage, string> = {
  approvalPending: "Approval Pending",
  active: "Active",
  agreementOver: "Agreement Over",
  closurePending: "Closure Pending",
  closed: "Closed",
};

const STAGE_BADGE_CLASS: Record<OrderDisplayStage, string> = {
  approvalPending: "bg-slate-200 text-slate-700",
  active: "bg-emerald-100 text-emerald-700",
  agreementOver: "bg-orange-100 text-orange-700",
  closurePending: "bg-amber-100 text-amber-800",
  closed: "bg-rose-200 text-rose-800",
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

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11.5a1 1 0 10-2 0 1 1 0 002 0zM9 9.5a1 1 0 112 0V14a1 1 0 11-2 0V9.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface NextStepInfo {
  message: string;
}

// What the Status info popover tells the user for a given order — the next
// concrete thing that has to happen before it moves further.
function nextStepInfo(order: OrderRecord, orders: OrderRecord[]): NextStepInfo {
  const stage = getDisplayStage(order);

  if (stage === "approvalPending") {
    if (order.supersedes && order.technical.status === "confirmed" && order.financial.status === "confirmed") {
      const predecessor = orders.find((o) => o.id === order.supersedes) ?? null;
      if (predecessor && predecessor.lifecycleStatus !== "cancelled") {
        return {
          message: `Tech and Fin are cleared — waiting on ${predecessor.orderNo} to close before this order can go Active.`,
        };
      }
    }
    const next = getNextActionableStage(order);
    return { message: next ? `Next step: awaiting ${next.label} approval.` : "Awaiting activation." };
  }

  if (stage === "active") {
    return { message: "This order is Active. No approval action is needed unless you amend or close it." };
  }

  if (stage === "agreementOver") {
    return {
      message: "This order's agreement period has ended. No approval action is needed unless you amend or close it.",
    };
  }

  if (stage === "closurePending") {
    const next = getNextActionableStage(order);
    return { message: next ? `Next step: awaiting ${next.label} approval.` : "Awaiting closure to complete." };
  }

  return { message: "This order is Closed." };
}

// Display-only — stage changes only happen through the Approvals tab, one at
// a time, in order.
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
}: OrderApprovalProps) {
  const [tab, setTab] = useState<ViewTab>("all");
  const [creating, setCreating] = useState(false);
  const [openInfoOrderId, setOpenInfoOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [pendingAmendment, setPendingAmendment] = useState<PendingAmendment | null>(null);
  const [closeBatch, setCloseBatch] = useState<OrderRecord[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (tab === "all") return orders;
    return orders.filter((o) => getDisplayStage(o) === tab);
  }, [orders, tab]);

  // Only closeable orders are selectable — Select All only ever touches the
  // currently-filtered closeable rows, matching the checkboxes shown.
  const closeableFiltered = useMemo(() => filtered.filter((o) => canInitiateClose(o)), [filtered]);
  const allCloseableSelected = closeableFiltered.length > 0 && closeableFiltered.every((o) => selectedIds.has(o.id));

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allCloseableSelected) {
        const next = new Set(prev);
        closeableFiltered.forEach((o) => next.delete(o.id));
        return next;
      }
      return new Set([...prev, ...closeableFiltered.map((o) => o.id)]);
    });
  }

  function rowClass(order: OrderRecord) {
    if (order.lifecycleStatus === "cancelled") return "bg-rose-100 hover:bg-rose-200";
    if (order.amended) return "bg-yellow-100 hover:bg-yellow-200";
    return "hover:bg-slate-50";
  }

  function closeOrderModal() {
    setOrderModalOpen(false);
    setEditingOrder(null);
  }

  function handleAmendClick(order: OrderRecord) {
    setEditingOrder(order);
    setOrderModalOpen(true);
  }

  // University clients only ever get one order per product — if Create hits
  // that duplicate guard, it hands the existing order back here. Since
  // Amend lives in this same tab now, just switch straight into editing it —
  // no cross-tab jump needed.
  function handleRequestAmendFromDuplicate(order: OrderRecord) {
    setCreating(false);
    handleAmendClick(order);
  }

  // The CreateOrderModal's "onUpdate" for the Amend flow. When the order
  // being edited is active, don't commit yet — stash it and let
  // confirmAmendment (behind the ConfirmDialog below) do the actual
  // two-order mutation once the user confirms. Anything not yet active
  // (e.g. reached via the duplicate-order handoff, before ever activating)
  // has no "live" version to preserve, so it's just updated in place with no
  // confirmation needed.
  function handleModalUpdate(updatedRecord: OrderRecord) {
    const original = orders.find((o) => o.id === updatedRecord.id);
    if (original && original.lifecycleStatus === "active") {
      const base = baseOrderNo(original.orderNo);
      const priorVersions = orders
        .filter((o) => baseOrderNo(o.orderNo) === base && o.orderNo.includes("/"))
        .map((o) => parseInt(o.orderNo.split("/")[1], 10))
        .filter((n) => !Number.isNaN(n));
      const nextVersion = priorVersions.length > 0 ? Math.max(...priorVersions) + 1 : 1;
      setPendingAmendment({ original, updated: updatedRecord, nextOrderNo: `${base}/${nextVersion}` });
    } else {
      onUpdateOrder(updatedRecord);
      setEditingOrder(null);
    }
  }

  // Confirmed: spawn the successor at "inactive" (Approval Pending, its own
  // fresh Tech/Fin approval) linked back via `supersedes`, and immediately
  // move the predecessor into "cancellationInProgress" (Closure Pending) —
  // its TC/FC approval and the successor's Tech/Fin now run independently
  // and in parallel. Only once both finish does the successor actually go
  // Active (see promoteSuccessorOf in utils.ts, wired through App.tsx).
  function confirmAmendment() {
    if (!pendingAmendment) return;
    const { original, updated, nextOrderNo } = pendingAmendment;
    onCreateOrder({
      ...updated,
      id: `ord-${Math.random().toString(36).slice(2, 10)}`,
      orderNo: nextOrderNo,
      amended: true,
      supersedes: original.id,
      lifecycleStatus: "inactive",
      technical: { status: "pending", date: null },
      financial: { status: "pending", date: null },
      cancellationTechnical: { status: "pending", date: null },
      cancellationFinancial: { status: "pending", date: null },
    });
    onUpdateOrder({ ...original, lifecycleStatus: "cancellationInProgress" });
    setPendingAmendment(null);
    setEditingOrder(null);
    setOrderModalOpen(false);
  }

  function cancelPendingAmendment() {
    setPendingAmendment(null);
  }

  function handleCloseConfirm(batch: OrderRecord[], details: CancellationDetails) {
    batch.forEach((o) => onUpdateOrder(initiateClosure(o, details)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      batch.forEach((o) => next.delete(o.id));
      return next;
    });
    setCloseBatch(null);
  }

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
          onRequestAmend={handleRequestAmendFromDuplicate}
        />
      </div>
    );
  }

  if (closeBatch) {
    return <CancellationConfirm orders={closeBatch} onBack={() => setCloseBatch(null)} onConfirm={handleCloseConfirm} />;
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const batch = orders.filter((o) => selectedIds.has(o.id) && canInitiateClose(o));
              if (batch.length > 0) setCloseBatch(batch);
            }}
            disabled={selectedIds.size === 0}
            className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <PlusIcon />
            Create
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">Tech</span> — Technical Approval and{" "}
        <span className="font-medium text-slate-600">Fin</span> — Financial Approval decide activation;{" "}
        <span className="font-medium text-slate-600">TC</span>/<span className="font-medium text-slate-600">FC</span>{" "}
        are their closure-stage counterparts. Statuses are shown here for reference only — approvals/rejections happen
        on the Approvals tab, strictly in order (Tech before Fin, TC before FC).
      </p>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-20 w-10 bg-slate-50 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allCloseableSelected}
                  onChange={toggleSelectAll}
                  disabled={closeableFiltered.length === 0}
                  className="h-4 w-4"
                />
              </th>
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
            {filtered.map((order) => {
              const stage = getDisplayStage(order);
              const canAmend = order.lifecycleStatus === "active";
              const canClose = canInitiateClose(order);
              return (
                <tr key={order.id} className={`transition-colors ${rowClass(order)}`}>
                  <td className="px-4 py-3">
                    {canClose ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleRow(order.id)}
                        className="h-4 w-4"
                      />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
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
                  <td className="relative whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_BADGE_CLASS[stage]}`}>
                        {STAGE_LABELS[stage]}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenInfoOrderId((id) => (id === order.id ? null : order.id))}
                        title="What's next?"
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <InfoIcon />
                      </button>
                    </div>
                    {openInfoOrderId === order.id &&
                      (() => {
                        const info = nextStepInfo(order, orders);
                        return (
                          <div className="absolute left-4 top-full z-30 mt-1 w-72 rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal normal-case text-slate-600 shadow-lg">
                            <p>{info.message}</p>
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => setOpenInfoOrderId(null)}
                                className="rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {canAmend ? (
                      <button
                        onClick={() => handleAmendClick(order)}
                        className="rounded-md border border-teal-300 px-3 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-50"
                      >
                        Amend
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                  No orders match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateOrderModal
        open={orderModalOpen}
        onClose={closeOrderModal}
        clients={clients}
        orders={orders}
        editingOrder={editingOrder}
        onCreate={onCreateOrder}
        onUpdate={handleModalUpdate}
        onRequestAmend={handleAmendClick}
      />

      <ConfirmDialog
        open={pendingAmendment !== null}
        title="Confirm Amendment"
        message={
          pendingAmendment
            ? `${pendingAmendment.nextOrderNo} will be created as Approval Pending, needing fresh Tech/Fin approval. ${pendingAmendment.original.orderNo} will immediately have closure initiated, needing TC/FC approval. Once all four are done, ${pendingAmendment.nextOrderNo} will become Active.`
            : ""
        }
        confirmLabel="Confirm Amendment"
        onConfirm={confirmAmendment}
        onCancel={cancelPendingAmendment}
      />
    </div>
  );
}
