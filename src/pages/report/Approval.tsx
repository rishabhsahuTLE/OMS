import { useMemo, useState } from "react";
import { BILLING_CYCLE_LABELS } from "../../types";
import type { OrderRecord, OrderStatusFilter, StageStatus } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import DateRangePicker, { type DateRange } from "../../components/DateRangePicker";

interface ApprovalProps {
  orders: OrderRecord[];
}

type SortableKey =
  | "orderNo"
  | "client"
  | "product"
  | "clientManager"
  | "dateOfSign"
  | "ocd"
  | "tc"
  | "fc"
  | "total"
  | "billingCycle"
  | "amount";

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
  { key: "client", label: "Client" },
  { key: "product", label: "Product" },
  { key: "clientManager", label: "Client Manager" },
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

function isClosed(order: OrderRecord) {
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

function ClearanceCell({ stage, sinceDate }: { stage: StageStatus; sinceDate: string }) {
  const days = stage.status === "confirmed" && stage.date ? daysBetween(sinceDate, stage.date) : null;

  const iconWrapClass =
    stage.status === "confirmed"
      ? "bg-emerald-100 text-emerald-600"
      : stage.status === "rejected"
      ? "bg-rose-100 text-rose-600"
      : "bg-slate-200 text-slate-400";

  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}>
        {stage.status === "confirmed" ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
          </svg>
        ) : stage.status === "rejected" ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
          </svg>
        ) : (
          <span className="text-xs leading-none">•</span>
        )}
      </span>
      <span
        className={
          stage.status === "confirmed"
            ? "text-slate-700"
            : stage.status === "rejected"
            ? "text-rose-500"
            : "text-slate-400 italic"
        }
      >
        {stage.status === "confirmed" && stage.date ? (
          <>
            {days} days <span className="text-slate-400">({formatDisplay(stage.date)})</span>
          </>
        ) : stage.status === "rejected" ? (
          "Rejected"
        ) : (
          "Pending"
        )}
      </span>
    </div>
  );
}

export default function Approval({ orders }: ApprovalProps) {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [sort, setSort] = useState<SortState>({ key: null, direction: "asc" });

  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  function toggleSort(key: SortableKey) {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
    });
  }

  const filtered = useMemo(() => {
    let result: OrderRecord[] = orders;

    if (statusFilter !== "all") {
      result = result.filter((o) => (statusFilter === "closed" ? isClosed(o) : !isClosed(o)));
    }

    if (productFilter !== "all") {
      result = result.filter((o) => o.product === productFilter);
    }

    if (managerFilter !== "all") {
      result = result.filter((o) => o.clientManager === managerFilter);
    }

    const minAmountNum = minAmount.trim() === "" ? null : Number(minAmount);
    if (minAmountNum !== null && !Number.isNaN(minAmountNum)) {
      result = result.filter((o) => o.amount >= minAmountNum);
    }

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
  }, [orders, search, dateRange, statusFilter, productFilter, managerFilter, minAmount, sort]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatusFilter)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="all">All</option>
          <option value="closed">Closed</option>
          <option value="open">Open</option>
        </select>

        <div className="relative min-w-[220px] flex-1">
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
            placeholder="Search by client, order #, or manager…"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        <DateRangePicker value={dateRange} onChange={setDateRange} />

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

        <input
          type="number"
          min={0}
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          placeholder="Min amount (₹)"
          className="w-36 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      <p className="mb-3 text-xs text-slate-500">
        <span className="font-medium text-slate-600">OCD:</span> Order Creation Date &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">TC:</span> Technically Cleared &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">FC:</span> Financially Cleared &nbsp;·&nbsp;
        <span className="font-medium text-slate-600">BC:</span> Billing Cycle (M: Monthly, B: Bi-monthly, Q:
        Quarterly, H: Half-yearly, Y: Yearly, O: One-time)
      </p>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {leftColumns.map((col) => (
                <th
                  key={col.key}
                  rowSpan={2}
                  className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left align-middle font-semibold text-slate-600"
                >
                  <SortButton col={col} sort={sort} onClick={toggleSort} />
                </th>
              ))}
              <th
                colSpan={timeTakenColumns.length}
                className="whitespace-nowrap border-b border-slate-100 px-4 py-2 text-center font-semibold text-indigo-700"
              >
                Time Taken (in days)
              </th>
              {rightColumns.map((col) => (
                <th
                  key={col.key}
                  rowSpan={2}
                  className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-left align-middle font-semibold text-slate-600"
                >
                  <SortButton col={col} sort={sort} onClick={toggleSort} />
                </th>
              ))}
            </tr>
            <tr>
              {timeTakenColumns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap border-b border-slate-200 px-4 py-2 text-left font-semibold text-slate-600"
                >
                  <SortButton col={col} sort={sort} onClick={toggleSort} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((order) => {
              const total =
                order.financial.date && order.createdOn
                  ? daysBetween(order.createdOn, order.financial.date)
                  : null;
              return (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{order.orderNo}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.client}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.product}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.clientManager}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDisplay(order.dateOfSign)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {daysBetween(order.dateOfSign, order.createdOn)} days{" "}
                    <span className="text-slate-400">({formatDisplay(order.createdOn)})</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <ClearanceCell stage={order.technical} sinceDate={order.createdOn} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <ClearanceCell stage={order.financial} sinceDate={order.technical.date ?? order.createdOn} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                    {total !== null ? (
                      <>
                        {total} days <span className="text-slate-400">({formatDisplay(order.financial.date)})</span>
                      </>
                    ) : (
                      <span className="text-slate-400 italic">Pending</span>
                    )}
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
    case "product":
      return a.product.localeCompare(b.product);
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
