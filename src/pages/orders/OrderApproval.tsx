import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ApprovalState, CancellationDetails, Client, OrderDisplayStage, OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import CreateOrderModal from "./CreateOrderModal";
import CancellationConfirm from "./CancellationConfirm";
import OrderPreviewModal from "../../components/OrderPreviewModal";
import ConfirmDialog from "../../components/ConfirmDialog";
import FilterDrawer, { type FilterDrawerCategory } from "../../components/FilterDrawer";
import PaginationFooter from "../../components/PaginationFooter";
import SortArrow from "../../components/SortArrow";
import SearchableSelect from "../../components/SearchableSelect";
import AmountRangeSlider from "../../components/AmountRangeSlider";
import InlineDateRangeCalendar from "../../components/InlineDateRangeCalendar";
import type { DateRange } from "../../components/DateRangePicker";
import {
  baseOrderNo,
  canInitiateClose,
  getDisplayStage,
  getNextActionableStage,
  hasPendingAmendment,
  initiateClosure,
  toggleSortState,
  usePagination,
  type SortState,
} from "../../utils";

interface OrderApprovalProps {
  orders: OrderRecord[];
  onUpdateOrder: (record: OrderRecord) => void;
  // Create used to be its own tab — it now lives behind the "Create" button
  // here, rendered exactly as it was, just toggled locally instead of routed.
  clients: Client[];
  onUpdateClient: (record: Client) => void;
  onCreateOrder: (record: OrderRecord) => void;
  createOrderPrefill: { clientId: string; product: string } | null;
  createOrderKey: number;
  onResetCreateOrder: () => void;
}

interface PendingAmendment {
  original: OrderRecord;
  updated: OrderRecord;
  nextOrderNo: string;
}

// "Pending" is a merged display label covering both approvalPending and
// closurePending — the two underlying OrderDisplayStage values stay
// distinct (see matchesTab below and utils.ts's getDisplayStage) since real
// filtering/branching logic elsewhere still needs them; only the tab/badge
// text merges here. The separate Approvals tab (OrderPage.tsx) keeps these
// two split into their own named tabs, since it needs the distinction.
type ViewTab = "all" | "pending" | "active" | "agreementOver" | "closed";

const VIEW_TABS: { key: ViewTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "active", label: "Active" },
  { key: "agreementOver", label: "Agreement Over" },
  { key: "closed", label: "Closed" },
];

function matchesTab(order: OrderRecord, tab: ViewTab): boolean {
  if (tab === "all") return true;
  const stage = getDisplayStage(order);
  if (tab === "pending") return stage === "approvalPending" || stage === "closurePending";
  return stage === tab;
}

// Legacy deep-links (Dashboard tiles) pass ?stage=approvalPending or
// ?stage=closurePending — both now land on the merged "pending" tab.
function normalizeTab(raw: string | null): ViewTab {
  if (raw === "approvalPending" || raw === "closurePending") return "pending";
  if (raw === "active" || raw === "agreementOver" || raw === "closed") return raw;
  return "all";
}

const STAGE_LABELS: Record<OrderDisplayStage, string> = {
  approvalPending: "Pending",
  active: "Active",
  agreementOver: "Agreement Over",
  closurePending: "Pending",
  closed: "Closed",
};

