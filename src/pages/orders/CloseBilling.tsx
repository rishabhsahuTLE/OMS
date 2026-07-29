import { useMemo, useRef, useState } from "react";
import Modal from "../../components/Modal";
import type { ApprovalState, BillingStatus, OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import { formatDDMMYYYY } from "../../utils";

interface CloseBillingProps {
  orders: OrderRecord[];
  onSetBillingStatus: (ids: string[], billingStatus: BillingStatus) => void;
  onUpdateBillingRemarks: (id: string, billingRemarks: string) => void;
  onCreateOrderNow: (fromOrder: OrderRecord) => void;
  onCreateOrderLater: (fromOrder: OrderRecord) => void;
}

// Orders only reach Close Billing after completing the cancellation
// approval stage (Order Management > Approval), not merely on activation.
function isClosable(r: OrderRecord) {
  return r.lifecycleStatus === "cancelled";
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

function GridIcon() {
  return (
    <svg className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2.5 3a.5.5 0 000 1h1.04l1.7 8.02A2 2 0 007.2 13.5h6.1a2 2 0 001.96-1.6l1.05-5.4a.5.5 0 00-.49-.6H5.02l-.3-1.42A1.5 1.5 0 003.26 3H2.5zM7 17a1.25 1.25 0 100-2.5A1.25 1.25 0 007 17zm7 0a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" />
    </svg>
  );
}

const selectClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

interface Filters {
  client: string;
  product: string;
  billingStatus: "all" | BillingStatus;
  manager: string;
  date: string;
}

const defaultFilters: Filters = { client: "all", product: "all", billingStatus: "all", manager: "all", date: "" };

export default function CloseBilling({
  orders,
  onSetBillingStatus,
  onUpdateBillingRemarks,
  onCreateOrderNow,
  onCreateOrderLater,
}: CloseBillingProps) {
  const [clientFilter, setClientFilter] = useState(defaultFilters.client);
  const [productFilter, setProductFilter] = useState(defaultFilters.product);
  const [billingStatusFilter, setBillingStatusFilter] = useState<Filters["billingStatus"]>(
    defaultFilters.billingStatus
  );
  const [managerFilter, setManagerFilter] = useState(defaultFilters.manager);
  const [dateFilter, setDateFilter] = useState(defaultFilters.date);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [popupQueue, setPopupQueue] = useState<OrderRecord[]>([]);

  const closableOrders = useMemo(() => orders.filter(isClosable), [orders]);

  const clientOptions = useMemo(
    () => Array.from(new Set(closableOrders.map((o) => o.client))).sort(),
    [closableOrders]
  );
  const managerOptions = useMemo(
    () => Array.from(new Set(closableOrders.map((o) => o.clientManager))).sort(),
    [closableOrders]
  );

  function handleSearch() {
    setAppliedFilters({
      client: clientFilter,
      product: productFilter,
      billingStatus: billingStatusFilter,
      manager: managerFilter,
      date: dateFilter,
    });
  }

  const filtered = useMemo(() => {
    return closableOrders.filter((o) => {
      if (appliedFilters.client !== "all" && o.client !== appliedFilters.client) return false;
      if (appliedFilters.product !== "all" && o.product !== appliedFilters.product) return false;
      if (appliedFilters.billingStatus !== "all" && o.billingStatus !== appliedFilters.billingStatus) return false;
      if (appliedFilters.manager !== "all" && o.clientManager !== appliedFilters.manager) return false;
      if (appliedFilters.date && o.createdOn !== appliedFilters.date) return false;
      return true;
    });
  }, [closableOrders, appliedFilters]);

  // Closed orders stay in the table (rather than disappearing) and are
  // pinned to the top so they remain visible after billing is closed.
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.billingStatus === "Closed" ? 1 : 0) - (a.billingStatus === "Closed" ? 1 : 0)),
    [filtered]
  );

  const filteredIds = useMemo(() => filtered.map((o) => o.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

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
      if (allFilteredSelected) {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...filteredIds]);
    });
  }

  function applyBillingStatus(billingStatus: BillingStatus) {
    if (selectedIds.size === 0) return;
    const affected = orders.filter((o) => selectedIds.has(o.id));
    onSetBillingStatus(Array.from(selectedIds), billingStatus);
    setSelectedIds(new Set());
    if (billingStatus === "Closed") {
      setPopupQueue((prev) => [...prev, ...affected]);
    }
  }

  const currentPopupOrder = popupQueue[0] ?? null;

  function dismissPopup() {
    setPopupQueue((prev) => prev.slice(1));
  }

  function handleCreateNow() {
    if (currentPopupOrder) onCreateOrderNow(currentPopupOrder);
    dismissPopup();
  }

  function handleCreateLater() {
    if (currentPopupOrder) onCreateOrderLater(currentPopupOrder);
    dismissPopup();
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <GridIcon />
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">CLOSE BILLING</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-5">
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
            <label className="mb-1 block text-sm text-slate-600">Billing Status</label>
            <select
              value={billingStatusFilter}
              onChange={(e) => setBillingStatusFilter(e.target.value as Filters["billingStatus"])}
              className={selectClass}
            >
              <option value="all">All</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
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
            <div className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 shadow-sm focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400">
              <input
                ref={dateInputRef}
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full text-sm text-slate-500 outline-none"
              />
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker?.()}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
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
            - Rejected , <span className="rounded bg-yellow-200 px-1.5 py-0.5 text-slate-700">Amended</span>
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => applyBillingStatus("Closed")}
              disabled={selectedIds.size === 0}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark as closed
            </button>
            <button
              onClick={() => applyBillingStatus("Open")}
              disabled={selectedIds.size === 0}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mark as open
            </button>
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
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <CartIcon />
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">ORDERS</h2>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 w-10 bg-slate-50 px-4 py-3 text-left">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="h-4 w-4" />
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Order #</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Product</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Client</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Client Manager</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Created On</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600">Amount (₹)</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">T</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">F</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Billing Status</th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(o.id)}
                      onChange={() => toggleRow(o.id)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 font-medium text-slate-800 ${
                      o.amended ? "bg-yellow-200" : ""
                    }`}
                  >
                    {o.orderNo}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{o.product}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-slate-700" title={o.client}>
                    {o.client}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{o.clientManager}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDDMMYYYY(o.createdOn)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {o.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={o.technical.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <StatusIcon status={o.financial.status} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium text-white ${
                        o.billingStatus === "Open" ? "bg-teal-600" : "bg-slate-500"
                      }`}
                    >
                      {o.billingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={o.billingRemarks}
                      onChange={(e) => onUpdateBillingRemarks(o.id, e.target.value)}
                      placeholder="Add remark…"
                      className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    No orders match your search/filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={currentPopupOrder !== null} onClose={dismissPopup} widthClassName="max-w-2xl">
        {currentPopupOrder && (
          <div>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-sm font-semibold tracking-wide text-slate-700">
                BILLING CLOSED — {currentPopupOrder.orderNo}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Billing for <span className="font-medium text-slate-700">{currentPopupOrder.client}</span> has been
                closed. Would you like to create the next order now, or later?
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-2">
              <button
                onClick={handleCreateNow}
                className="flex flex-col gap-2 rounded-lg border border-teal-300 p-4 text-left hover:bg-teal-50"
              >
                <span className="text-sm font-semibold text-teal-700">Create Order Now</span>
                <span className="text-xs text-slate-500">
                  Redirects you straight to the Order Creation form with the client and product already filled in, so
                  you can complete and submit the order immediately.
                </span>
              </button>

              <button
                onClick={handleCreateLater}
                className="flex flex-col gap-2 rounded-lg border border-slate-300 p-4 text-left hover:bg-slate-50"
              >
                <span className="text-sm font-semibold text-slate-700">Create Order Later</span>
                <span className="text-xs text-slate-500">
                  Creates a placeholder order with an Incomplete status, pinned to the top of the Orders list. It
                  stays editable until you open it, finish the details, and submit it through the normal approval
                  workflow.
                </span>
              </button>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-3">
              <button onClick={dismissPopup} className="text-sm font-medium text-slate-500 hover:text-slate-700">
                Skip
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
