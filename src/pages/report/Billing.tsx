import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import { formatDDMMYYYY } from "../../utils";
import type { DateRange } from "../../components/DateRangePicker";
import InlineDateRangeCalendar from "../../components/InlineDateRangeCalendar";
import SearchableSelect from "../../components/SearchableSelect";
import AmountRangeSlider from "../../components/AmountRangeSlider";
import FilterDrawer, { type FilterDrawerCategory } from "../../components/FilterDrawer";
import SortArrow from "../../components/SortArrow";
import OrderPreviewModal from "../../components/OrderPreviewModal";
import { buildFiscalYearColumns, billsInColumn, toggleSortState, type SortState } from "../../utils";

interface BillingProps {
  orders: OrderRecord[];
}

const selectClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

const AMOUNT_MAX_LAKH = 50;

type StatusBucketKey = "technical" | "financial" | "neither";

const STATUS_BUCKETS: { key: StatusBucketKey; label: string }[] = [
  { key: "technical", label: "Technically Cleared" },
  { key: "financial", label: "Financially Cleared" },
  { key: "neither", label: "Neither" },
];

// An order only ever lands in "financial" once technical is confirmed too
// (financial clearance always implies technical clearance), so this bucketing
// naturally keeps the three groups mutually exclusive.
function statusBucketOf(o: OrderRecord): StatusBucketKey {
  if (o.financial.status === "confirmed") return "financial";
  if (o.technical.status === "confirmed") return "technical";
  return "neither";
}


function parseISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function formatDate(iso: string) {
  return iso ? formatDDMMYYYY(iso) : "—";
}

