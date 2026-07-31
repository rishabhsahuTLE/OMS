import { useMemo, useState } from "react";
import type { ApprovalState, OrderDisplayStage, OrderRecord } from "../../types";
import type { DateRange } from "../../components/DateRangePicker";
import OrderApprovalReview from "./OrderApprovalReview";
import FilterDrawer, { type FilterDrawerCategory } from "../../components/FilterDrawer";
import SortArrow from "../../components/SortArrow";
import SearchableSelect from "../../components/SearchableSelect";
import AmountRangeSlider from "../../components/AmountRangeSlider";
import InlineDateRangeCalendar from "../../components/InlineDateRangeCalendar";
import { PRODUCT_NAMES } from "../../products";
import { getDisplayStage, toggleSortState, type SortState } from "../../utils";

interface OrderPageProps {
  orders: OrderRecord[];
  onUpdateOrder: (record: OrderRecord) => void;
}

type ViewTab = "all" | OrderDisplayStage;

const VIEW_TABS: { key: ViewTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approvalPending", label: "Approval Pending" },
  { key: "active", label: "Active" },
  { key: "agreementOver", label: "Agreement Over" },
  { key: "closurePending", label: "Closure Pending" },
  { key: "closed", label: "Closed" },
];

const STAGE_LABELS: Record<OrderDisplayStage, string> = {
  approvalPending: "Approval Pending",
  active: "Active",
  agreementOver: "Agreement Over",
  closurePending: "Closure Pending",
  closed: "Closed",
};

const STAGE_BADGE_CLASS: Record<OrderDisplayStage, string> = {
  approvalPending: "bg-slate-200 text-slate-700",
  active: "bg-emerald-100 text-emerald-700",
  agreementOver: "bg-orange-100 text-orange-700",
  closurePending: "bg-amber-100 text-amber-800",
  closed: "bg-rose-200 text-rose-800",
};

// Chronological rank so the Status column sorts by lifecycle progress, not
// alphabetically.
const STAGE_RANK: Record<OrderDisplayStage, number> = {
  approvalPending: 0,
  active: 1,
  agreementOver: 2,
  closurePending: 3,
  closed: 4,
};

const AMOUNT_MAX_LAKH = 50;

type SortableKey = "orderNo" | "client" | "product" | "clientManager" | "amount" | "status";

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
    case "amount":
      return a.amount - b.amount;
    case "status":
      return STAGE_RANK[getDisplayStage(a)] - STAGE_RANK[getDisplayStage(b)];
  }
}

