import type { OrderRecord } from "./types";

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
