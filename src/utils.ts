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
