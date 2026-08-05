import clientsData from "./clients.json";
import { PRODUCTS } from "../products";
import type {
  ApprovalState,
  BillingCycle,
  BillingStatus,
  Client,
  OrderRecord,
  OrderLifecycleStatus,
  StageStatus,
} from "../types";

const clients = clientsData as Client[];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function makeDate(offsetDays: number) {
  const d = new Date(2026, 6, 21); // fixed reference: 2026-07-21
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const APPROVERS = ["Harsh Vardhan", "Rinku Agarwal", "Priya Sharma"];

// Only decided (non-pending) stages get an approver/remark attached.
function withMeta(stage: StageStatus, seed: number): StageStatus {
  if (stage.status === "pending") return stage;
  return {
    ...stage,
    processedBy: APPROVERS[seed % APPROVERS.length],
    remark: stage.status === "confirmed" ? "Looks good, cleared." : "Needs correction before proceeding.",
  };
}

const billingCycles: BillingCycle[] = ["M", "B", "Q", "H", "Y", "O"];
const technicalPattern: ApprovalState[] = [
  "pending",
  "confirmed",
  "confirmed",
  "rejected",
  "confirmed",
  "pending",
  "pending",
  "confirmed",
];
// "rejected" sits at index 4, not 6 — financial is only ever consulted when
// technical is "confirmed" (index 1, 2, 4, or 7 in technicalPattern above),
// so a "rejected" placed at an index technical never confirms on (like the
// original index 6, itself "pending") could never actually be reached.
const financialPattern: ApprovalState[] = [
  "pending",
  "pending",
  "confirmed",
  "pending",
  "rejected",
  "pending",
  "pending",
  "confirmed",
];

// 4-6 orders per client, cycling deterministically — no dependency on the
// client list's length, so it stays in sync as clients.json grows. The last
// two clients are deliberately left at zero: a client with no existing order
// for either product, so the duplicate-order guard never fires and the full
// create -> Technical -> Financial -> Active flow can be walked end to end.
function orderCountFor(clientIndex: number): number {
  if (clientIndex >= clients.length - 2) return 0;
  return 4 + (clientIndex % 3);
}

// Varied agreement lengths (in months) so a healthy mix of Active, Agreement
// Over, and open-ended (no fixed term) orders shows up against today's real
// date, not just a flat 12 months for everything — the two short lengths at
// the end (1, 2 months) are what actually gets an Active order to tip into
// Agreement Over against the real current date.
const AGREEMENT_MONTHS_CYCLE: (number | null)[] = [12, 12, 6, 24, 3, null, 18, 12, 9, null, 1, 2];

export const mockOrders: OrderRecord[] = [];

let orderIndex = 0;
let globalSeq = 128;
let fullyConfirmedCount = 0;

clients.forEach((client, cliIdx) => {
  const count = orderCountFor(cliIdx);
  let baseNumber = "";

  for (let k = 0; k < count; k++) {
    const product = PRODUCTS[(cliIdx + k) % PRODUCTS.length];
    const clientManager = client.clientManager;
    const signOffset = -((orderIndex * 7) % 400) - 30;
    const createdOffset = signOffset + 3;
    const techState = technicalPattern[orderIndex % technicalPattern.length];
    const techOffset = createdOffset + 10;
    const finState = techState === "confirmed" ? financialPattern[orderIndex % financialPattern.length] : "pending";
    const finOffset = techOffset + 8;
    const billingCycle = billingCycles[orderIndex % billingCycles.length];
    const amount = 15000 + orderIndex * 23750 + (orderIndex % 6) * 4200;

    if (k === 0) {
      globalSeq += 1;
      baseNumber = `OD-P${String(globalSeq).padStart(7, "0")}`;
    }
    const suffix = k === 0 ? "" : String.fromCharCode(64 + k); // A, B, ...
    const orderNo = `${baseNumber}${suffix}`;
    const dateOfSign = makeDate(signOffset);
    const createdOn = makeDate(createdOffset);
    const isFullyConfirmed = techState === "confirmed" && finState === "confirmed";

    // Orders only enter the cancellation flow once fully activated. Cycle
    // through active / cancellation-in-progress / cancelled across just the
    // fully-confirmed orders (not the raw order index, which would leave
    // these buckets empty since only a handful of orders are ever fully
    // confirmed), so every bucket has a demo-able entry.
    let lifecycleStatus: OrderLifecycleStatus = "inactive";
    let cancellationTechnical: StageStatus = { status: "pending", date: null };
    let cancellationFinancial: StageStatus = { status: "pending", date: null };
    // Keyed off the fully-confirmed sequence itself (not orderIndex) so it's
    // guaranteed to land on an actual fully-confirmed order regardless of how
    // technicalPattern/financialPattern happen to line up at any given index.
    let amended = false;
    // Finance-owned billing status, seeded independently of the
    // Tech/Fin/TC/FC approval chain so the new Close Billing tab's three
    // categories (To Open / To Close / Closed) each have demo rows.
    // billingOpenedOn/billingClosedOn mark the actual window billing ran in
    // (as opposed to the projection Billing.tsx computes from
    // firstBillingMonth/billingCycle/agreement) — the Billing report's green
    // highlighting is keyed off this window, not off billingStatus alone.
    let billingStatus: BillingStatus = "notOpened";
    let billingOpenedOn: string | null = null;
    let billingClosedOn: string | null = null;
    if (isFullyConfirmed) {
      const bucket = fullyConfirmedCount % 3;
      amended = fullyConfirmedCount % 5 === 2;
      if (bucket === 2) {
        lifecycleStatus = "cancelled";
        cancellationTechnical = withMeta({ status: "confirmed", date: makeDate(finOffset + 5) }, orderIndex);
        cancellationFinancial = withMeta({ status: "confirmed", date: makeDate(finOffset + 12) }, orderIndex + 1);
        // Cancelled orders are mostly still awaiting billing closure (open),
        // with a deterministic minority already closed by finance.
        billingStatus = fullyConfirmedCount % 4 === 3 ? "closed" : "open";
        billingOpenedOn = makeDate(finOffset + 3);
        if (billingStatus === "closed") billingClosedOn = makeDate(finOffset + 12 + 10);
      } else if (bucket === 1) {
        lifecycleStatus = "cancellationInProgress";
        cancellationTechnical = withMeta({ status: "confirmed", date: makeDate(finOffset + 5) }, orderIndex);
        // Cancellation was only ever initiated on an order whose billing was
        // already running.
        billingStatus = "open";
        billingOpenedOn = makeDate(finOffset + 3);
      } else {
        lifecycleStatus = "active";
        // Active orders are mostly billing-open, with a deterministic
        // minority still awaiting finance's initial "Open Billing" action.
        billingStatus = fullyConfirmedCount % 3 === 0 ? "notOpened" : "open";
        if (billingStatus === "open") billingOpenedOn = makeDate(finOffset + 3);
      }
      fullyConfirmedCount++;
    }

    mockOrders.push({
      id: `ord-${orderIndex + 1}`,
      orderNo,
      product: product.name,
      clientId: client.id,
      client: client.name,
      clientManager,
      dateOfSign,
      createdOn,
      technical: withMeta({ status: techState, date: techState === "pending" ? null : makeDate(techOffset) }, orderIndex),
      financial: withMeta({ status: finState, date: finState === "pending" ? null : makeDate(finOffset) }, orderIndex + 2),
      lifecycleStatus,
      cancellationTechnical,
      cancellationFinancial,
      billingCycle,
      amount,
      amended,
      billingStatus,
      billingOpenedOn,
      billingClosedOn,
      details: {
        clientManager,
        billingAddress: client.billingAddress,
        billingState: client.billingState,
        billingCity: client.billingCity,
        deliveryAddress: client.deliveryAddress,
        deliveryState: client.deliveryState,
        deliveryCity: client.deliveryCity,
        gstNo: client.gstNo,
        spocs: client.spocs,
        product: product.name,
        dateOfSign,
        plan: orderIndex % 2 === 0 ? "Prepaid" : "Postpaid",
        oneTime: null,
        gstProcess: "",
        selectGst: client.gstNo || "NA",
        ...product.mockDetails(orderIndex),
        firstBillingMonth: createdOn.slice(0, 7),
        billingCycle,
        agreement: AGREEMENT_MONTHS_CYCLE[orderIndex % AGREEMENT_MONTHS_CYCLE.length],
        advance: null,
        tds: null,
        netAmount: amount,
        creditPeriod: null,
        documents: [],
        remarks: "",
      },
    });
    orderIndex++;
  }
});
