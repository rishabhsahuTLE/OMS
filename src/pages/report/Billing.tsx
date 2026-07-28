import { useMemo, useState } from "react";
import type { BillingCycle, OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import { formatDDMMYYYY } from "../../utils";
import DateRangePicker, { type DateRange } from "../../components/DateRangePicker";
import SearchableSelect from "../../components/SearchableSelect";
import AmountRangeSlider from "../../components/AmountRangeSlider";

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

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// One recurring billing amount every N months; "O" (one-time) and unset
// cycles are handled separately as a single occurrence.
const CYCLE_STEP: Partial<Record<BillingCycle, number>> = { M: 1, B: 2, Q: 3, H: 6, Y: 12 };

interface FyColumn {
  year: number;
  month0: number;
  label: string;
}

function buildFiscalYearColumns(reference: Date): FyColumn[] {
  const fyStartYear = reference.getMonth() >= 6 ? reference.getFullYear() : reference.getFullYear() - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const month0 = (6 + i) % 12;
    const year = fyStartYear + Math.floor((6 + i) / 12);
    return { year, month0, label: MONTH_ABBR[month0] };
  });
}

// Does this order bill its `amount` in the given fiscal-year column, based on
// its first billing month, billing cycle, and agreement length (in months)?
function billsInColumn(order: OrderRecord, col: FyColumn): boolean {
  const fbm = order.details.firstBillingMonth;
  if (!fbm) return false;
  const [fy, fm] = fbm.split("-").map(Number);
  if (!fy || !fm) return false;

  const startIdx = fy * 12 + (fm - 1);
  const colIdx = col.year * 12 + col.month0;
  if (colIdx < startIdx) return false;

  const diff = colIdx - startIdx;
  const agreementMonths = order.details.agreement;
  if (agreementMonths != null && diff >= agreementMonths) return false;

  const cycle = order.billingCycle;
  if (!cycle || cycle === "O") return diff === 0;
  const step = CYCLE_STEP[cycle] ?? 1;
  return diff % step === 0;
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

function FunnelIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 4a1 1 0 011-1h12a1 1 0 01.8 1.6L12 12v4a1 1 0 01-.45.83l-2 1.34A1 1 0 018 17.3V12L3.2 4.6A1 1 0 013 4z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M5.2 7.2a1 1 0 011.4 0L10 10.6l3.4-3.4a1 1 0 111.4 1.4l-4.1 4.1a1 1 0 01-1.4 0L5.2 8.6a1 1 0 010-1.4z" clipRule="evenodd" />
    </svg>
  );
}

