import clientsData from "./clients.json";
import { PRODUCTS } from "../products";
import type { ApprovalState, BillingCycle, Client, OrderRecord, OrderLifecycleStatus, StageStatus } from "../types";

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
const financialPattern: ApprovalState[] = [
  "pending",
  "pending",
  "confirmed",
  "pending",
  "pending",
  "pending",
  "rejected",
  "confirmed",
];

// 1-3 orders per client, cycling deterministically — no dependency on the
// client list's length, so it stays in sync as clients.json grows.
function orderCountFor(clientIndex: number): number {
  return 1 + (clientIndex % 3);
}

// Varied agreement lengths (in months) so a healthy mix of Active, Agreement
// Over, and open-ended (no fixed term) orders shows up against today's real
// date, not just a flat 12 months for everything.
const AGREEMENT_MONTHS_CYCLE: (number | null)[] = [12, 12, 6, 24, 3, null, 18, 12, 9, null];

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
    if (isFullyConfirmed) {
      const bucket = fullyConfirmedCount % 3;
      if (bucket === 2) {
        lifecycleStatus = "cancelled";
        cancellationTechnical = withMeta({ status: "confirmed", date: makeDate(finOffset + 5) }, orderIndex);
        cancellationFinancial = withMeta({ status: "confirmed", date: makeDate(finOffset + 12) }, orderIndex + 1);
      } else if (bucket === 1) {
        lifecycleStatus = "cancellationInProgress";
        cancellationTechnical = withMeta({ status: "confirmed", date: makeDate(finOffset + 5) }, orderIndex);
      } else {
        lifecycleStatus = "active";
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
      amended: isFullyConfirmed && orderIndex % 11 === 3,
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
