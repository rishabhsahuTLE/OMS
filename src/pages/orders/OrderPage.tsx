import { useEffect, useMemo, useState } from "react";
import type { Client, OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import DateRangePicker, { type DateRange } from "../../components/DateRangePicker";
import CreateOrderModal from "./CreateOrderModal";
import CancellationConfirm from "./CancellationConfirm";
import ConfirmDialog from "../../components/ConfirmDialog";
import { baseOrderNo, formatDDMMYYYY } from "../../utils";

interface PendingAmendment {
  original: OrderRecord;
  updated: OrderRecord;
  nextOrderNo: string;
}

interface OrderPageProps {
  clients: Client[];
  orders: OrderRecord[];
  onCreateOrder: (record: OrderRecord) => void;
  onUpdateOrder: (record: OrderRecord) => void;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
  // When set alongside autoOpen, jump straight into editing this order (used
  // by Create's "this University already has an order — amend it?" handoff).
  editOrderId?: string | null;
}

const selectClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

export default function OrderPage({
  clients,
  orders,
  onCreateOrder,
  onUpdateOrder,
  autoOpen,
  onAutoOpenHandled,
  editOrderId,
}: OrderPageProps) {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderRecord | null>(null);
  const [pendingAmendment, setPendingAmendment] = useState<PendingAmendment | null>(null);
  const [modalPrefillClientId, setModalPrefillClientId] = useState<string | undefined>(undefined);
  const [modalPrefillProduct, setModalPrefillProduct] = useState<string | undefined>(undefined);

  const [clientFilter, setClientFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [appliedFilters, setAppliedFilters] = useState({
    client: "all",
    product: "all",
    manager: "all",
    dateRange: { start: null, end: null } as DateRange,
  });

  useEffect(() => {
    if (!autoOpen || !editOrderId) return;
    const target = orders.find((o) => o.id === editOrderId);
    if (target) {
      setModalPrefillClientId(undefined);
      setModalPrefillProduct(undefined);
      setEditingOrder(target);
      setOrderModalOpen(true);
    }
    onAutoOpenHandled?.();
  }, [autoOpen, editOrderId, orders, onAutoOpenHandled]);

  function handleSearch() {
    setAppliedFilters({
      client: clientFilter,
      product: productFilter,
      manager: managerFilter,
      dateRange,
    });
  }

  // Only currently-active orders can be amended or have cancellation
  // initiated. Confirming an amendment immediately moves this predecessor to
  // "cancellationInProgress" (see confirmAmendment), so it drops out of this
  // list the moment it's amended — no separate guard needed here.
  const activeOrders = useMemo(() => orders.filter((o) => o.lifecycleStatus === "active"), [orders]);

  const filtered = useMemo(() => {
    return activeOrders.filter((r) => {
      if (appliedFilters.client !== "all" && r.client !== appliedFilters.client) return false;
      if (appliedFilters.product !== "all" && r.product !== appliedFilters.product) return false;
      if (appliedFilters.manager !== "all" && r.clientManager !== appliedFilters.manager) return false;
      if (appliedFilters.dateRange.start && appliedFilters.dateRange.end) {
        const [y, m, d] = r.createdOn.split("-").map(Number);
        const t = new Date(y, m - 1, d).getTime();
        if (t < appliedFilters.dateRange.start.getTime() || t > appliedFilters.dateRange.end.getTime()) return false;
      }
      return true;
    });
  }, [activeOrders, appliedFilters]);

  function closeOrderModal() {
    setOrderModalOpen(false);
    setEditingOrder(null);
  }

  function handleAmendClick(order: OrderRecord) {
    setModalPrefillClientId(undefined);
    setModalPrefillProduct(undefined);
    setEditingOrder(order);
    setOrderModalOpen(true);
  }

  // The CreateOrderModal's "onUpdate" for this page. When the order being
  // edited is active, don't commit yet — stash it and let confirmAmendment
  // (behind the ConfirmDialog below) do the actual two-order mutation once
  // the user confirms. Anything not yet active (e.g. reached via the
  // duplicate-order handoff, before ever activating) has no "live" version
  // to preserve, so it's just updated in place with no confirmation needed.
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

  // Confirmed: spawn the successor at "inactive" (its own fresh Tech/Fin
  // approval, see OrderApprovalReview) linked back via `supersedes`, and
  // immediately move the predecessor into "cancellationInProgress" — its
  // TC/FC approval and the successor's Tech/Fin now run independently and
  // in parallel. Only once both finish, and the predecessor's billing is
  // closed (Close Billing), does the successor actually go "active" (see
  // App.tsx's handleSetBillingStatus).
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

  const clientOptions = useMemo(() => Array.from(new Set(activeOrders.map((r) => r.client))).sort(), [activeOrders]);
  const managerOptions = useMemo(
    () => Array.from(new Set(activeOrders.map((r) => r.clientManager))).sort(),
    [activeOrders]
  );

  if (cancelTarget) {
    return (
      <CancellationConfirm
        order={cancelTarget}
        onBack={() => setCancelTarget(null)}
        onConfirm={(order, details) => {
          onUpdateOrder({ ...order, lifecycleStatus: "cancellationInProgress", cancellationDetails: details });
          setCancelTarget(null);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <svg className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.5 3a.5.5 0 000 1h1.04l1.7 8.02A2 2 0 007.2 13.5h6.1a2 2 0 001.96-1.6l1.05-5.4a.5.5 0 00-.49-.6H5.02l-.3-1.42A1.5 1.5 0 003.26 3H2.5zM7 17a1.25 1.25 0 100-2.5A1.25 1.25 0 007 17zm7 0a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" />
          </svg>
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">ACTIVE ORDERS</h2>
        </div>

        <div className="border-b border-slate-100 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm text-slate-600">Client</label>
              <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className={selectClass}>
                <option value="all">--Select Client--</option>
                {clientOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">Product</label>
              <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className={selectClass}>
                <option value="all">All</option>
                {PRODUCT_NAMES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">Client Manager</label>
              <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} className={selectClass}>
                <option value="all">--Select Client Manager--</option>
                {managerOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-teal-600">Date</label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={handleSearch}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-teal-300 text-teal-600 hover:bg-teal-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.6 4.2l3.6 3.6a1 1 0 01-1.4 1.4l-3.6-3.6A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Order #</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Product</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Client</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Client Manager</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Created On</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600">Amount (₹)</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{r.orderNo}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.product}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-700" title={r.client}>
                    {r.client}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.clientManager}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDDMMYYYY(r.createdOn)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {r.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAmendClick(r)}
                        className="rounded-md border border-teal-300 px-3 py-1.5 text-xs font-medium text-teal-600 hover:bg-teal-50"
                      >
                        Amend
                      </button>
                      <button
                        onClick={() => setCancelTarget(r)}
                        className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        Initiate Cancellation
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No active orders match your search/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateOrderModal
        open={orderModalOpen}
        onClose={closeOrderModal}
        clients={clients}
        orders={orders}
        editingOrder={editingOrder}
        prefillClientId={modalPrefillClientId}
        prefillProduct={modalPrefillProduct}
        onCreate={onCreateOrder}
        onUpdate={handleModalUpdate}
        onRequestAmend={handleAmendClick}
      />

      <ConfirmDialog
        open={pendingAmendment !== null}
        title="Confirm Amendment"
        message={
          pendingAmendment
            ? `${pendingAmendment.nextOrderNo} will be created as Inactive, needing fresh Tech/Fin approval. ${pendingAmendment.original.orderNo} will immediately have cancellation initiated, needing TC/FC approval. Once all four are done and ${pendingAmendment.original.orderNo}'s billing is closed, ${pendingAmendment.nextOrderNo} will become Active.`
            : ""
        }
        confirmLabel="Confirm Amendment"
        onConfirm={confirmAmendment}
        onCancel={cancelPendingAmendment}
      />
    </div>
  );
}
