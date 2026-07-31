import { useState } from "react";
import type { BillingCycle, CancellationDetails, OrderDisplayStage, OrderRecord, OrderRecordDetails } from "./types";
import { BILLING_CYCLE_LABELS } from "./types";
import { getProduct } from "./products";

export const CURRENT_USER_EMAIL = "pranita.kambli@teamlease.com";

export function deriveCreatedByName(email: string) {
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDDMMYYYY(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function todayISO() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

export function daysBetween(a: string, b: string) {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// One recurring billing amount every N months; "O" (one-time) and unset
// cycles are handled separately as a single occurrence.
export const CYCLE_STEP: Partial<Record<BillingCycle, number>> = { M: 1, B: 2, Q: 3, H: 6, Y: 12 };

export interface FyColumn {
  year: number;
  month0: number;
  label: string;
  isCurrent: boolean;
}

// Standard Indian fiscal year: April through March.
export function buildFiscalYearColumns(reference: Date): FyColumn[] {
  const fyStartYear = reference.getMonth() >= 3 ? reference.getFullYear() : reference.getFullYear() - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const month0 = (3 + i) % 12;
    const year = fyStartYear + Math.floor((3 + i) / 12);
    const isCurrent = year === reference.getFullYear() && month0 === reference.getMonth();
    return { year, month0, label: MONTH_ABBR[month0], isCurrent };
  });
}

// Does this order bill its `amount` in the given fiscal-year column, based on
// its first billing month, billing cycle, and agreement length (in months)?
export function billsInColumn(order: OrderRecord, col: FyColumn): boolean {
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

// Every billing occurrence of `order` from its first billing month up to (and
// including) `reference`'s month, bounded by agreement length if set — used
// for "revenue collected to date" rather than a single fiscal-year window.
export function totalBilledToDate(order: OrderRecord, reference: Date): number {
  const fbm = order.details.firstBillingMonth;
  if (!fbm) return 0;
  const [fy, fm] = fbm.split("-").map(Number);
  if (!fy || !fm) return 0;

  const startIdx = fy * 12 + (fm - 1);
  const refIdx = reference.getFullYear() * 12 + reference.getMonth();
  if (refIdx < startIdx) return 0;

  const span = refIdx - startIdx + 1;
  const agreementMonths = order.details.agreement;
  const bounded = agreementMonths != null ? Math.min(span, agreementMonths) : span;

  const cycle = order.billingCycle;
  if (!cycle || cycle === "O") return order.amount;
  const step = CYCLE_STEP[cycle] ?? 1;
  const occurrences = Math.floor((bounded - 1) / step) + 1;
  return occurrences * order.amount;
}

interface OrderNoLike {
  orderNo: string;
  clientId: string;
}

// Orders repeating for the same client share a base order number with a
// letter suffix (OD-P0000147, OD-P0000147A, ...); a new client gets the
// next sequential base number.
export function nextOrderNumber(orders: OrderNoLike[], clientId: string): string {
  const existingForClient = orders.filter((o) => o.clientId === clientId);
  if (existingForClient.length > 0) {
    const base = existingForClient[0].orderNo.match(/^(OD-P\d+)/)?.[1] ?? existingForClient[0].orderNo;
    const maxCode = existingForClient
      .map((o) => o.orderNo.slice(base.length))
      .filter(Boolean)
      .reduce((max, s) => Math.max(max, s.charCodeAt(0)), 64);
    return `${base}${String.fromCharCode(maxCode + 1)}`;
  }
  const nums = orders.map((o) => {
    const m = o.orderNo.match(/^OD-P(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const max = Math.max(0, ...nums);
  return `OD-P${String(max + 1).padStart(7, "0")}`;
}

// An order's orderNo carries a "/N" version suffix once it's the successor
// created by an amendment (see OrderPage.tsx's handleModalUpdate) — this
// strips that back off to find the order it superseded.
export function baseOrderNo(orderNo: string): string {
  return orderNo.split("/")[0];
}

interface DiffRow {
  label: string;
  before: string;
  after: string;
}

function diffString(v: number | string | null | undefined): string {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

function diffAmount(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : v.toLocaleString("en-IN");
}

// Field-by-field comparison between an amendment's previous order and its
// edited successor, for display on the Tech/Fin approval form — only fields
// that actually changed are returned.
export function diffOrderDetails(prev: OrderRecord, next: OrderRecord): DiffRow[] {
  const rows: DiffRow[] = [];
  function add(label: string, before: string, after: string) {
    if (before !== after) rows.push({ label, before, after });
  }

  add("Date Of Sign", formatDDMMYYYY(prev.dateOfSign), formatDDMMYYYY(next.dateOfSign));
  add("Plan", diffString(prev.details.plan), diffString(next.details.plan));
  add("One Time (₹)", diffAmount(prev.details.oneTime), diffAmount(next.details.oneTime));
  add("GST Process", diffString(prev.details.gstProcess), diffString(next.details.gstProcess));
  add("First Billing Month", diffString(prev.details.firstBillingMonth), diffString(next.details.firstBillingMonth));
  add(
    "Billing Cycle",
    prev.billingCycle ? BILLING_CYCLE_LABELS[prev.billingCycle as BillingCycle] : "—",
    next.billingCycle ? BILLING_CYCLE_LABELS[next.billingCycle as BillingCycle] : "—"
  );
  add("Agreement (months)", diffString(prev.details.agreement), diffString(next.details.agreement));
  add("Advance (₹)", diffAmount(prev.details.advance), diffAmount(next.details.advance));
  add("TDS (₹)", diffAmount(prev.details.tds), diffAmount(next.details.tds));
  add("Credit Period (days)", diffString(prev.details.creditPeriod), diffString(next.details.creditPeriod));
  add("Net Amount (₹)", diffAmount(prev.details.netAmount), diffAmount(next.details.netAmount));
  add("Amount (₹)", diffAmount(prev.amount), diffAmount(next.amount));
  add("Remarks", diffString(prev.details.remarks), diffString(next.details.remarks));

  const product = next.product === prev.product ? getProduct(next.product) : undefined;
  if (product) {
    for (const field of product.fields(next.details as unknown as Record<string, string>)) {
      const key = field.key as keyof OrderRecordDetails;
      add(field.label, diffString(prev.details[key] as string | number | null), diffString(next.details[key] as string | number | null));
    }
  }

  return rows;
}

// After any T/F/TC/FC change, check whether the order should move to the
// next lifecycle stage — inactive -> active once both activation stages are
// confirmed, cancellationInProgress -> cancelled once both cancellation
// stages are confirmed. Any other lifecycle stage is left untouched. An
// amendment successor (has `supersedes` set) stays "inactive" even once its
// own Tech+Fin clear — it only actually activates once the predecessor it
// supersedes reaches "cancelled" (see promoteSuccessorOf(), called
// separately from App.tsx wherever an order update lands on "cancelled").
export function withRecomputedLifecycle(order: OrderRecord): OrderRecord {
  if (
    order.lifecycleStatus === "inactive" &&
    !order.supersedes &&
    order.technical.status === "confirmed" &&
    order.financial.status === "confirmed"
  ) {
    return { ...order, lifecycleStatus: "active" };
  }
  if (
    order.lifecycleStatus === "cancellationInProgress" &&
    order.cancellationTechnical.status === "confirmed" &&
    order.cancellationFinancial.status === "confirmed"
  ) {
    return { ...order, lifecycleStatus: "cancelled" };
  }
  return order;
}

// Runs whenever an update makes `closedOrder.lifecycleStatus` become
// "cancelled" — finds the successor (if any) waiting on it, i.e. the order
// whose `supersedes` points here and whose own Tech+Fin are already
// confirmed, and promotes just that one to "active". Returns null if no
// successor is waiting yet (e.g. its own Tech+Fin haven't cleared).
export function promoteSuccessorOf(closedOrder: OrderRecord, allOrders: OrderRecord[]): OrderRecord | null {
  const successor = allOrders.find(
    (o) =>
      o.supersedes === closedOrder.id &&
      o.lifecycleStatus === "inactive" &&
      o.technical.status === "confirmed" &&
      o.financial.status === "confirmed"
  );
  return successor ? { ...successor, lifecycleStatus: "active" } : null;
}

// Whether closure can be initiated on this order right now — any stage
// except Closure Pending/Closed (see getDisplayStage()).
export function canInitiateClose(order: OrderRecord): boolean {
  const stage = getDisplayStage(order);
  return stage !== "closurePending" && stage !== "closed";
}

// Closing an order still "inactive" (Approval Pending) skips TC/FC entirely
// and goes straight to Closed — nothing was ever activated, so there's
// nothing to unwind. Closing from Active/Agreement Over goes to Closure
// Pending, same as before, awaiting TC/FC.
export function initiateClosure(order: OrderRecord, details: CancellationDetails): OrderRecord {
  return {
    ...order,
    cancellationDetails: details,
    lifecycleStatus: order.lifecycleStatus === "inactive" ? "cancelled" : "cancellationInProgress",
  };
}

// An order's contract term has lapsed if it has both a firstBillingMonth and
// a fixed agreement length, and that many months have passed since — an
// open-ended order (no agreement set) never lapses. Compared against the
// real current date (todayISO()), not the mock reference date, same as
// Billing.tsx's fiscal-year columns.
export function isAgreementOver(order: OrderRecord): boolean {
  const { firstBillingMonth, agreement } = order.details;
  if (!agreement || !firstBillingMonth) return false;
  const [y, m] = firstBillingMonth.split("-").map(Number);
  const endMonthIndex = y * 12 + (m - 1) + agreement;
  const [ty, tm] = todayISO().split("-").map(Number);
  const todayMonthIndex = ty * 12 + (tm - 1);
  return todayMonthIndex >= endMonthIndex;
}

// The 5 user-facing stage names, derived from lifecycleStatus (+ the
// date-driven Agreement Over overlay on "active") — see types.ts's
// OrderDisplayStage. This is what every list/badge/filter shows; the raw
// lifecycleStatus keeps driving the actual approval mechanics.
export function getDisplayStage(order: OrderRecord): OrderDisplayStage {
  if (order.lifecycleStatus === "inactive") return "approvalPending";
  if (order.lifecycleStatus === "cancellationInProgress") return "closurePending";
  if (order.lifecycleStatus === "cancelled") return "closed";
  return isAgreementOver(order) ? "agreementOver" : "active";
}

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K | null;
  direction: SortDirection;
}

// Click a new column resets to ascending; click the same column again flips
// direction — the toggle behavior every sortable table header uses.
export function toggleSortState<K extends string>(prev: SortState<K>, key: K): SortState<K> {
  if (prev.key !== key) return { key, direction: "asc" };
  return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
}

// Null-safe comparators for sortable columns whose value can be unset —
// nulls always sort after every real value, regardless of direction (the
// caller flips the comparator's sign for desc).
export function compareNullableDate(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

export function compareNullableNumber(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

// Shared pagination for any record list — clamps the visible page down if a
// filter shrinks the result set, same as every table already did by hand.
export function usePagination<T>(items: T[], defaultPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = items.slice(start, start + pageSize);
  return {
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    pageRows,
    totalRecords: items.length,
  };
}

export type ApprovalStageKey = "technical" | "financial" | "cancellationTechnical" | "cancellationFinancial";

export interface ActionableStage {
  key: ApprovalStageKey;
  label: string;
}

// The one stage an approver can act on right now, enforcing strict order —
// Tech must be confirmed before Fin becomes actionable, and (once closure is
// requested) TC before FC. Returns null once every stage relevant to the
// order's current lifecycle position is confirmed, or once the order is
// terminal ("cancelled"/Closed) regardless of stage statuses — an order
// closed straight from Approval Pending never gets its Tech/Fin confirmed at
// all, so without this check it would wrongly still show Tech as actionable.
export function getNextActionableStage(order: OrderRecord): ActionableStage | null {
  if (order.lifecycleStatus === "cancelled") return null;

  const sequence: ActionableStage[] =
    order.lifecycleStatus === "cancellationInProgress"
      ? [
          { key: "cancellationTechnical", label: "TC" },
          { key: "cancellationFinancial", label: "FC" },
        ]
      : [
          { key: "technical", label: "Tech" },
          { key: "financial", label: "Fin" },
        ];

  for (const stage of sequence) {
    if (order[stage.key].status !== "confirmed") return stage;
  }
  return null;
}
