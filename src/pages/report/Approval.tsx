import { useMemo, useState } from "react";
import { BILLING_CYCLE_LABELS } from "../../types";
import type { OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import DateRangePicker, { type DateRange } from "../../components/DateRangePicker";
import AmountRangeSlider from "../../components/AmountRangeSlider";

interface ApprovalProps {
  orders: OrderRecord[];
}

type SortableKey = "orderNo" | "client" | "clientManager" | "dateOfSign" | "ocd" | "tc" | "fc" | "total" | "billingCycle" | "amount";

type SortDirection = "asc" | "desc";

interface SortState {
  key: SortableKey | null;
  direction: SortDirection;
}

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

function SortArrow({ direction, active }: { direction: SortDirection; active: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${direction === "desc" ? "rotate-180" : ""} ${
        active ? "text-indigo-600" : "text-slate-400"
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M10 5l5 6H5l5-6z" />
    </svg>
  );
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
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [productFilter, setProductFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [minLakh, setMinLakh] = useState(0);
  const [maxLakh, setMaxLakh] = useState(AMOUNT_MAX_LAKH);
  const [sort, setSort] = useState<SortState>({ key: null, direction: "asc" });

  const clearedOrders = useMemo(() => orders.filter(isFullyCleared), [orders]);

  const managerOptions = useMemo(
    () => Array.from(new Set(clearedOrders.map((o) => o.clientManager))).sort(),
    [clearedOrders]
  );

  function toggleSort(key: SortableKey) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  }

  const filtered = useMemo(() => {
    let result: OrderRecord[] = clearedOrders;

    if (productFilter !== "all") {
      result = result.filter((o) => o.product === productFilter);
    }

    if (managerFilter !== "all") {
      result = result.filter((o) => o.clientManager === managerFilter);
    }

    const minRupees = minLakh * 100_000;
    const maxRupees = maxLakh >= AMOUNT_MAX_LAKH ? Infinity : maxLakh * 100_000;
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

    if (dateRange.start && dateRange.end) {
      const startTime = dateRange.start.getTime();
      const endTime = dateRange.end.getTime();
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
  }, [clearedOrders, search, dateRange, productFilter, managerFilter, minLakh, maxLakh, sort]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <label className="mb-1 block text-sm text-slate-600">Search</label>
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

        <div>
          <label className="mb-1 block text-sm text-slate-600">Creation Date</label>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Product</label>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="all">All products</option>
            {PRODUCT_NAMES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Manager</label>
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="all">All managers</option>
            {managerOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-600">Amount</label>
          <div className="w-56 rounded-md border border-slate-300 bg-white px-3 py-3 shadow-sm">
            <AmountRangeSlider
              min={0}
              max={AMOUNT_MAX_LAKH}
              minValue={minLakh}
              maxValue={maxLakh}
              onChange={(mn, mx) => {
                setMinLakh(mn);
                setMaxLakh(mx);
              }}
            />
          </div>
        </div>
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
                <tr key={order.id} className="hover:bg-slate-50">
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
    </div>
  );
}

function SortButton({
  col,
  sort,
  onClick,
}: {
  col: LeafColumn;
  sort: SortState;
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

function compareNullableDate(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

function compareNullableNumber(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}
