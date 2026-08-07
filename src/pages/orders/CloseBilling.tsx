import { useMemo, useState } from "react";
import type { BillingStatus, OrderRecord } from "../../types";
import { formatDDMMYYYY, todayISO, usePagination } from "../../utils";
import { PRODUCT_NAMES } from "../../products";
import ConfirmDialog from "../../components/ConfirmDialog";
import PaginationFooter from "../../components/PaginationFooter";
import OrderPreviewModal from "../../components/OrderPreviewModal";
import BillingActionConfirm from "./BillingActionConfirm";
import FilterDrawer, { type FilterDrawerCategory } from "../../components/FilterDrawer";
import SearchableSelect from "../../components/SearchableSelect";
import AmountRangeSlider from "../../components/AmountRangeSlider";
import InlineDateRangeCalendar from "../../components/InlineDateRangeCalendar";
import type { DateRange } from "../../components/DateRangePicker";

interface CloseBillingProps {
  orders: OrderRecord[];
  onUpdateOrder: (record: OrderRecord) => void;
}

type BillingViewTab = "toOpen" | "toClose" | "closed";

const VIEW_TABS: { key: BillingViewTab; label: string }[] = [
  { key: "toOpen", label: "To Open" },
  { key: "toClose", label: "To Close" },
  { key: "closed", label: "Closed" },
];

// Finance-owned billing closure, entirely separate from the Tech/Fin/TC/FC
// approval chain: an activated order's billing has to be explicitly Opened
// before it runs, and a cancelled order's billing has to be explicitly
// Closed once cancellation finishes — this tab is where both happen, plus a
// "Closed" bucket to catch and reverse mistakes.
function toOpenFilter(o: OrderRecord): boolean {
  return o.lifecycleStatus === "active" && o.billingStatus === "notOpened";
}
function toCloseFilter(o: OrderRecord): boolean {
  return o.lifecycleStatus === "cancelled" && o.billingStatus === "open";
}
function closedFilter(o: OrderRecord): boolean {
  return o.billingStatus === "closed";
}

const TAB_FILTERS: Record<BillingViewTab, (o: OrderRecord) => boolean> = {
  toOpen: toOpenFilter,
  toClose: toCloseFilter,
  closed: closedFilter,
};

const BILLING_BADGE_LABEL: Record<BillingStatus, string> = {
  notOpened: "Not Opened",
  open: "Open",
  closed: "Closed",
};

const BILLING_BADGE_CLASS: Record<BillingStatus, string> = {
  notOpened: "bg-slate-200 text-slate-600",
  open: "bg-emerald-100 text-emerald-700",
  closed: "bg-rose-200 text-rose-800",
};