export default function Billing({ orders }: BillingProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [minLakh, setMinLakh] = useState(0);
  const [maxLakh, setMaxLakh] = useState(AMOUNT_MAX_LAKH);
  const [statusBuckets, setStatusBuckets] = useState<Set<StatusBucketKey>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });

  const fyColumns = useMemo(() => buildFiscalYearColumns(new Date()), []);

  const clientOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.client))).sort(), [orders]);
  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  function toggleBucket(key: StatusBucketKey) {
    setStatusBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearAllFilters() {
    setClientFilter("all");
    setProductFilter("all");
    setManagerFilter("all");
    setMinLakh(0);
    setMaxLakh(AMOUNT_MAX_LAKH);
    setStatusBuckets(new Set());
    setDateRange({ start: null, end: null });
  }

  const hasActiveFilters =
    clientFilter !== "all" ||
    productFilter !== "all" ||
    managerFilter !== "all" ||
    minLakh !== 0 ||
    maxLakh !== AMOUNT_MAX_LAKH ||
    statusBuckets.size > 0 ||
    dateRange.start !== null ||
    dateRange.end !== null;

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (clientFilter !== "all") result = result.filter((o) => o.client === clientFilter);
    if (productFilter !== "all") result = result.filter((o) => o.product === productFilter);
    if (managerFilter !== "all") result = result.filter((o) => o.clientManager === managerFilter);

    const minRupees = minLakh * 100_000;
    const maxRupees = maxLakh >= AMOUNT_MAX_LAKH ? Infinity : maxLakh * 100_000;
    result = result.filter((o) => o.amount >= minRupees && o.amount <= maxRupees);

    if (statusBuckets.size > 0) {
      result = result.filter((o) => statusBuckets.has(statusBucketOf(o)));
    }

    if (dateRange.start && dateRange.end) {
      const startTime = dateRange.start.getTime();
      const endTime = dateRange.end.getTime();
      result = result.filter((o) => {
        const t = parseISO(o.createdOn).getTime();
        return t >= startTime && t <= endTime;
      });
    }

    return result;
  }, [orders, clientFilter, productFilter, managerFilter, minLakh, maxLakh, statusBuckets, dateRange]);

  const rows = useMemo(
    () =>
      filteredOrders.map((o) => {
        const monthly = fyColumns.map((col) => (billsInColumn(o, col) ? o.amount : 0));
        const yearlyTotal = monthly.reduce((a, b) => a + b, 0);
        return { order: o, monthly, yearlyTotal };
      }),
    [filteredOrders, fyColumns]
  );

  const monthTotals = useMemo(
    () => fyColumns.map((_, idx) => rows.reduce((sum, r) => sum + r.monthly[idx], 0)),
    [rows, fyColumns]
  );
  const grandYearlyTotal = monthTotals.reduce((a, b) => a + b, 0);

  const identityColSpan = 11;
  const totalColumns = identityColSpan + fyColumns.length + 1;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-6 py-4 text-left text-sm font-semibold text-slate-700"
        >
          <FunnelIcon />
          Filters
          {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />}
          <ChevronIcon open={filtersOpen} />
        </button>

        {filtersOpen && (
          <div className="border-t border-slate-100 px-6 py-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <SearchableSelect
                label="Client"
                allLabel="All Clients"
                options={clientOptions}
                value={clientFilter}
                onChange={setClientFilter}
                searchPlaceholder="Search clients…"
              />

              <div>
                <label className="mb-1 block text-sm text-slate-600">Product</label>
                <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className={selectClass}>
                  <option value="all">All Products</option>
                  {PRODUCT_NAMES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <SearchableSelect
                label="Client Manager"
                allLabel="All Managers"
                options={managerOptions}
                value={managerFilter}
                onChange={setManagerFilter}
                searchPlaceholder="Search managers…"
              />

              <div>
                <label className="mb-1 block text-sm text-slate-600">Amount</label>
                <div className="rounded-md border border-slate-300 bg-white px-3 py-3 shadow-sm">
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

              <div>
                <label className="mb-1 block text-sm text-slate-600">Order Status</label>
                <div className="flex flex-col gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2.5 shadow-sm">
                  {STATUS_BUCKETS.map((b) => (
                    <label key={b.key} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={statusBuckets.has(b.key)}
                        onChange={() => toggleBucket(b.key)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-1 focus:ring-indigo-400"
                      />
                      {b.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-600">Creation Date</label>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <button type="button" onClick={clearAllFilters} className="text-sm text-slate-500 hover:text-slate-700">
                Clear all filters
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Hide Filters
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">OCD:</span> Order Creation Date &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">OSD:</span> Order Sign Date &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">FBD:</span> First Billing Date &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">BC:</span> Billing Cycle &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">T:</span> Technically Cleared &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">F:</span> Financially Cleared
      </p>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">
                Client
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">
                Order #
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">
                Product
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">
                Client Manager
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-center font-semibold text-slate-600">
                T
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-center font-semibold text-slate-600">
                F
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">
                OCD
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">
                OSD
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">
                FBD
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">
                BC
              </th>
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-600">
                Amount (₹)
              </th>
              {fyColumns.map((col) => (
                <th
                  key={`${col.year}-${col.month0}`}
                  className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-600"
                >
                  {col.label}
                </th>
              ))}
              <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-600">
                Yearly Total (₹)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="bg-indigo-50/60 font-semibold text-indigo-900">
              <td colSpan={identityColSpan} className="whitespace-nowrap px-4 py-3">
                Total Revenue
              </td>
              {monthTotals.map((total, idx) => (
                <td key={idx} className="whitespace-nowrap px-4 py-3 text-right">
                  {total > 0 ? total.toLocaleString("en-IN") : "—"}
                </td>
              ))}
              <td className="whitespace-nowrap px-4 py-3 text-right">{grandYearlyTotal.toLocaleString("en-IN")}</td>
            </tr>

            {rows.map(({ order, monthly, yearlyTotal }) => (
              <tr key={order.id} className="hover:bg-slate-50">
                <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={order.client}>
                  {order.client}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{order.orderNo}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.product}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.clientManager}</td>
                <td className="px-4 py-3">
                  <StageIcon
                    confirmed={order.technical.status === "confirmed"}
                    rejected={order.technical.status === "rejected"}
                  />
                </td>
                <td className="px-4 py-3">
                  <StageIcon
                    confirmed={order.financial.status === "confirmed"}
                    rejected={order.financial.status === "rejected"}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(order.createdOn)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(order.dateOfSign)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {formatFirstBillingMonth(order.details.firstBillingMonth)}
                </td>
                <td
                  className="whitespace-nowrap px-4 py-3 text-slate-700"
                  title={order.billingCycle ? order.billingCycle : ""}
                >
                  {order.billingCycle || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {order.amount.toLocaleString("en-IN")}
                </td>
                {monthly.map((amt, idx) => (
                  <td key={idx} className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {amt > 0 ? amt.toLocaleString("en-IN") : "—"}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-800">
                  {yearlyTotal.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}

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
  );
}
