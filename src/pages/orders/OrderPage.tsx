import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApprovalState, OrderDisplayStage, OrderRecord, StageStatus } from "../../types";
import type { DateRange } from "../../components/DateRangePicker";
import OrderApprovalReview from "./OrderApprovalReview";
import OrderPreviewModal from "../../components/OrderPreviewModal";
import FilterDrawer, { type FilterDrawerCategory } from "../../components/FilterDrawer";
import PaginationFooter from "../../components/PaginationFooter";
import SortArrow from "../../components/SortArrow";
import SearchableSelect from "../../components/SearchableSelect";
import AmountRangeSlider from "../../components/AmountRangeSlider";
import InlineDateRangeCalendar from "../../components/InlineDateRangeCalendar";
import { PRODUCT_NAMES } from "../../products";
import {
  formatDDMMYYYY,
  getDisplayStage,
  getNextActionableStage,
  isAmendmentPending,
  isStuckInRejectedApproval,
  toggleSortState,
  usePagination,
  type ActionableStage,
  type ApprovalStageKey,
  type SortState,
} from "../../utils";

interface OrderPageProps {
  orders: OrderRecord[];
  onUpdateOrder: (record: OrderRecord) => void;
}

// Pending-only: this tab only ever shows orders still awaiting a decision —
// Active/Agreement Over/Closed orders have nothing to approve and never
// appear here. "All" is a combined pending view, kept for consistency with
// every other list page in this app. "amendmentPending" is a carve-out of
// "approvalPending" for amendment successors (see isAmendmentPending in
// utils.ts) — they get their own unified Tech/Fin review here instead of
// mixing into the plain Approval Pending queue.
type ViewTab = "all" | "approvalPending" | "amendmentPending" | "closurePending" | "rejected";

const VIEW_TABS: { key: ViewTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approvalPending", label: "Approval Pending" },
  { key: "amendmentPending", label: "Amendment Pending" },
  { key: "closurePending", label: "Cancellation Pending" },
  { key: "rejected", label: "Rejected" },
];

function matchesTab(order: OrderRecord, tab: ViewTab): boolean {
  if (tab === "all") return true;
  if (tab === "amendmentPending") return isAmendmentPending(order);
  if (tab === "approvalPending") return getDisplayStage(order) === "approvalPending" && !isAmendmentPending(order);
  if (tab === "closurePending") return getDisplayStage(order) === "closurePending";
  return isStuckInRejectedApproval(order); // tab === "rejected"
}

