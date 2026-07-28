import { useEffect, useMemo, useState } from "react";
import type { ApprovalState, Client, OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import DateRangePicker, { type DateRange } from "../../components/DateRangePicker";
import ConfirmDialog from "../../components/ConfirmDialog";
import CreateOrderModal from "./CreateOrderModal";
import { formatDDMMYYYY } from "../../utils";

interface OrderPagePrefill {
  clientId: string;
  product: string;
}

interface OrderPageProps {
  clients: Client[];
  orders: OrderRecord[];
  onCreateOrder: (record: OrderRecord) => void;
  onUpdateOrder: (record: OrderRecord) => void;
  onDeleteOrder: (id: string) => void;
  prefill?: OrderPagePrefill | null;
  autoOpen?: boolean;
  onAutoOpenHandled?: () => void;
}

function isFullyConfirmed(r: OrderRecord) {
  return r.technical.status === "confirmed" && r.financial.status === "confirmed";
}

function StatusIcon({ status }: { status: ApprovalState }) {
  if (status === "confirmed") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
        </svg>
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-400">•</span>;
}

const selectClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

export default function OrderPage({
  clients,
  orders,
  onCreateOrder,
  onUpdateOrder,
  onDeleteOrder,
  prefill,
  autoOpen,
  onAutoOpenHandled,
}: OrderPageProps) {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null);
  const [modalPrefillClientId, setModalPrefillClientId] = useState<string | undefined>(undefined);
  const [modalPrefillProduct, setModalPrefillProduct] = useState<string | undefined>(undefined);

  const [clientFilter, setClientFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [appliedFilters, setAppliedFilters] = useState({
    client: "all",
    product: "all",
    status: "all",
    manager: "all",
    dateRange: { start: null, end: null } as DateRange,
  });

  useEffect(() => {
    if (!autoOpen || !prefill) return;
    setModalPrefillClientId(prefill.clientId);
    setModalPrefillProduct(prefill.product);
    setEditingOrder(null);
    setOrderModalOpen(true);
    onAutoOpenHandled?.();
  }, [autoOpen, prefill, onAutoOpenHandled]);

  function openCreateModal() {
    setModalPrefillClientId(undefined);
    setModalPrefillProduct(undefined);
    setEditingOrder(null);
    setOrderModalOpen(true);
  }

  function handleSearch() {
    setAppliedFilters({
      client: clientFilter,
      product: productFilter,
      status: statusFilter,
      manager: managerFilter,
      dateRange,
    });
  }

  const filtered = useMemo(() => {
    return orders.filter((r) => {
      if (appliedFilters.client !== "all" && r.client !== appliedFilters.client) return false;
      if (appliedFilters.product !== "all" && r.product !== appliedFilters.product) return false;
      if (
        appliedFilters.status !== "all" &&
        r.technical.status !== appliedFilters.status &&
        r.financial.status !== appliedFilters.status
      )
        return false;
      if (appliedFilters.manager !== "all" && r.clientManager !== appliedFilters.manager) return false;
      if (appliedFilters.dateRange.start && appliedFilters.dateRange.end) {
        const [y, m, d] = r.createdOn.split("-").map(Number);
        const t = new Date(y, m - 1, d).getTime();
        if (t < appliedFilters.dateRange.start.getTime() || t > appliedFilters.dateRange.end.getTime()) return false;
      }
      return true;
    });
  }, [orders, appliedFilters]);

  // Incomplete placeholder orders (from "Create Order Later") stay pinned to
  // the top of the list until their details are filled in and saved.
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.incomplete ? 1 : 0) - (a.incomplete ? 1 : 0)),
    [filtered]
  );

  function handleCreateOrder(record: OrderRecord) {
    onCreateOrder(record);
  }

  function handleUpdateOrder(record: OrderRecord) {
    onUpdateOrder(record);
    setEditingOrder(null);
  }

  function closeOrderModal() {
    setOrderModalOpen(false);
    setEditingOrder(null);
  }

  function handleEditOrder(order: OrderRecord) {
    setModalPrefillClientId(undefined);
    setModalPrefillProduct(undefined);
    setEditingOrder(order);
    setOrderModalOpen(true);
  }

  const clientOptions = useMemo(() => Array.from(new Set(orders.map((r) => r.client))).sort(), [orders]);
  const managerOptions = useMemo(() => Array.from(new Set(orders.map((r) => r.clientManager))).sort(), [orders]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex justify-end">
        <button
          onClick={openCreateModal}
          className="rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Create Order
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <svg className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.5 3a.5.5 0 000 1h1.04l1.7 8.02A2 2 0 007.2 13.5h6.1a2 2 0 001.96-1.6l1.05-5.4a.5.5 0 00-.49-.6H5.02l-.3-1.42A1.5 1.5 0 003.26 3H2.5zM7 17a1.25 1.25 0 100-2.5A1.25 1.25 0 007 17zm7 0a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" />
          </svg>
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">ORDER LIST</h2>
        </div>

        <div className="border-b border-slate-100 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              <label className="mb-1 block text-sm text-slate-600">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="rejected">Rejected</option>
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

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-600">T</span> - Technical ,{" "}
              <span className="font-medium text-slate-600">F</span> - Financial , Status:{" "}
              <span className="mx-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 align-middle text-slate-400">
                •
              </span>{" "}
              - Pending ,{" "}
              <span className="mx-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 align-middle text-emerald-600">
                <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
                </svg>
              </span>{" "}
              - Confirmed ,{" "}
              <span className="mx-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 align-middle text-rose-600">
                <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
                </svg>
              </span>{" "}
              - Rejected ,{" "}
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Incomplete
              </span>{" "}
              - Placeholder order awaiting details
            </p>
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
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">T</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">F</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => (
                <tr key={r.id} className={`hover:bg-slate-50 ${r.incomplete ? "bg-amber-50/60" : ""}`}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                    {r.orderNo}
                    {r.incomplete && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Incomplete
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.product}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-700" title={r.client}>
                    {r.client}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{r.clientManager}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDDMMYYYY(r.createdOn)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {r.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={r.technical.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={r.financial.status} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {isFullyConfirmed(r) ? (
                      <div className="flex items-center gap-2">
                        <button className="text-slate-500 hover:text-slate-700" title="View">
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 3.5c-4.5 0-7.5 4-8.5 6.5 1 2.5 4 6.5 8.5 6.5s7.5-4 8.5-6.5c-1-2.5-4-6.5-8.5-6.5zm0 10.5a4 4 0 110-8 4 4 0 010 8z" />
                          </svg>
                        </button>
                        <span className="text-slate-300">
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 2a1 1 0 00-1 1v1H4a1 1 0 100 2h1v9a2 2 0 002 2h6a2 2 0 002-2V6h1a1 1 0 100-2h-3V3a1 1 0 00-1-1H8zm1 5a1 1 0 112 0v6a1 1 0 11-2 0V7z" />
                          </svg>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditOrder(r)}
                          className="text-teal-600 hover:text-teal-800"
                          title="Edit"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a2 2 0 01-.878.507l-3 .857a.5.5 0 01-.618-.618l.857-3a2 2 0 01.507-.878l8.5-8.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="text-rose-500 hover:text-rose-700"
                          title="Delete"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 2a1 1 0 00-1 1v1H4a1 1 0 100 2h1v9a2 2 0 002 2h6a2 2 0 002-2V6h1a1 1 0 100-2h-3V3a1 1 0 00-1-1H8zm1 5a1 1 0 112 0v6a1 1 0 11-2 0V7z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                    No orders match your search/filter.
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
        onCreate={handleCreateOrder}
        onUpdate={handleUpdateOrder}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Are you sure?"
        message="You want to delete this order!"
        confirmLabel="Yes, delete it!"
        onConfirm={() => {
          if (deleteTarget) onDeleteOrder(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