function formatFirstBillingMonth(fbm: string) {
  if (!fbm) return "—";
  const [y, m] = fbm.split("-").map(Number);
  if (!y || !m) return "—";
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

// Amended (archived) and fully cancelled orders are flagged the same way in
// every report table — yellow for amended, red for cancelled. Frozen (sticky
// left) cells need their own matching background since they can't just
// inherit the row's via group-hover the way the rest of the row does.
function rowHighlight(order: OrderRecord): { row: string; frozen: string } {
  if (order.lifecycleStatus === "cancelled") {
    return { row: "group bg-rose-100 hover:bg-rose-200", frozen: "bg-rose-100 group-hover:bg-rose-200" };
  }
  if (order.amended) {
    return { row: "group bg-yellow-100 hover:bg-yellow-200", frozen: "bg-yellow-100 group-hover:bg-yellow-200" };
  }
  return { row: "group hover:bg-slate-50", frozen: "bg-white group-hover:bg-slate-50" };
}

function StageIcon({ confirmed, rejected }: { confirmed: boolean; rejected: boolean }) {
  const wrapClass = confirmed
    ? "bg-emerald-100 text-emerald-600"
    : rejected
    ? "bg-rose-100 text-rose-600"
    : "bg-slate-200 text-slate-400";
  return (
    <span className={`mx-auto flex h-5 w-5 items-center justify-center rounded-full ${wrapClass}`}>
      {confirmed ? (
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
        </svg>
      ) : rejected ? (
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
        </svg>
      ) : (
        <span className="text-xs leading-none">•</span>
      )}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.6 4.2l3.6 3.6a1 1 0 01-1.4 1.4l-3.6-3.6A7 7 0 012 9z"
        clipRule="evenodd"
      />
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

function InfoTooltip({ text }: { text: string }) {
  // Hover reveals it via pure CSS (group-hover); click toggles an
  // independent boolean — kept separate so a real mouse click (which fires
  // its own hover first) can't immediately re-close what the hover opened.
  const [clicked, setClicked] = useState(false);
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={() => setClicked((v) => !v)}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-slate-400 hover:text-slate-600"
        aria-label="Info"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11.5a1 1 0 10-2 0 1 1 0 002 0zM9 9.5a1 1 0 112 0V14a1 1 0 11-2 0V9.5z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <span
        className={`absolute left-1/2 top-full z-30 mt-1.5 w-44 -translate-x-1/2 rounded-md bg-slate-800 px-2.5 py-1.5 text-center text-xs font-normal normal-case text-white shadow-lg group-hover:block ${
          clicked ? "block" : "hidden"
        }`}
      >
        {text}
      </span>
    </span>
  );
}

const FILTER_CATEGORIES: FilterDrawerCategory[] = [
  { key: "client", label: "Client" },
  { key: "product", label: "Product" },
  { key: "manager", label: "Client Manager" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Order Status" },
  { key: "date", label: "Created On" },
];

interface DrawerFilters {
  client: string;
  product: string;
  manager: string;
  minLakh: number;
  maxLakh: number;
  statusBuckets: Set<StatusBucketKey>;
  dateRange: DateRange;
}

const defaultDrawerFilters: DrawerFilters = {
  client: "all",
  product: "all",
  manager: "all",
  minLakh: 0,
  maxLakh: AMOUNT_MAX_LAKH,
  dateRange: { start: null, end: null },
  statusBuckets: new Set(),
};

// Frozen column widths (Client / Order # / Product) and their cumulative
// left offsets, kept in sync between header, total row, and body cells.
const CLIENT_COL = "w-[180px] min-w-[180px] max-w-[180px] left-0";
const ORDERNO_COL = "w-[130px] min-w-[130px] max-w-[130px] left-[180px]";
const PRODUCT_COL = "w-[90px] min-w-[90px] max-w-[90px] left-[310px]";

// Only the 3 frozen columns sort — the 12 rolling fiscal-year month columns
// and the pinned Total row aren't meaningful to sort by.
type SortableKey = "client" | "orderNo" | "product";

function compareByKey(a: OrderRecord, b: OrderRecord, key: SortableKey): number {
  switch (key) {
    case "client":
      return a.client.localeCompare(b.client);
    case "orderNo":
      return a.orderNo.localeCompare(b.orderNo);
    case "product":
      return a.product.localeCompare(b.product);
  }
}

function SortableTh({
  label,
  sortKey,
  sort,
  onClick,
  colClass,
}: {
  label: string;
  sortKey: SortableKey;
  sort: SortState<SortableKey>;
  onClick: (key: SortableKey) => void;
  colClass: string;
}) {
  return (
    <th
      className={`sticky top-0 z-30 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600 ${colClass}`}
    >
      <button onClick={() => onClick(sortKey)} className="flex items-center gap-1.5 hover:text-slate-900">
        {label}
        <SortArrow direction={sort.key === sortKey ? sort.direction : "asc"} active={sort.key === sortKey} />
      </button>
    </th>
  );
}

export default function Billing({ orders }: BillingProps) {
  // The Dashboard's revenue-trend chart lands here with ?product= to open
  // already filtered to whichever product was showing — read once on mount.
  const [searchParams] = useSearchParams();
  const initialProduct = searchParams.get("product");
  const initialFilters: DrawerFilters = initialProduct
    ? { ...defaultDrawerFilters, product: initialProduct }
    : defaultDrawerFilters;

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<SortableKey>>({ key: null, direction: "asc" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(FILTER_CATEGORIES[0].key);
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);

  const [draft, setDraft] = useState<DrawerFilters>(initialFilters);
  const [applied, setApplied] = useState<DrawerFilters>(initialFilters);

  const fyColumns = useMemo(() => buildFiscalYearColumns(new Date()), []);

  const clientOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.client))).sort(), [orders]);
  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  function toggleSort(key: SortableKey) {
    setSort((prev) => toggleSortState(prev, key));
  }

  function toggleDraftBucket(key: StatusBucketKey) {
    setDraft((prev) => {
      const next = new Set(prev.statusBuckets);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, statusBuckets: next };
    });
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
    setDraft(defaultDrawerFilters);
    setApplied(defaultDrawerFilters);
  }

  const hasActiveFilters =
    applied.client !== "all" ||
    applied.product !== "all" ||
    applied.manager !== "all" ||
    applied.minLakh !== 0 ||
    applied.maxLakh !== AMOUNT_MAX_LAKH ||
    applied.statusBuckets.size > 0 ||
    applied.dateRange.start !== null ||
    applied.dateRange.end !== null;

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (applied.client !== "all") result = result.filter((o) => o.client === applied.client);
    if (applied.product !== "all") result = result.filter((o) => o.product === applied.product);
    if (applied.manager !== "all") result = result.filter((o) => o.clientManager === applied.manager);

    const minRupees = applied.minLakh * 100_000;
    const maxRupees = applied.maxLakh >= AMOUNT_MAX_LAKH ? Infinity : applied.maxLakh * 100_000;
    result = result.filter((o) => o.amount >= minRupees && o.amount <= maxRupees);

    if (applied.statusBuckets.size > 0) {
      result = result.filter((o) => applied.statusBuckets.has(statusBucketOf(o)));
    }

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
          o.client.toLowerCase().includes(q) ||
          o.orderNo.toLowerCase().includes(q) ||
          o.clientManager.toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, applied, search]);

  const sortedOrders = useMemo(() => {
    if (!sort.key) return filteredOrders;
    const key = sort.key;
    return [...filteredOrders].sort((a, b) => {
      const cmp = compareByKey(a, b, key);
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredOrders, sort]);

  const rows = useMemo(
    () =>
      sortedOrders.map((o) => {
        const monthly = fyColumns.map((col) => (billsInColumn(o, col) ? o.amount : 0));
        const yearlyTotal = monthly.reduce((a, b) => a + b, 0);
        return { order: o, monthly, yearlyTotal };
      }),
    [sortedOrders, fyColumns]
  );

  const monthTotals = useMemo(
    () => fyColumns.map((_, idx) => rows.reduce((sum, r) => sum + r.monthly[idx], 0)),
    [rows, fyColumns]
  );
  const grandYearlyTotal = monthTotals.reduce((a, b) => a + b, 0);

  const restIdentityColSpan = 8; // Client Manager, T, F, OCD, OSD, FBD, BC, Amount
  const totalColumns = 3 + restIdentityColSpan + fyColumns.length + 1;

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
              <option value="all">All Products</option>
              {PRODUCT_NAMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        );
      case "manager":
        return (
          <SearchableSelect
            label="Client Manager"
            allLabel="All Managers"
            options={managerOptions}
            value={draft.manager}
            onChange={(v) => setDraft((prev) => ({ ...prev, manager: v }))}
            searchPlaceholder="Search managers…"
          />
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
      case "status":
        return (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Order Status</label>
            <div className="flex flex-col gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2.5 shadow-sm">
              {STATUS_BUCKETS.map((b) => (
                <label key={b.key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.statusBuckets.has(b.key)}
                    onChange={() => toggleDraftBucket(b.key)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-1 focus:ring-indigo-400"
                  />
                  {b.label}
                </label>
              ))}
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
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, order #, or manager…"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
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

      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">OCD:</span> Order Creation Date &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">OSD:</span> Order Sign Date &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">FBD:</span> First Billing Date &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">BC:</span> Billing Cycle &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">T:</span> Technically Cleared &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">F:</span> Financially Cleared
      </p>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <SortableTh label="Client" sortKey="client" sort={sort} onClick={toggleSort} colClass={CLIENT_COL} />
              <SortableTh label="Order #" sortKey="orderNo" sort={sort} onClick={toggleSort} colClass={ORDERNO_COL} />
              <SortableTh label="Product" sortKey="product" sort={sort} onClick={toggleSort} colClass={PRODUCT_COL} />
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                Client Manager
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                T
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                F
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                OCD
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                OSD
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                FBD
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                BC
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-right font-semibold text-slate-600">
                <span className="inline-flex items-center justify-end gap-1">
                  Amount (₹)
                  <InfoTooltip text="Amount of each billing cycle" />
                </span>
              </th>
              {fyColumns.map((col) => (
                <th
                  key={`${col.year}-${col.month0}`}
                  className={`sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 px-4 py-2 text-right font-semibold ${
                    col.isCurrent ? "bg-amber-100 text-amber-900" : "bg-slate-50 text-slate-600"
                  }`}
                >
                  {col.label}
                </th>
              ))}
              <th className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-right font-semibold text-slate-600">
                Yearly Total (₹)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="font-semibold text-indigo-900">
              <td colSpan={3} className="sticky left-0 top-9 z-20 whitespace-nowrap bg-indigo-50 px-4 py-2">
                Total Revenue
              </td>
              <td colSpan={restIdentityColSpan} className="sticky top-9 z-10 whitespace-nowrap bg-indigo-50 px-4 py-2" />
              {monthTotals.map((total, idx) => (
                <td
                  key={idx}
                  className={`sticky top-9 z-10 whitespace-nowrap px-4 py-2 text-right ${
                    fyColumns[idx].isCurrent ? "bg-amber-100 text-amber-900" : "bg-indigo-50"
                  }`}
                >
                  {total > 0 ? total.toLocaleString("en-IN") : "—"}
                </td>
              ))}
              <td className="sticky top-9 z-10 whitespace-nowrap bg-indigo-50 px-4 py-2 text-right">
                {grandYearlyTotal.toLocaleString("en-IN")}
              </td>
            </tr>

            {rows.map(({ order, monthly, yearlyTotal }) => {
              const highlight = rowHighlight(order);
              return (
              <tr key={order.id} className={`transition-colors ${highlight.row}`}>
                <td
                  className={`sticky z-10 truncate px-4 py-2 text-slate-700 ${highlight.frozen} ${CLIENT_COL}`}
                  title={order.client}
                >
                  {order.client}
                </td>
                <td className={`sticky z-10 whitespace-nowrap px-4 py-2 font-medium ${highlight.frozen} ${ORDERNO_COL}`}>
                  <button
                    type="button"
                    onClick={() => setPreviewOrderId(order.id)}
                    className="text-indigo-700 hover:underline"
                  >
                    {order.orderNo}
                  </button>
                </td>
                <td className={`sticky z-10 whitespace-nowrap px-4 py-2 text-slate-700 ${highlight.frozen} ${PRODUCT_COL}`}>
                  {order.product}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{order.clientManager}</td>
                <td className="px-4 py-2">
                  <StageIcon
                    confirmed={order.technical.status === "confirmed"}
                    rejected={order.technical.status === "rejected"}
                  />
                </td>
                <td className="px-4 py-2">
                  <StageIcon
                    confirmed={order.financial.status === "confirmed"}
                    rejected={order.financial.status === "rejected"}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{formatDate(order.createdOn)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">{formatDate(order.dateOfSign)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                  {formatFirstBillingMonth(order.details.firstBillingMonth)}
                </td>
                <td
                  className="whitespace-nowrap px-4 py-2 text-slate-700"
                  title={order.billingCycle ? order.billingCycle : ""}
                >
                  {order.billingCycle || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-700">
                  {order.amount.toLocaleString("en-IN")}
                </td>
                {monthly.map((amt, idx) => (
                  <td
                    key={idx}
                    className={`whitespace-nowrap px-4 py-2 text-right text-slate-700 ${
                      fyColumns[idx].isCurrent ? "bg-amber-50" : ""
                    }`}
                  >
                    {amt > 0 ? amt.toLocaleString("en-IN") : "—"}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-800">
                  {yearlyTotal.toLocaleString("en-IN")}
                </td>
              </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={totalColumns} className="px-4 py-8 text-center text-slate-400">
                  No orders match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Billing Filters"
        categories={FILTER_CATEGORIES}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        onClear={handleClear}
        onApply={handleApply}
      >
        {renderCategoryContent()}
      </FilterDrawer>

      <OrderPreviewModal
        order={previewOrderId ? orders.find((o) => o.id === previewOrderId) ?? null : null}
        orders={orders}
        onClose={() => setPreviewOrderId(null)}
      />
    </div>
  );
}
