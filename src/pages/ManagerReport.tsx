import { Fragment, useMemo, useState } from "react";
import type { ApprovalState, OrderRecord } from "../types";
import { PRODUCT_NAMES } from "../products";
import { formatDDMMYYYY } from "../utils";
import DateRangePicker, { type DateRange } from "../components/DateRangePicker";
import SearchableSelect from "../components/SearchableSelect";
import AmountRangeSlider from "../components/AmountRangeSlider";

interface ManagerReportProps {
  orders: OrderRecord[];
}

const AMOUNT_MAX_LAKH = 50;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface Filters {
  manager: string;
  product: string;
  minLakh: number;
  maxLakh: number;
  dateRange: DateRange;
}

const defaultFilters: Filters = {
  manager: "all",
  product: "all",
  minLakh: 0,
  maxLakh: AMOUNT_MAX_LAKH,
  dateRange: { start: null, end: null },
};

interface ManagerStats {
  manager: string;
  orders: OrderRecord[];
  total: number;
  technical: number;
  financial: number;
  confirmed: number;
  rejected: number;
  amount: number;
}

function buildManagerStats(orders: OrderRecord[]): ManagerStats[] {
  const byManager = new Map<string, OrderRecord[]>();
  for (const o of orders) {
    const list = byManager.get(o.clientManager) ?? [];
    list.push(o);
    byManager.set(o.clientManager, list);
  }
  return Array.from(byManager.entries())
    .map(([manager, list]) => ({
      manager,
      orders: list,
      total: list.length,
      technical: list.filter((o) => o.technical.status === "confirmed").length,
      financial: list.filter((o) => o.financial.status === "confirmed").length,
      confirmed: list.filter((o) => o.technical.status === "confirmed" && o.financial.status === "confirmed").length,
      rejected: list.filter((o) => o.technical.status === "rejected" || o.financial.status === "rejected").length,
      amount: list.reduce((sum, o) => sum + o.amount, 0),
    }))
    .sort((a, b) => a.manager.localeCompare(b.manager));
}

function parseISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function BriefcaseIcon() {
  return (
    <svg className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6 3a2 2 0 00-2 2v1H3a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-1V5a2 2 0 00-2-2H6zm0 3V5h8v1H6zM1 9h18v1H1V9z" />
    </svg>
  );
}

// The expand toggle: a chevron pointing right, rotating 90° into a downward
// chevron when the group is open — same motif as Sidebar.tsx's section arrow.
function ExpandIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatusPill({ status }: { status: ApprovalState }) {
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
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-500">
      P
    </span>
  );
}

// Amended (archived) and fully cancelled orders are flagged the same way in
// every report table — yellow for amended, red for cancelled.
function rowHighlightClass(order: OrderRecord) {
  if (order.lifecycleStatus === "cancelled") return "bg-rose-100 hover:bg-rose-200";
  if (order.amended) return "bg-yellow-100 hover:bg-yellow-200";
  return "hover:bg-slate-50";
}