const STAGE_BADGE_CLASS: Record<OrderDisplayStage, string> = {
  approvalPending: "bg-amber-100 text-amber-800",
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

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 5l-6 5 6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11.5a1 1 0 10-2 0 1 1 0 002 0zM9 9.5a1 1 0 112 0V14a1 1 0 11-2 0V9.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface NextStepInfo {
  message: string;
}

// What the Status info popover tells the user for a given order — the next
// concrete thing that has to happen before it moves further.
function nextStepInfo(order: OrderRecord): NextStepInfo {
  const stage = getDisplayStage(order);

  if (stage === "approvalPending") {
    const next = getNextActionableStage(order);
    return { message: next ? `Next step: awaiting ${next.label} approval.` : "Awaiting activation." };
  }

  if (stage === "active") {
    return { message: "This order is Active. No approval action is needed unless you amend or close it." };
  }

  if (stage === "agreementOver") {
    return {
      message: "This order's agreement period has ended. No approval action is needed unless you amend or close it.",
    };
  }

  if (stage === "closurePending") {
    const next = getNextActionableStage(order);
    return { message: next ? `Next step: awaiting ${next.label} approval.` : "Awaiting cancellation to complete." };
  }

  return { message: "This order is Closed." };
}

// Display-only — stage changes only happen through the Approvals tab, one at
// a time, in order.
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

export default function OrderApproval({
  orders,
  onUpdateOrder,
  clients,
  onUpdateClient,
  onCreateOrder,
  createOrderPrefill,
  createOrderKey,
  onResetCreateOrder,
}: OrderApprovalProps) {
  // Dashboard tiles/charts land here with ?stage=&q= to open already-filtered
  // instead of always defaulting to "all" — read once on mount, not kept in
  // sync afterward (this page owns its own filter state from here on).
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<ViewTab>(() => normalizeTab(searchParams.get("stage")));
  const [creating, setCreating] = useState(false);
  const [openInfoOrderId, setOpenInfoOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderRecord | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [pendingAmendment, setPendingAmendment] = useState<PendingAmendment | null>(null);
  const [cancelBatch, setCancelBatch] = useState<OrderRecord[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
  const [actionMenuOrderId, setActionMenuOrderId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // A single row-action dropdown (Amend/Cancel) is open at a time — close it
  // on any click outside its own trigger+menu wrapper, same pattern as
  // SearchableSelect's outside-click handling.
  useEffect(() => {
    if (!actionMenuOrderId) return;
    function handleClickOutside(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuOrderId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionMenuOrderId]);

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
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
    let result = orders.filter((o) => matchesTab(o, tab));

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

  const { page, setPage, pageSize, setPageSize, totalPages, pageRows, totalRecords } = usePagination(filtered);

  // Only closeable orders on the current page are selectable — Select All
  // only ever touches the checkboxes actually visible on this page.
  const closeableFiltered = useMemo(() => pageRows.filter((o) => canInitiateClose(o)), [pageRows]);
  const allCloseableSelected = closeableFiltered.length > 0 && closeableFiltered.every((o) => selectedIds.has(o.id));

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
      if (allCloseableSelected) {
        const next = new Set(prev);
        closeableFiltered.forEach((o) => next.delete(o.id));
        return next;
      }
      return new Set([...prev, ...closeableFiltered.map((o) => o.id)]);
    });
  }

  function rowClass(order: OrderRecord) {
    if (order.lifecycleStatus === "cancelled") return "bg-rose-100 hover:bg-rose-200";
    if (order.amended) return "bg-yellow-100 hover:bg-yellow-200";
    return "hover:bg-slate-50";
  }

  function closeOrderModal() {
    setOrderModalOpen(false);
    setEditingOrder(null);
  }

  function handleAmendClick(order: OrderRecord) {
    setEditingOrder(order);
    setOrderModalOpen(true);
  }

  // University clients only ever get one order per product — if Create hits
  // that duplicate guard, it hands the existing order back here. Since
  // Amend lives in this same tab now, just switch straight into editing it —
  // no cross-tab jump needed.
  function handleRequestAmendFromDuplicate(order: OrderRecord) {
    setCreating(false);
    handleAmendClick(order);
  }

  // The CreateOrderModal's "onUpdate" for the Amend flow. When the order
  // being edited is active, don't commit yet — stash it and let
  // confirmAmendment (behind the ConfirmDialog below) do the actual
  // two-order mutation once the user confirms. Anything not yet active
  // (e.g. reached via the duplicate-order handoff, before ever activating)
  // has no "live" version to preserve, so it's just updated in place with no
  // confirmation needed.
  function handleModalUpdate(updatedRecord: OrderRecord) {
    const original = orders.find((o) => o.id === updatedRecord.id);
    if (original && original.lifecycleStatus === "active") {
      const base = baseOrderNo(original.orderNo);
      const priorVersions = orders
        .filter((o) => baseOrderNo(o.orderNo) === base && o.orderNo.includes("/"))
        .map((o) => parseInt(o.orderNo.split("/")[1], 10))
        .filter((n) => !Number.isNaN(n));
      const nextVersion = priorVersions.length > 0 ? Math.max(...priorVersions) + 1 : 1;
      setPendingAmendment({ original, updated: updatedRecord, nextOrderNo: `${base}/${nextVersion}` });
    } else {
      onUpdateOrder(updatedRecord);
      setEditingOrder(null);
    }
  }

  // Confirmed: spawn the successor at "inactive" (Amendment Pending, on the
  // Approvals tab) linked back via `supersedes` — this is the *only* review
  // the whole amendment gets, one unified Tech/Fin approval. The predecessor
  // is left fully untouched (still "active", still usable) until that
  // approval clears; it's never independently sent through its own TC/FC —
  // see resolveAmendmentOf in utils.ts, wired through App.tsx, which
  // cancels it in the same pass once the successor goes Active.
  function confirmAmendment() {
    if (!pendingAmendment) return;
    const { original, updated, nextOrderNo } = pendingAmendment;
    onCreateOrder({
      ...updated,
      id: `ord-${Math.random().toString(36).slice(2, 10)}`,
      orderNo: nextOrderNo,
      amended: true,
      supersedes: original.id,
      lifecycleStatus: "inactive",
      technical: { status: "pending", date: null },
      financial: { status: "pending", date: null },
      cancellationTechnical: { status: "pending", date: null },
      cancellationFinancial: { status: "pending", date: null },
      // Fresh successor, not yet activated — billing hasn't started
      // regardless of what the predecessor's own billing status was.
      billingStatus: "notOpened",
      billingOpenedOn: null,
      billingClosedOn: null,
    });
    setPendingAmendment(null);
    setEditingOrder(null);
    setOrderModalOpen(false);
  }

  function cancelPendingAmendment() {
    setPendingAmendment(null);
  }

  function handleCancelConfirm(batch: OrderRecord[], details: CancellationDetails) {
    batch.forEach((o) => onUpdateOrder(initiateClosure(o, details)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      batch.forEach((o) => next.delete(o.id));
      return next;
    });
    setCancelBatch(null);
  }

  // Shared by the top batch-select "Cancel" button and each row's individual
  // Cancel action — both just build a batch and open CancellationConfirm.
  function openCancelBatch(batch: OrderRecord[]) {
    if (batch.length > 0) setCancelBatch(batch);
  }

  // Same CreateOrderModal, same embedded rendering, same props it had as its
  // own tab — only the entry point (a button here instead of a sidebar tab)
  // changed.
  if (creating) {
    return (
      <div className="flex h-full flex-col gap-4">
        <button
          onClick={() => setCreating(false)}
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <BackIcon />
          Back to Manage Orders
        </button>
        <CreateOrderModal
          key={createOrderKey}
          open
          embedded
          clients={clients}
          orders={orders}
          prefillClientId={createOrderPrefill?.clientId}
          prefillProduct={createOrderPrefill?.product}
          onCreate={onCreateOrder}
          onUpdate={onUpdateOrder}
          onUpdateClient={onUpdateClient}
          onClose={() => {}}
          onReset={onResetCreateOrder}
          onRequestAmend={handleRequestAmendFromDuplicate}
        />
      </div>
    );
  }

  if (cancelBatch) {
    return (
      <CancellationConfirm
        orders={cancelBatch}
        allOrders={orders}
        onBack={() => setCancelBatch(null)}
        onConfirm={handleCancelConfirm}
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

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => openCancelBatch(orders.filter((o) => selectedIds.has(o.id) && canInitiateClose(o)))}
            disabled={selectedIds.size === 0}
            className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <PlusIcon />
            Create
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">Tech</span> — Technical Approval and{" "}
        <span className="font-medium text-slate-600">Fin</span> — Financial Approval decide activation;{" "}
        <span className="font-medium text-slate-600">TC</span>/<span className="font-medium text-slate-600">FC</span>{" "}
        are their cancellation-stage counterparts. Statuses are shown here for reference only — approvals/rejections
        happen on the Approvals tab, strictly in order (Tech before Fin, TC before FC).
      </p>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-20 w-10 bg-slate-50 px-4 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allCloseableSelected}
                  onChange={toggleSelectAll}
                  disabled={closeableFiltered.length === 0}
                  className="h-4 w-4"
                />
              </th>
              <SortableTh label="Order #" sortKey="orderNo" sort={sort} onClick={toggleSort} />
              <SortableTh label="Client" sortKey="client" sort={sort} onClick={toggleSort} />
              <SortableTh label="Product" sortKey="product" sort={sort} onClick={toggleSort} />
              <SortableTh label="Client Manager" sortKey="clientManager" sort={sort} onClick={toggleSort} />
              <SortableTh label="Amount (₹)" sortKey="amount" sort={sort} onClick={toggleSort} align="right" />
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                Tech
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                Fin
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                TC
              </th>
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-center font-semibold text-slate-600">
                FC
              </th>
              <SortableTh label="Status" sortKey="status" sort={sort} onClick={toggleSort} />
              <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((order) => {
              const stage = getDisplayStage(order);
              // Suppressed while an amendment against this order is already
              // pending — its predecessor stays "active" the whole time
              // (see confirmAmendment/resolveAmendmentOf), so without this
              // guard a second amendment or a manual cancel could race with
              // the pending one.
              const pendingAmendmentAgainstThis = hasPendingAmendment(order, orders);
              const canAmend = order.lifecycleStatus === "active" && !pendingAmendmentAgainstThis;
              const canClose = canInitiateClose(order) && !pendingAmendmentAgainstThis;
              return (
                <tr key={order.id} className={`transition-colors ${rowClass(order)}`}>
                  <td className="px-4 py-2">
                    {canClose ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleRow(order.id)}
                        className="h-4 w-4"
                      />
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
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
                  <td className="px-4 py-2">
                    <StageBadge status={order.technical.status} />
                  </td>
                  <td className="px-4 py-2">
                    <StageBadge status={order.financial.status} />
                  </td>
                  <td className="px-4 py-2">
                    <StageBadge status={order.cancellationTechnical.status} />
                  </td>
                  <td className="px-4 py-2">
                    <StageBadge status={order.cancellationFinancial.status} />
                  </td>
                  <td className="relative whitespace-nowrap px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_BADGE_CLASS[stage]}`}>
                        {STAGE_LABELS[stage]}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenInfoOrderId((id) => (id === order.id ? null : order.id))}
                        title="What's next?"
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <InfoIcon />
                      </button>
                    </div>
                    {openInfoOrderId === order.id &&
                      (() => {
                        const info = nextStepInfo(order);
                        return (
                          <div className="absolute left-4 top-full z-30 mt-1 w-72 rounded-md border border-slate-200 bg-white p-3 text-left text-xs font-normal normal-case text-slate-600 shadow-lg">
                            <p>{info.message}</p>
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => setOpenInfoOrderId(null)}
                                className="rounded-md bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {canAmend || canClose ? (
                      <div
                        ref={actionMenuOrderId === order.id ? actionMenuRef : undefined}
                        className="relative inline-block text-left"
                      >
                        <button
                          type="button"
                          onClick={() => setActionMenuOrderId((id) => (id === order.id ? null : order.id))}
                          className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Actions
                          <ChevronDownIcon />
                        </button>
                        {actionMenuOrderId === order.id && (
                          <div className="absolute left-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                            {canAmend && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuOrderId(null);
                                  handleAmendClick(order);
                                }}
                                className="block w-full px-3 py-2 text-left text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                              >
                                Amend
                              </button>
                            )}
                            {canClose && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuOrderId(null);
                                  openCancelBatch([order]);
                                }}
                                className="block w-full px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
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

      <CreateOrderModal
        open={orderModalOpen}
        onClose={closeOrderModal}
        clients={clients}
        orders={orders}
        editingOrder={editingOrder}
        onCreate={onCreateOrder}
        onUpdate={handleModalUpdate}
        onUpdateClient={onUpdateClient}
        onRequestAmend={handleAmendClick}
      />

      <ConfirmDialog
        open={pendingAmendment !== null}
        title="Confirm Amendment"
        message={
          pendingAmendment
            ? `${pendingAmendment.nextOrderNo} will be created as an Amendment Pending item on the Approvals tab, needing a single Tech/Fin approval. ${pendingAmendment.original.orderNo} stays fully Active and usable until then — no separate approval needed on it. Once Tech and Fin are both confirmed, ${pendingAmendment.nextOrderNo} becomes Active (sent to Close Billing's To Open) and ${pendingAmendment.original.orderNo} is Cancelled (sent to Close Billing's To Close).`
            : ""
        }
        confirmLabel="Confirm Amendment"
        onConfirm={confirmAmendment}
        onCancel={cancelPendingAmendment}
      />

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
