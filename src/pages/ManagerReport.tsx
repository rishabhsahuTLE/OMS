import { Fragment, useMemo, useState } from "react";
import type { ApprovalState, OrderRecord } from "../types";
import { PRODUCT_NAMES } from "../products";
import { formatDDMMYYYY, toggleSortState, type SortState } from "../utils";
import type { DateRange } from "../components/DateRangePicker";
import InlineDateRangeCalendar from "../components/InlineDateRangeCalendar";
import SearchableSelect from "../components/SearchableSelect";
import AmountRangeSlider from "../components/AmountRangeSlider";
import FilterDrawer, { type FilterDrawerCategory } from "../components/FilterDrawer";
import SortArrow from "../components/SortArrow";

interface ManagerReportProps {
  orders: OrderRecord[];
}

const AMOUNT_MAX_LAKH = 50;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const selectClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

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

const OUTER_FILTER_CATEGORIES: FilterDrawerCategory[] = [
  { key: "manager", label: "Account Manager" },
  { key: "product", label: "Product" },
  { key: "amount", label: "Amount" },
  { key: "date", label: "Date" },
];

type OuterSortableKey = "manager" | "total" | "technical" | "financial" | "confirmed" | "rejected" | "amount";

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

function compareManagerStats(a: ManagerStats, b: ManagerStats, key: OuterSortableKey): number {
  switch (key) {
    case "manager":
      return a.manager.localeCompare(b.manager);
    case "total":
      return a.total - b.total;
    case "technical":
      return a.technical - b.technical;
    case "financial":
      return a.financial - b.financial;
    case "confirmed":
      return a.confirmed - b.confirmed;
    case "rejected":
      return a.rejected - b.rejected;
    case "amount":
      return a.amount - b.amount;
  }
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

function FunnelIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 4a1 1 0 011-1h12a1 1 0 01.8 1.6L12 12v4a1 1 0 01-.45.83l-2 1.34A1 1 0 018 17.3V12L3.2 4.6A1 1 0 013 4z" />
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

type InnerSortableKey = "orderNo" | "product" | "client" | "createdOn" | "billingCycle" | "amount";

function compareInnerByKey(a: OrderRecord, b: OrderRecord, key: InnerSortableKey): number {
  switch (key) {
    case "orderNo":
      return a.orderNo.localeCompare(b.orderNo);
    case "product":
      return a.product.localeCompare(b.product);
    case "client":
      return a.client.localeCompare(b.client);
    case "createdOn":
      return a.createdOn.localeCompare(b.createdOn);
    case "billingCycle":
      return a.billingCycle.localeCompare(b.billingCycle);
    case "amount":
      return a.amount - b.amount;
  }
}

interface InnerFilters {
  client: string;
  product: string;
  minLakh: number;
  maxLakh: number;
  dateRange: DateRange;
}

const defaultInnerFilters: InnerFilters = {
  client: "all",
  product: "all",
  minLakh: 0,
  maxLakh: AMOUNT_MAX_LAKH,
  dateRange: { start: null, end: null },
};

const INNER_FILTER_CATEGORIES: FilterDrawerCategory[] = [
  { key: "client", label: "Client" },
  { key: "product", label: "Product" },
  { key: "amount", label: "Amount" },
  { key: "date", label: "Date" },
];

function InnerSortableTh({
  label,
  sortKey,
  sort,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: InnerSortableKey;
  sort: SortState<InnerSortableKey>;
  onClick: (key: InnerSortableKey) => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 font-semibold text-slate-600 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        onClick={() => onClick(sortKey)}
        className={`flex items-center gap-1.5 hover:text-slate-900 ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}
        <SortArrow direction={sort.key === sortKey ? sort.direction : "asc"} active={sort.key === sortKey} />
      </button>
    </th>
  );
}

function ManagerOrdersTable({ orders }: { orders: OrderRecord[] }) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState<InnerSortableKey>>({ key: null, direction: "asc" });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(INNER_FILTER_CATEGORIES[0].key);
  const [draft, setDraft] = useState<InnerFilters>(defaultInnerFilters);
  const [applied, setApplied] = useState<InnerFilters>(defaultInnerFilters);

  const clientOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.client))).sort(), [orders]);

  function toggleSort(key: InnerSortableKey) {
    setSort((prev) => toggleSortState(prev, key));
  }

  function openDrawer() {
    setDraft(applied);
    setDrawerOpen(true);
  }

  function handleApply() {
    setApplied(draft);
    setDrawerOpen(false);
    setPage(1);
  }

  function handleClear() {
    setDraft(defaultInnerFilters);
    setApplied(defaultInnerFilters);
    setPage(1);
  }

  const hasActiveFilters =
    applied.client !== "all" ||
    applied.product !== "all" ||
    applied.minLakh !== 0 ||
    applied.maxLakh !== AMOUNT_MAX_LAKH ||
    applied.dateRange.start !== null ||
    applied.dateRange.end !== null;

  const filtered = useMemo(() => {
    let result = orders;

    if (applied.client !== "all") result = result.filter((o) => o.client === applied.client);
    if (applied.product !== "all") result = result.filter((o) => o.product === applied.product);

    const minRupees = applied.minLakh * 100_000;
    const maxRupees = applied.maxLakh >= AMOUNT_MAX_LAKH ? Infinity : applied.maxLakh * 100_000;
    result = result.filter((o) => o.amount >= minRupees && o.amount <= maxRupees);

    if (applied.dateRange.start && applied.dateRange.end) {
      const startTime = applied.dateRange.start.getTime();
      const endTime = applied.dateRange.end.getTime();
      result = result.filter((o) => {
        const t = parseISO(o.createdOn).getTime();
        return t >= startTime && t <= endTime;
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q) ||
          o.client.toLowerCase().includes(q)
      );
    }

    if (sort.key) {
      const key = sort.key;
      result = [...result].sort((a, b) => {
        const cmp = compareInnerByKey(a, b, key);
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [orders, applied, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(filtered.length, currentPage * pageSize);

  function renderCategoryContent() {
    switch (activeCategory) {
      case "client":
        return (
          <SearchableSelect
            label="Client"
            allLabel="All Clients"
            options={clientOptions}
            value={draft.client}
            onChange={(v) => setDraft((prev) => ({ ...prev, client: v }))}
            searchPlaceholder="Search clients…"
          />
        );
      case "product":
        return (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Product</label>
            <select
              value={draft.product}
              onChange={(e) => setDraft((prev) => ({ ...prev, product: e.target.value }))}
              className={selectClass}
            >
              <option value="all">All</option>
              {PRODUCT_NAMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        );
      case "amount":
        return (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Amount</label>
            <div className="rounded-md border border-slate-300 bg-white px-3 py-3 shadow-sm">
              <AmountRangeSlider
                min={0}
                max={AMOUNT_MAX_LAKH}
                minValue={draft.minLakh}
                maxValue={draft.maxLakh}
                onChange={(mn, mx) => setDraft((prev) => ({ ...prev, minLakh: mn, maxLakh: mx }))}
              />
            </div>
          </div>
        );
      case "date":
        return (
          <InlineDateRangeCalendar
            value={draft.dateRange}
            onChange={(range) => setDraft((prev) => ({ ...prev, dateRange: range }))}
          />
        );
      default:
        return null;
    }
  }

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

        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={openDrawer}
            className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label="Open filters"
          >
            <FunnelIcon />
            {hasActiveFilters && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-indigo-500" />}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <InnerSortableTh label="Order #" sortKey="orderNo" sort={sort} onClick={toggleSort} />
              <InnerSortableTh label="Product" sortKey="product" sort={sort} onClick={toggleSort} />
              <InnerSortableTh label="Account" sortKey="client" sort={sort} onClick={toggleSort} />
              <InnerSortableTh label="Created On" sortKey="createdOn" sort={sort} onClick={toggleSort} />
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-center font-semibold text-slate-600">T</th>
              <th className="sticky top-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-center font-semibold text-slate-600">F</th>
              <InnerSortableTh label="Billing Cycle" sortKey="billingCycle" sort={sort} onClick={toggleSort} />
              <InnerSortableTh label="Amount" sortKey="amount" sort={sort} onClick={toggleSort} align="right" />
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

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Order Filters"
        categories={INNER_FILTER_CATEGORIES}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        onClear={handleClear}
        onApply={handleApply}
      >
        {renderCategoryContent()}
      </FilterDrawer>
    </div>
  );
}

export default function ManagerReport({ orders }: ManagerReportProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(OUTER_FILTER_CATEGORIES[0].key);
  const [draft, setDraft] = useState<Filters>(defaultFilters);
  const [applied, setApplied] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState<SortState<OuterSortableKey>>({ key: null, direction: "asc" });
  const [openManagers, setOpenManagers] = useState<Set<string>>(new Set());

  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  function toggleSort(key: OuterSortableKey) {
    setSort((prev) => toggleSortState(prev, key));
  }

  function openDrawer() {
    setDraft(applied);
    setDrawerOpen(true);
  }

  function handleApply() {
    setApplied(draft);
    setDrawerOpen(false);
  }

  function handleClear() {
    setDraft(defaultFilters);
    setApplied(defaultFilters);
  }

  const hasActiveFilters =
    applied.manager !== "all" ||
    applied.product !== "all" ||
    applied.minLakh !== 0 ||
    applied.maxLakh !== AMOUNT_MAX_LAKH ||
    applied.dateRange.start !== null ||
    applied.dateRange.end !== null;

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
    if (applied.manager !== "all") result = result.filter((o) => o.clientManager === applied.manager);
    if (applied.product !== "all") result = result.filter((o) => o.product === applied.product);

    const minRupees = applied.minLakh * 100_000;
    const maxRupees = applied.maxLakh >= AMOUNT_MAX_LAKH ? Infinity : applied.maxLakh * 100_000;
    result = result.filter((o) => o.amount >= minRupees && o.amount <= maxRupees);

    if (applied.dateRange.start && applied.dateRange.end) {
      const startTime = applied.dateRange.start.getTime();
      const endTime = applied.dateRange.end.getTime();
      result = result.filter((o) => {
        const t = parseISO(o.createdOn).getTime();
        return t >= startTime && t <= endTime;
      });
    }

    return result;
  }, [orders, applied]);

  const managerStats = useMemo(() => {
    const stats = buildManagerStats(filteredOrders);
    if (!sort.key) return stats;
    const key = sort.key;
    return [...stats].sort((a, b) => {
      const cmp = compareManagerStats(a, b, key);
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredOrders, sort]);

  function renderCategoryContent() {
    switch (activeCategory) {
      case "manager":
        return (
          <SearchableSelect
            label="Account Manager"
            allLabel="--Select Account Manager--"
            options={managerOptions}
            value={draft.manager}
            onChange={(v) => setDraft((prev) => ({ ...prev, manager: v }))}
            searchPlaceholder="Search managers…"
          />
        );
      case "product":
        return (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Service</label>
            <select
              value={draft.product}
              onChange={(e) => setDraft((prev) => ({ ...prev, product: e.target.value }))}
              className={selectClass}
            >
              <option value="all">All</option>
              {PRODUCT_NAMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        );
      case "amount":
        return (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Order Amount (₹)</label>
            <div className="rounded-md border border-slate-300 bg-white px-3 py-3 shadow-sm">
              <AmountRangeSlider
                min={0}
                max={AMOUNT_MAX_LAKH}
                minValue={draft.minLakh}
                maxValue={draft.maxLakh}
                onChange={(mn, mx) => setDraft((prev) => ({ ...prev, minLakh: mn, maxLakh: mx }))}
              />
            </div>
          </div>
        );
      case "date":
        return (
          <InlineDateRangeCalendar
            value={draft.dateRange}
            onChange={(range) => setDraft((prev) => ({ ...prev, dateRange: range }))}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <BriefcaseIcon />
            <h2 className="text-lg font-semibold text-slate-800">Order Summary Report</h2>
          </div>
          <button
            type="button"
            onClick={openDrawer}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label="Open filters"
          >
            <FunnelIcon />
            {hasActiveFilters && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-indigo-500" />}
          </button>
        </div>

        <p className="px-6 py-3 text-xs text-slate-500">
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
      </div>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                <button onClick={() => toggleSort("manager")} className="flex items-center gap-1.5 hover:text-slate-900">
                  Account Manager
                  <SortArrow direction={sort.key === "manager" ? sort.direction : "asc"} active={sort.key === "manager"} />
                </button>
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                <button onClick={() => toggleSort("total")} className="mx-auto flex items-center gap-1.5 hover:text-slate-900">
                  Total
                  <SortArrow direction={sort.key === "total" ? sort.direction : "asc"} active={sort.key === "total"} />
                </button>
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                <button onClick={() => toggleSort("technical")} className="mx-auto flex items-center gap-1.5 hover:text-slate-900">
                  Technical
                  <SortArrow direction={sort.key === "technical" ? sort.direction : "asc"} active={sort.key === "technical"} />
                </button>
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                <button onClick={() => toggleSort("financial")} className="mx-auto flex items-center gap-1.5 hover:text-slate-900">
                  Financial
                  <SortArrow direction={sort.key === "financial" ? sort.direction : "asc"} active={sort.key === "financial"} />
                </button>
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                <button onClick={() => toggleSort("confirmed")} className="mx-auto flex items-center gap-1.5 hover:text-slate-900">
                  Confirmed
                  <SortArrow direction={sort.key === "confirmed" ? sort.direction : "asc"} active={sort.key === "confirmed"} />
                </button>
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                <button onClick={() => toggleSort("rejected")} className="mx-auto flex items-center gap-1.5 hover:text-slate-900">
                  Rejected
                  <SortArrow direction={sort.key === "rejected" ? sort.direction : "asc"} active={sort.key === "rejected"} />
                </button>
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600">
                <button onClick={() => toggleSort("amount")} className="ml-auto flex items-center gap-1.5 hover:text-slate-900">
                  Amount
                  <SortArrow direction={sort.key === "amount" ? sort.direction : "asc"} active={sort.key === "amount"} />
                </button>
              </th>
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

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Manager Report Filters"
        categories={OUTER_FILTER_CATEGORIES}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        onClear={handleClear}
        onApply={handleApply}
      >
        {renderCategoryContent()}
      </FilterDrawer>
    </div>
  );
}
