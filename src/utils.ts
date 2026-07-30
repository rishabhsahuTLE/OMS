import type { BillingCycle, OrderRecord, OrderRecordDetails } from "./types";
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
// stages are confirmed. Any other lifecycle stage is left untouched.
export function withRecomputedLifecycle(order: OrderRecord): OrderRecord {
  if (
    order.lifecycleStatus === "inactive" &&
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

export type ApprovalStageKey = "technical" | "financial" | "cancellationTechnical" | "cancellationFinancial";

export interface ActionableStage {
  key: ApprovalStageKey;
  label: string;
}

// The one stage an approver can act on right now, enforcing strict order —
// Tech must be confirmed before Fin becomes actionable, and (once
// cancellation is requested) TC before FC. Returns null once every stage
// relevant to the order's current lifecycle position is confirmed.
export function getNextActionableStage(order: OrderRecord): ActionableStage | null {
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