const STAGE_LABELS: Record<OrderDisplayStage, string> = {
  approvalPending: "Approval Pending",
  active: "Active",
  agreementOver: "Agreement Over",
  closurePending: "Cancellation Pending",
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

type SortableKey = "orderNo" | "client" | "product" | "clientManager" | "amount" | "createdOn" | "status";

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
    case "createdOn":
      return a.createdOn.localeCompare(b.createdOn);
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
      className={`sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 font-semibold text-slate-600 ${
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

// Merged into two sections (rather than one category per field) so
// applying several filters doesn't mean re-clicking the left rail for each
// one — General groups the identity selects, Amount & Date groups the two
// range-style filters.
const FILTER_CATEGORIES: FilterDrawerCategory[] = [
  { key: "general", label: "General" },
  { key: "range", label: "Amount & Date" },
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

function EyeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 3.5c-4.4 0-7.9 2.9-9.4 6a1 1 0 000 .9C2.1 13.6 5.6 16.5 10 16.5s7.9-2.9 9.4-6a1 1 0 000-.9C17.9 6.4 14.4 3.5 10 3.5zm0 9.5a3 3 0 110-6 3 3 0 010 6z" />
    </svg>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 2a1 1 0 00-1 1v1H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H8V3a1 1 0 00-1-1zM6 9.7l1.4-1.4L9 9.9l4-4L14.4 7.3 9 12.7 6 9.7z" />
    </svg>
  );
}

// Display-only unless highlighted — stage changes only happen through the
// Process Order form on the review page, one at a time, in order. A
// highlighted badge (the row's current actionable stage, untouched or
// previously rejected) is clickable and jumps straight to that form.
function StageBadge({
  status,
  highlighted,
  onClick,
}: {
  status: ApprovalState;
  highlighted?: boolean;
  onClick?: () => void;
}) {
  const cls =
    status === "confirmed"
      ? "bg-emerald-100 text-emerald-600"
      : status === "rejected"
      ? "bg-rose-100 text-rose-600"
      : "bg-slate-200 text-slate-500";
  const icon = status === "confirmed" ? <CheckIcon /> : status === "rejected" ? <CrossIcon /> : "P";
  const base = `mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${cls}`;

  if (!highlighted) return <span className={base}>{icon}</span>;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Needs your review — click to process"
      className={`${base} ring-2 ring-offset-2 ring-amber-400 animate-pulse hover:ring-amber-500`}
    >
      {icon}
    </button>
  );
}

// "Needs attention now" — the badge for whichever stage
// getNextActionableStage() says is next: untouched-pending (never reviewed)
// or previously rejected (needs re-review).
function needsAttention(actionable: ActionableStage | null, key: ApprovalStageKey, stage: StageStatus): boolean {
  if (actionable?.key !== key) return false;
  return (stage.status === "pending" && stage.date === null) || stage.status === "rejected";
}

// Tech/Fin department tab — approve or reject whatever stage is next
// actionable for an order (Tech/Fin while Approval Pending, TC/FC while
// Closure Pending). Create/Amend/Close all live on the Manage Orders tab —
// this tab only ever approves or rejects.
export default function OrderPage({ orders, onUpdateOrder }: OrderPageProps) {
  // Dashboard tiles/charts land here with ?stage=&q= to open already-filtered
  // instead of always defaulting to "all" — read once on mount, not kept in
  // sync afterward (this page owns its own filter state from here on).
  const [searchParams] = useSearchParams();
  const initialStage = searchParams.get("stage");
  const [tab, setTab] = useState<ViewTab>(
    initialStage === "approvalPending" || initialStage === "closurePending" ? initialStage : "all"
  );
  type ReviewMode = "view" | "process";
  const [reviewTarget, setReviewTarget] = useState<{ id: string; mode: ReviewMode } | null>(null);
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);

  // This tab only ever shows orders still awaiting a Tech/Fin or TC/FC
  // decision — everything downstream (tabs, search, filters, sort) operates
  // over this narrowed set, not the full order list.
  const pendingOrders = useMemo(
    () =>
      orders.filter((o) => {
        const stage = getDisplayStage(o);
        return stage === "approvalPending" || stage === "closurePending";
      }),
    [orders]
  );

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState<SortState<SortableKey>>({ key: null, direction: "asc" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(FILTER_CATEGORIES[0].key);
  const [draft, setDraft] = useState<DrawerFilters>(defaultDrawerFilters);
  const [applied, setApplied] = useState<DrawerFilters>(defaultDrawerFilters);

  const clientOptions = useMemo(() => Array.from(new Set(pendingOrders.map((o) => o.client))).sort(), [pendingOrders]);
  const managerOptions = useMemo(
    () => Array.from(new Set(pendingOrders.map((o) => o.clientManager))).sort(),
    [pendingOrders]
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
    applied.client !== "all" ||
    applied.product !== "all" ||
    applied.manager !== "all" ||
    applied.minLakh !== 0 ||
    applied.maxLakh !== AMOUNT_MAX_LAKH ||
    applied.dateRange.start !== null ||
    applied.dateRange.end !== null;

  // Everything except the tab condition — shared between the main list
  // (tab-filtered on top of this) and the per-tab counts shown on the tab
  // buttons (each tab's own condition applied on top of this same base, so
  // the counts stay live against whatever else is currently filtered/searched).
  const preTabFiltered = useMemo(() => {
    let result = pendingOrders;

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

    return result;
  }, [pendingOrders, applied, search]);

  const tabCounts = useMemo(
    () =>
      Object.fromEntries(
        VIEW_TABS.map((t) => [t.key, preTabFiltered.filter((o) => matchesTab(o, t.key)).length])
      ) as Record<ViewTab, number>,
    [preTabFiltered]
  );

  const filtered = useMemo(() => {
    let result = preTabFiltered.filter((o) => matchesTab(o, tab));

    if (sort.key) {
      const key = sort.key;
      result = [...result].sort((a, b) => {
        const cmp = compareByKey(a, b, key);
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [preTabFiltered, tab, sort]);

  function renderCategoryContent() {
    switch (activeCategory) {
      case "general":
        return (
          <div className="flex flex-col gap-6">
            <SearchableSelect
              label="Client"
              allLabel="All Clients"
              options={clientOptions}
              value={draft.client}
              onChange={(v) => setDraft((prev) => ({ ...prev, client: v }))}
              searchPlaceholder="Search clients…"
            />
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
            <SearchableSelect
              label="Client Manager"
              allLabel="All Managers"
              options={managerOptions}
              value={draft.manager}
              onChange={(v) => setDraft((prev) => ({ ...prev, manager: v }))}
              searchPlaceholder="Search managers…"
            />
          </div>
        );
      case "range":
        return (
          <div className="flex flex-col gap-6">
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
            <div>
              <label className="mb-1 block text-sm text-slate-600">Created On</label>
              <InlineDateRangeCalendar
                value={draft.dateRange}
                onChange={(range) => setDraft((prev) => ({ ...prev, dateRange: range }))}
              />
            </div>
          </div>
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

  const { page, setPage, pageSize, setPageSize, totalPages, pageRows, totalRecords } = usePagination(filtered);

  // Column visibility per tab: TC/FC are meaningless while still Approval
  // Pending or Amendment Pending (cancellation hasn't started, and
  // amendments never use TC/FC at all); Tech/Fin are already both confirmed
  // by definition for anything Cancellation Pending, so showing them again
  // there is just noise. "All" shows every column since rows are a mix.
  const showTechFin = tab !== "closurePending";
  const showTcFc = tab === "all" || tab === "closurePending" || tab === "rejected";
  const badgeColCount = (showTechFin ? 2 : 0) + (showTcFc ? 2 : 0);
  const totalCols = 8 + badgeColCount; // Order#, Client, Product, Manager, Amount, OCD, Status, Action

  const reviewOrder = reviewTarget ? orders.find((o) => o.id === reviewTarget.id) ?? null : null;

  if (reviewOrder && reviewTarget) {
    return (
      <OrderApprovalReview
        order={reviewOrder}
        orders={orders}
        mode={reviewTarget.mode}
        onBack={() => setReviewTarget(null)}
        onUpdateOrder={onUpdateOrder}
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 gap-2">
          {VIEW_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  tab === t.key ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {tabCounts[t.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-64 shrink-0">
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
        are their cancellation-stage counterparts. <span className="font-medium text-slate-600">OCD</span> = Order
        Creation Date. A pulsing circle marks the stage awaiting your decision — click it, or use the Approve/Reject
        action, to process it; approvals happen strictly in order (Tech before Fin, TC before FC).
      </p>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <SortableTh label="Order #" sortKey="orderNo" sort={sort} onClick={toggleSort} />
              <SortableTh label="Client" sortKey="client" sort={sort} onClick={toggleSort} />
              <SortableTh label="Product" sortKey="product" sort={sort} onClick={toggleSort} />
              <SortableTh label="Client Manager" sortKey="clientManager" sort={sort} onClick={toggleSort} />
              <SortableTh label="Amount (₹)" sortKey="amount" sort={sort} onClick={toggleSort} align="right" />
              <SortableTh label="OCD" sortKey="createdOn" sort={sort} onClick={toggleSort} />
              {showTechFin && (
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                  Tech
                </th>
              )}
              {showTechFin && (
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                  Fin
                </th>
              )}
              {showTcFc && (
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                  TC
                </th>
              )}
              {showTcFc && (
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                  FC
                </th>
              )}
              <SortableTh label="Status" sortKey="status" sort={sort} onClick={toggleSort} />
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((order) => {
              const stage = getDisplayStage(order);
              const actionable = getNextActionableStage(order);
              const openProcess = () => setReviewTarget({ id: order.id, mode: "process" });
              return (
                <tr key={order.id} className={`transition-colors ${rowClass(order)}`}>
                  <td className="whitespace-nowrap px-4 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => setPreviewOrderId(order.id)}
                      className="text-indigo-700 hover:underline"
                    >
                      {order.orderNo}
                    </button>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2 text-slate-700" title={order.client}>
                    {order.client}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">{order.product}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">{order.clientManager}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right text-slate-700">
                    {order.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">{formatDDMMYYYY(order.createdOn)}</td>
                  {showTechFin && (
                    <td className="px-4 py-2">
                      <StageBadge
                        status={order.technical.status}
                        highlighted={needsAttention(actionable, "technical", order.technical)}
                        onClick={openProcess}
                      />
                    </td>
                  )}
                  {showTechFin && (
                    <td className="px-4 py-2">
                      <StageBadge
                        status={order.financial.status}
                        highlighted={needsAttention(actionable, "financial", order.financial)}
                        onClick={openProcess}
                      />
                    </td>
                  )}
                  {showTcFc && (
                    <td className="px-4 py-2">
                      <StageBadge
                        status={order.cancellationTechnical.status}
                        highlighted={needsAttention(actionable, "cancellationTechnical", order.cancellationTechnical)}
                        onClick={openProcess}
                      />
                    </td>
                  )}
                  {showTcFc && (
                    <td className="px-4 py-2">
                      <StageBadge
                        status={order.cancellationFinancial.status}
                        highlighted={needsAttention(actionable, "cancellationFinancial", order.cancellationFinancial)}
                        onClick={openProcess}
                      />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isAmendmentPending(order) ? "bg-violet-100 text-violet-800" : STAGE_BADGE_CLASS[stage]
                      }`}
                    >
                      {isAmendmentPending(order) ? "Amendment Pending" : STAGE_LABELS[stage]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setReviewTarget({ id: order.id, mode: "view" })}
                        title="View order"
                        className="text-slate-500 hover:text-slate-700"
                      >
                        <EyeIcon />
                      </button>
                      <button
                        type="button"
                        onClick={openProcess}
                        title="Approve / Reject"
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        <ClipboardCheckIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={totalCols} className="px-4 py-8 text-center text-slate-400">
                  No orders match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        <PaginationFooter
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          totalRecords={totalRecords}
        />
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

      <OrderPreviewModal
        order={previewOrderId ? orders.find((o) => o.id === previewOrderId) ?? null : null}
        orders={orders}
        onClose={() => setPreviewOrderId(null)}
      />
    </div>
  );
}