function ManagerOrdersTable({ orders }: { orders: OrderRecord[] }) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(q) ||
        o.product.toLowerCase().includes(q) ||
        o.client.toLowerCase().includes(q)
    );
  }, [orders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(filtered.length, currentPage * pageSize);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Show
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          entries
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          Search:
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">Order #</th>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">Product</th>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">Account</th>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">Created On</th>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-center font-semibold text-slate-600">T</th>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-center font-semibold text-slate-600">F</th>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">Billing Cycle</th>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((o) => (
              <tr key={o.id} className={`transition-colors ${rowHighlightClass(o)}`}>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">#{o.orderNo}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{o.product}</td>
                <td className="max-w-[200px] truncate px-3 py-2 text-slate-700" title={o.client}>
                  {o.client}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatDDMMYYYY(o.createdOn)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-center">
                    <StatusPill status={o.technical.status} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-center">
                    <StatusPill status={o.financial.status} />
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{o.billingCycle || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">
                  {o.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  No orders match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          Showing {rangeStart} to {rangeEnd} of {filtered.length} entries
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600 text-xs font-semibold text-white">
            {currentPage}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagerReport({ orders }: ManagerReportProps) {
  const [managerDraft, setManagerDraft] = useState("all");
  const [productDraft, setProductDraft] = useState("all");
  const [minLakhDraft, setMinLakhDraft] = useState(0);
  const [maxLakhDraft, setMaxLakhDraft] = useState(AMOUNT_MAX_LAKH);
  const [dateRangeDraft, setDateRangeDraft] = useState<DateRange>({ start: null, end: null });
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);
  const [openManagers, setOpenManagers] = useState<Set<string>>(new Set());

  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  function handleSearch() {
    setAppliedFilters({
      manager: managerDraft,
      product: productDraft,
      minLakh: minLakhDraft,
      maxLakh: maxLakhDraft,
      dateRange: dateRangeDraft,
    });
  }

  function handleClear() {
    setManagerDraft(defaultFilters.manager);
    setProductDraft(defaultFilters.product);
    setMinLakhDraft(defaultFilters.minLakh);
    setMaxLakhDraft(defaultFilters.maxLakh);
    setDateRangeDraft(defaultFilters.dateRange);
    setAppliedFilters(defaultFilters);
  }

  function toggleManager(manager: string) {
    setOpenManagers((prev) => {
      const next = new Set(prev);
      if (next.has(manager)) next.delete(manager);
      else next.add(manager);
      return next;
    });
  }

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (appliedFilters.manager !== "all") result = result.filter((o) => o.clientManager === appliedFilters.manager);
    if (appliedFilters.product !== "all") result = result.filter((o) => o.product === appliedFilters.product);

    const minRupees = appliedFilters.minLakh * 100_000;
    const maxRupees = appliedFilters.maxLakh >= AMOUNT_MAX_LAKH ? Infinity : appliedFilters.maxLakh * 100_000;
    result = result.filter((o) => o.amount >= minRupees && o.amount <= maxRupees);

    if (appliedFilters.dateRange.start && appliedFilters.dateRange.end) {
      const startTime = appliedFilters.dateRange.start.getTime();
      const endTime = appliedFilters.dateRange.end.getTime();
      result = result.filter((o) => {
        const t = parseISO(o.createdOn).getTime();
        return t >= startTime && t <= endTime;
      });
    }

    return result;
  }, [orders, appliedFilters]);

  const managerStats = useMemo(() => buildManagerStats(filteredOrders), [filteredOrders]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <BriefcaseIcon />
          <h2 className="text-lg font-semibold text-slate-800">Order Summary Report</h2>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SearchableSelect
              label="Account Manager"
              allLabel="--Select Account Manager--"
              options={managerOptions}
              value={managerDraft}
              onChange={setManagerDraft}
              searchPlaceholder="Search managers…"
            />

            <div>
              <label className="mb-1 block text-sm text-slate-600">Service</label>
              <select
                value={productDraft}
                onChange={(e) => setProductDraft(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="all">All</option>
                {PRODUCT_NAMES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">Order Amount (₹)</label>
              <div className="rounded-md border border-slate-300 bg-white px-3 py-3 shadow-sm">
                <AmountRangeSlider
                  min={0}
                  max={AMOUNT_MAX_LAKH}
                  minValue={minLakhDraft}
                  maxValue={maxLakhDraft}
                  onChange={(mn, mx) => {
                    setMinLakhDraft(mn);
                    setMaxLakhDraft(mx);
                  }}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-600">Date</label>
              <DateRangePicker value={dateRangeDraft} onChange={setDateRangeDraft} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Status:{" "}
              <span className="mx-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 align-middle text-[9px] font-semibold text-slate-500">
                P
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
              - Rejected , <span className="font-medium text-slate-600">T</span>- Technical,{" "}
              <span className="font-medium text-slate-600">F</span>- Financial,{" "}
              <span className="rounded bg-yellow-200 px-1.5 py-0.5 text-slate-700">Amended</span>
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSearch}
                className="flex items-center gap-1.5 rounded-md border border-teal-300 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.6 4.2l3.6 3.6a1 1 0 01-1.4 1.4l-3.6-3.6A7 7 0 012 9z"
                    clipRule="evenodd"
                  />
                </svg>
                Search
              </button>
              <button
                onClick={handleClear}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Account Manager</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">Total</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">Technical</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">Financial</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">Confirmed</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">Rejected</th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {managerStats.map((stat) => {
              const open = openManagers.has(stat.manager);
              return (
                <Fragment key={stat.manager}>
                  <tr
                    onClick={() => toggleManager(stat.manager)}
                    className="cursor-pointer bg-slate-700 text-white hover:bg-slate-600"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        <ExpandIcon open={open} />
                        {stat.manager}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{stat.total}</td>
                    <td className="px-4 py-3 text-center">{stat.technical}</td>
                    <td className="px-4 py-3 text-center">{stat.financial}</td>
                    <td className="px-4 py-3 text-center">{stat.confirmed}</td>
                    <td className="px-4 py-3 text-center">{stat.rejected}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {stat.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-4 py-4">
                        <ManagerOrdersTable orders={stat.orders} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {managerStats.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No orders match your search/filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