function BillingStatusBadge({ status }: { status: BillingStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${BILLING_BADGE_CLASS[status]}`}>
      {BILLING_BADGE_LABEL[status]}
    </span>
  );
}

function rowClass(order: OrderRecord) {
  if (order.lifecycleStatus === "cancelled") return "bg-rose-100 hover:bg-rose-200";
  if (order.amended) return "bg-yellow-100 hover:bg-yellow-200";
  return "hover:bg-slate-50";
}

interface PendingAction {
  order: OrderRecord;
  kind: "open" | "close" | "reopen";
}

const ACTION_LABEL: Record<PendingAction["kind"], string> = {
  open: "Open Billing",
  close: "Close Billing",
  reopen: "Reopen",
};

// Open starts a fresh window (today -> ongoing). Close ends the current
// window today, leaving its start date untouched. Reopen undoes a mistaken
// close — it clears the end date but keeps the original start date, rather
// than starting a new window, since the closure being reversed was itself
// the mistake.
function applyBillingAction(order: OrderRecord, kind: PendingAction["kind"]): OrderRecord {
  const today = todayISO();
  if (kind === "open") {
    return { ...order, billingStatus: "open", billingOpenedOn: today, billingClosedOn: null };
  }
  if (kind === "close") {
    return { ...order, billingStatus: "closed", billingClosedOn: today };
  }
  return { ...order, billingStatus: "open", billingClosedOn: null };
}

const ACTION_DESCRIPTION: Record<PendingAction["kind"], string> = {
  open: "These orders will be marked as billing Open.",
  close: "These orders will be marked as billing Closed.",
  reopen: 'These orders will be reopened and moved back to "To Close" — their cancellation status is not affected.',
};

const AMOUNT_MAX_LAKH = 50;

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

export default function CloseBilling({ orders, onUpdateOrder }: CloseBillingProps) {
  const [tab, setTab] = useState<BillingViewTab>("toOpen");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<OrderRecord[] | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(FILTER_CATEGORIES[0].key);
  const [draft, setDraft] = useState<DrawerFilters>(defaultDrawerFilters);
  const [applied, setApplied] = useState<DrawerFilters>(defaultDrawerFilters);

  const clientOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.client))).sort(), [orders]);
  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

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
    let result = orders.filter(TAB_FILTERS[tab]);

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
        (o) => o.client.toLowerCase().includes(q) || o.orderNo.toLowerCase().includes(q) || o.clientManager.toLowerCase().includes(q)
      );
    }

    return result;
  }, [orders, tab, applied, search]);

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

  const { page, setPage, pageSize, setPageSize, totalPages, pageRows, totalRecords } = usePagination(filtered);

  const showApprovedOn = tab === "toOpen";
  const showCancelledOn = tab === "toClose";
  const totalCols = 8 + (showApprovedOn ? 1 : 0) + (showCancelledOn ? 1 : 0);

  function actionFor(): PendingAction["kind"] {
    return tab === "toOpen" ? "open" : tab === "toClose" ? "close" : "reopen";
  }

  // Switching tabs changes which orders are even eligible for the current
  // selection's action, so the checklist starts fresh on every tab switch —
  // same reasoning as why the selection is scoped to one action at a time.
  function selectTab(next: BillingViewTab) {
    setTab(next);
    setSelectedIds(new Set());
  }

  const allSelected = pageRows.length > 0 && pageRows.every((o) => selectedIds.has(o.id));

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
      if (allSelected) {
        const next = new Set(prev);
        pageRows.forEach((o) => next.delete(o.id));
        return next;
      }
      return new Set([...prev, ...pageRows.map((o) => o.id)]);
    });
  }

  function confirmMessage(action: PendingAction): string {
    if (action.kind === "open") return `Open billing for ${action.order.orderNo}? Its billing status will move to Open.`;
    if (action.kind === "close")
      return `Close billing for ${action.order.orderNo}? Its billing status will move to Closed.`;
    return `Reopen billing for ${action.order.orderNo}? This does not affect its cancellation status — it will move back to "To Close".`;
  }

  function handleConfirm() {
    if (!pending) return;
    onUpdateOrder(applyBillingAction(pending.order, pending.kind));
    setPending(null);
  }

  function handleBatchConfirm(selected: OrderRecord[]) {
    const kind = actionFor();
    selected.forEach((o) => onUpdateOrder(applyBillingAction(o, kind)));
    setSelectedIds(new Set());
    setBatch(null);
  }

  if (batch) {
    const kind = actionFor();
    return (
      <BillingActionConfirm
        orders={batch}
        allOrders={orders}
        actionLabel={ACTION_LABEL[kind]}
        description={ACTION_DESCRIPTION[kind]}
        onBack={() => setBatch(null)}
        onConfirm={handleBatchConfirm}
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
              onClick={() => selectTab(t.key)}
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
            onClick={() => {
              const selected = orders.filter((o) => selectedIds.has(o.id));
              if (selected.length > 0) setBatch(selected);
            }}
            disabled={selectedIds.size === 0}
            className="rounded-md border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ACTION_LABEL[actionFor()]}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">To Open</span> — activated orders whose billing hasn't started
        yet. <span className="font-medium text-slate-600">To Close</span> — cancelled orders (both TC and FC
        confirmed) still awaiting billing closure. <span className="font-medium text-slate-600">Closed</span> —
        billing already closed; reopening one sends it back to "To Close" without affecting its cancellation status.
      </p>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 w-10 bg-slate-50 px-4 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={pageRows.length === 0}
                    className="h-4 w-4"
                  />
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Order #
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Client
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Product
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Client Manager
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-right font-semibold text-slate-600">
                  Amount (₹)
                </th>
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Billing Status
                </th>
                {showApprovedOn && (
                  <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                    Approved On
                  </th>
                )}
                {showCancelledOn && (
                  <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                    Cancelled On
                  </th>
                )}
                <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-4 py-2 text-left font-semibold text-slate-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((order) => {
                const kind = actionFor();
                return (
                  <tr key={order.id} className={`transition-colors ${rowClass(order)}`}>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleRow(order.id)}
                        className="h-4 w-4"
                      />
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
                    <td className="whitespace-nowrap px-4 py-2">
                      <BillingStatusBadge status={order.billingStatus} />
                    </td>
                    {showApprovedOn && (
                      <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                        {order.financial.date ? formatDDMMYYYY(order.financial.date) : "—"}
                      </td>
                    )}
                    {showCancelledOn && (
                      <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                        {order.cancellationFinancial.date ? formatDDMMYYYY(order.cancellationFinancial.date) : "—"}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setPending({ order, kind })}
                        className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        {ACTION_LABEL[kind]}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={totalCols} className="px-4 py-8 text-center text-slate-400">
                    No orders in this view.
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

      <ConfirmDialog
        open={pending !== null}
        title={pending ? ACTION_LABEL[pending.kind] : ""}
        message={pending ? confirmMessage(pending) : ""}
        confirmLabel={pending ? ACTION_LABEL[pending.kind] : ""}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />

      <OrderPreviewModal
        order={previewOrderId ? orders.find((o) => o.id === previewOrderId) ?? null : null}
        orders={orders}
        onClose={() => setPreviewOrderId(null)}
      />

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Close Billing Filters"
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