function SortableTh({
  label,
  sortKey,
  sort,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortableKey;
  sort: SortState<SortableKey>;
  onClick: (key: SortableKey) => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 font-semibold text-slate-600 ${
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

const FILTER_CATEGORIES: FilterDrawerCategory[] = [
  { key: "client", label: "Client" },
  { key: "product", label: "Product" },
  { key: "manager", label: "Client Manager" },
  { key: "amount", label: "Amount" },
  { key: "date", label: "Created On" },
];

interface DrawerFilters {
  client: string;
  product: string;
  manager: string;
  minLakh: number;
  maxLakh: number;
  dateRange: DateRange;
}

const defaultDrawerFilters: DrawerFilters = {
  client: "all",
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

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5a2 2 0 01-.878.507l-3 .857a.5.5 0 01-.618-.618l.857-3a2 2 0 01.507-.878l8.5-8.5z" />
    </svg>
  );
}

// Display-only — stage changes only happen through the Process Order form
// on the review page, one at a time, in order.
function StageBadge({ status }: { status: ApprovalState }) {
  const cls =
    status === "confirmed"
      ? "bg-emerald-100 text-emerald-600"
      : status === "rejected"
      ? "bg-rose-100 text-rose-600"
      : "bg-slate-200 text-slate-500";
  return (
    <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${cls}`}>
      {status === "confirmed" ? <CheckIcon /> : status === "rejected" ? <CrossIcon /> : "P"}
    </span>
  );
}

// Tech/Fin department tab — approve or reject whatever stage is next
// actionable for an order (Tech/Fin while Approval Pending, TC/FC while
// Closure Pending). Create/Amend/Close all live on the Manage Orders tab —
// this tab only ever approves or rejects.
export default function OrderPage({ orders, onUpdateOrder }: OrderPageProps) {
  const [tab, setTab] = useState<ViewTab>("all");
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState<SortableKey>>({ key: null, direction: "asc" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(FILTER_CATEGORIES[0].key);
  const [draft, setDraft] = useState<DrawerFilters>(defaultDrawerFilters);
  const [applied, setApplied] = useState<DrawerFilters>(defaultDrawerFilters);

  const clientOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.client))).sort(), [orders]);
  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

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
    applied.client !== "all" ||
    applied.product !== "all" ||
    applied.manager !== "all" ||
    applied.minLakh !== 0 ||
    applied.maxLakh !== AMOUNT_MAX_LAKH ||
    applied.dateRange.start !== null ||
    applied.dateRange.end !== null;

  const filtered = useMemo(() => {
    let result = tab === "all" ? orders : orders.filter((o) => getDisplayStage(o) === tab);

    if (applied.client !== "all") result = result.filter((o) => o.client === applied.client);
    if (applied.product !== "all") result = result.filter((o) => o.product === applied.product);
    if (applied.manager !== "all") result = result.filter((o) => o.clientManager === applied.manager);

    const minRupees = applied.minLakh * 100_000;
    const maxRupees = applied.maxLakh >= AMOUNT_MAX_LAKH ? Infinity : applied.maxLakh * 100_000;
    result = result.filter((o) => o.amount >= minRupees && o.amount <= maxRupees);

    if (applied.dateRange.start && applied.dateRange.end) {
      const startTime = applied.dateRange.start.getTime();
      const endTime = applied.dateRange.end.getTime();
      result = result.filter((o) => {
        const [y, m, d] = o.createdOn.split("-").map(Number);
        const t = new Date(y, m - 1, d).getTime();
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

    if (sort.key) {
      const key = sort.key;
      result = [...result].sort((a, b) => {
        const cmp = compareByKey(a, b, key);
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [orders, tab, applied, search, sort]);

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
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
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

  function rowClass(order: OrderRecord) {
    if (order.lifecycleStatus === "cancelled") return "bg-rose-100 hover:bg-rose-200";
    if (order.amended) return "bg-yellow-100 hover:bg-yellow-200";
    return "hover:bg-slate-50";
  }

  const reviewOrder = reviewOrderId ? orders.find((o) => o.id === reviewOrderId) ?? null : null;

  if (reviewOrder) {
    return <OrderApprovalReview order={reviewOrder} orders={orders} onBack={() => setReviewOrderId(null)} onUpdateOrder={onUpdateOrder} />;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-2">
        {VIEW_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-slate-800 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
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
        <span className="font-medium text-slate-600">Tech</span> — Technical Approval and{" "}
        <span className="font-medium text-slate-600">Fin</span> — Financial Approval decide activation;{" "}
        <span className="font-medium text-slate-600">TC</span>/<span className="font-medium text-slate-600">FC</span>{" "}
        are their closure-stage counterparts. Open a row's Review action to approve or reject; approvals happen
        strictly in order (Tech before Fin, TC before FC).
      </p>

      <div className="flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <SortableTh label="Order #" sortKey="orderNo" sort={sort} onClick={toggleSort} />
              <SortableTh label="Client" sortKey="client" sort={sort} onClick={toggleSort} />
              <SortableTh label="Product" sortKey="product" sort={sort} onClick={toggleSort} />
              <SortableTh label="Client Manager" sortKey="clientManager" sort={sort} onClick={toggleSort} />
              <SortableTh label="Amount (₹)" sortKey="amount" sort={sort} onClick={toggleSort} align="right" />
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                Tech
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                Fin
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                TC
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-center font-semibold text-slate-600">
                FC
              </th>
              <SortableTh label="Status" sortKey="status" sort={sort} onClick={toggleSort} />
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((order) => {
              const stage = getDisplayStage(order);
              return (
                <tr key={order.id} className={`transition-colors ${rowClass(order)}`}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">{order.orderNo}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-700" title={order.client}>
                    {order.client}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.product}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{order.clientManager}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {order.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge status={order.technical.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge status={order.financial.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge status={order.cancellationTechnical.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge status={order.cancellationFinancial.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_BADGE_CLASS[stage]}`}>
                      {STAGE_LABELS[stage]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setReviewOrderId(order.id)}
                      title="Review & process"
                      className="text-teal-600 hover:text-teal-800"
                    >
                      <EditIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                  No orders match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Order Filters"
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
