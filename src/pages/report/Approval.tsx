import { useMemo, useState } from "react";
import { BILLING_CYCLE_LABELS } from "../../types";
import type { OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import type { DateRange } from "../../components/DateRangePicker";
import InlineDateRangeCalendar from "../../components/InlineDateRangeCalendar";
import AmountRangeSlider from "../../components/AmountRangeSlider";
import FilterDrawer, { type FilterDrawerCategory } from "../../components/FilterDrawer";
import SortArrow from "../../components/SortArrow";
import {
  compareNullableDate,
  compareNullableNumber,
  toggleSortState,
  type SortState,
} from "../../utils";

interface ApprovalProps {
  orders: OrderRecord[];
}

type SortableKey = "orderNo" | "client" | "clientManager" | "dateOfSign" | "ocd" | "tc" | "fc" | "total" | "billingCycle" | "amount";

interface LeafColumn {
  key: SortableKey;
  label: string;
}

const leftColumns: LeafColumn[] = [
  { key: "orderNo", label: "Order #" },
  { key: "client", label: "Account" },
  { key: "clientManager", label: "A/C Manager" },
  { key: "dateOfSign", label: "Date of Sign" },
];

const timeTakenColumns: LeafColumn[] = [
  { key: "ocd", label: "OCD" },
  { key: "tc", label: "TC" },
  { key: "fc", label: "FC" },
  { key: "total", label: "Total" },
];

const rightColumns: LeafColumn[] = [
  { key: "billingCycle", label: "BC" },
  { key: "amount", label: "Amt (₹)" },
];

const AMOUNT_MAX_LAKH = 50;

const selectClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

const FILTER_CATEGORIES: FilterDrawerCategory[] = [
  { key: "product", label: "Product" },
  { key: "manager", label: "Manager" },
  { key: "amount", label: "Amount" },
  { key: "date", label: "Creation Date" },
];

interface DrawerFilters {
  product: string;
  manager: string;
  minLakh: number;
  maxLakh: number;
  dateRange: DateRange;
}

const defaultDrawerFilters: DrawerFilters = {
  product: "all",
  manager: "all",
  minLakh: 0,
  maxLakh: AMOUNT_MAX_LAKH,
  dateRange: { start: null, end: null },
};

function FunnelIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 4a1 1 0 011-1h12a1 1 0 01.8 1.6L12 12v4a1 1 0 01-.45.83l-2 1.34A1 1 0 018 17.3V12L3.2 4.6A1 1 0 013 4z" />
    </svg>
  );
}

function parseISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function formatDisplay(d: string | null) {
  if (!d) return null;
  const date = parseISO(d);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(a: string, b: string) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

// Only orders that have cleared both stages ever show up in this report, so
// every row here has non-null technical/financial dates.
function isFullyCleared(order: OrderRecord) {
  return order.technical.status === "confirmed" && order.financial.status === "confirmed";
}

// Amended (archived) orders and fully cancelled ones are flagged the same
// way in every report table — yellow for amended, red for cancelled.
function rowHighlightClass(order: OrderRecord) {
  if (order.lifecycleStatus === "cancelled") return "bg-rose-100 hover:bg-rose-200";
  if (order.amended) return "bg-yellow-100 hover:bg-yellow-200";
  return "hover:bg-slate-50";
}

function DaysCell({ days, date }: { days: number; date: string | null }) {
  return (
    <span className="text-slate-700">
      {days}
      {date && <span className="ml-1 text-slate-400">({formatDisplay(date)})</span>}
    </span>
  );
}

export default function Approval({ orders }: ApprovalProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<SortableKey>>({ key: null, direction: "asc" });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(FILTER_CATEGORIES[0].key);
  const [draft, setDraft] = useState<DrawerFilters>(defaultDrawerFilters);
  const [applied, setApplied] = useState<DrawerFilters>(defaultDrawerFilters);

  const clearedOrders = useMemo(() => orders.filter(isFullyCleared), [orders]);

  const managerOptions = useMemo(
    () => Array.from(new Set(clearedOrders.map((o) => o.clientManager))).sort(),
    [clearedOrders]
  );

  function toggleSort(key: SortableKey) {
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
    setDraft(defaultDrawerFilters);
    setApplied(defaultDrawerFilters);
  }

  const hasActiveFilters =
    applied.product !== "all" ||
    applied.manager !== "all" ||
    applied.minLakh !== 0 ||
    applied.maxLakh !== AMOUNT_MAX_LAKH ||
    applied.dateRange.start !== null ||
    applied.dateRange.end !== null;

  const filtered = useMemo(() => {
    let result: OrderRecord[] = clearedOrders;

    if (applied.product !== "all") {
      result = result.filter((o) => o.product === applied.product);
    }

    if (applied.manager !== "all") {
      result = result.filter((o) => o.clientManager === applied.manager);
    }

    const minRupees = applied.minLakh * 100_000;
    const maxRupees = applied.maxLakh >= AMOUNT_MAX_LAKH ? Infinity : applied.maxLakh * 100_000;
    result = result.filter((o) => o.amount >= minRupees && o.amount <= maxRupees);

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (o) =>
          o.client.toLowerCase().includes(q) ||
          o.orderNo.toLowerCase().includes(q) ||
          o.clientManager.toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q)
      );
    }

    if (applied.dateRange.start && applied.dateRange.end) {
      const startTime = applied.dateRange.start.getTime();
      const endTime = applied.dateRange.end.getTime();
      result = result.filter((o) => {
        const t = parseISO(o.createdOn).getTime();
        return t >= startTime && t <= endTime;
      });
    }

    if (sort.key) {
      const key = sort.key;
      result = [...result].sort((a, b) => {
        const cmp = compareByKey(a, b, key);
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [clearedOrders, search, applied, sort]);

  function renderCategoryContent() {
    switch (activeCategory) {
      case "product":
        return (
          <div>
            <label className="mb-1 block text-sm text-slate-600">Product</label>
            <select
              value={draft.product}
              onChange={(e) => setDraft((prev) => ({ ...prev, product: e.target.value }))}
              className={selectClass}
            >
              <option value="all">All products</option>
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
          <div>
            <label className="mb-1 block text-sm text-slate-600">Manager</label>
            <select
              value={draft.manager}
              onChange={(e) => setDraft((prev) => ({ ...prev, manager: e.target.value }))}
              className={selectClass}
            >
              <option value="all">All managers</option>
              {managerOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
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
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.6 4.2l3.6 3.6a1 1 0 01-1.4 1.4l-3.6-3.6A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by account, order #, or manager…"
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

      <p className="mb-3 text-xs text-slate-500">
        Showing orders that have completed both Technical and Financial clearance. &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">OCD:</span> Order Creation Date &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">TC:</span> Technically Cleared &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">FC:</span> Financially Cleared &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">BC:</span> Billing Cycle (M: Monthly, B: Bi-monthly, Q:
        Quarterly, H: Half-yearly, Y: Yearly, O: One-time)
      </p>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              {leftColumns.map((col) => (
                <th
                  key={col.key}
                  rowSpan={2}
                  className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-left align-middle font-semibold text-slate-600"
                >
                  <SortButton col={col} sort={sort} onClick={toggleSort} />
                </th>
              ))}
              <th
                colSpan={timeTakenColumns.length}
                className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-100 bg-slate-50 px-4 py-2 text-center font-semibold text-indigo-700"
              >
                Time Taken (in days)
              </th>
              {rightColumns.map((col) => (
                <th
                  key={col.key}
                  rowSpan={2}
                  className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-left align-middle font-semibold text-slate-600"
                >
                  <SortButton col={col} sort={sort} onClick={toggleSort} />
                </th>
              ))}
            </tr>
            <tr>
              {timeTakenColumns.map((col) => (
                <th
                  key={col.key}
                  className="sticky top-9 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600"
                >
                  <SortButton col={col} sort={sort} onClick={toggleSort} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((order) => {
              const ocdDays = daysBetween(order.dateOfSign, order.createdOn);
              const tcDays = order.technical.date ? daysBetween(order.createdOn, order.technical.date) : 0;
              const fcDays =
                order.technical.date && order.financial.date
                  ? daysBetween(order.technical.date, order.financial.date)
                  : 0;
              const totalDays = order.financial.date ? daysBetween(order.createdOn, order.financial.date) : 0;

              return (
                <tr key={order.id} className={`transition-colors ${rowHighlightClass(order)}`}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{order.orderNo}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.client}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.clientManager}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDisplay(order.dateOfSign)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <DaysCell days={ocdDays} date={order.createdOn} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <DaysCell days={tcDays} date={order.technical.date} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <DaysCell days={fcDays} date={order.financial.date} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <DaysCell days={totalDays} date={order.financial.date} />
                  </td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-slate-700"
                    title={order.billingCycle ? BILLING_CYCLE_LABELS[order.billingCycle] : ""}
                  >
                    {order.billingCycle || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {order.amount.toLocaleString("en-IN")}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={leftColumns.length + timeTakenColumns.length + rightColumns.length}
                  className="px-4 py-8 text-center text-slate-400"
                >
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
        title="Approval Filters"
        categories={FILTER_CATEGORIES}
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

function SortButton({
  col,
  sort,
  onClick,
}: {
  col: LeafColumn;
  sort: SortState<SortableKey>;
  onClick: (key: SortableKey) => void;
}) {
  return (
    <button onClick={() => onClick(col.key)} className="flex items-center gap-1.5 hover:text-slate-900">
      {col.label}
      <SortArrow direction={sort.key === col.key ? sort.direction : "asc"} active={sort.key === col.key} />
    </button>
  );
}

function compareByKey(a: OrderRecord, b: OrderRecord, key: SortableKey): number {
  switch (key) {
    case "orderNo":
      return a.orderNo.localeCompare(b.orderNo);
    case "client":
      return a.client.localeCompare(b.client);
    case "clientManager":
      return a.clientManager.localeCompare(b.clientManager);
    case "dateOfSign":
      return a.dateOfSign.localeCompare(b.dateOfSign);
    case "ocd":
      return a.createdOn.localeCompare(b.createdOn);
    case "billingCycle":
      return a.billingCycle.localeCompare(b.billingCycle);
    case "amount":
      return a.amount - b.amount;
    case "tc":
      return compareNullableDate(a.technical.date, b.technical.date);
    case "fc":
      return compareNullableDate(a.financial.date, b.financial.date);
    case "total": {
      const ta = a.financial.date ? daysBetween(a.createdOn, a.financial.date) : null;
      const tb = b.financial.date ? daysBetween(b.createdOn, b.financial.date) : null;
      return compareNullableNumber(ta, tb);
    }
    default:
      return 0;
  }
}
