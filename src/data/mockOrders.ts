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

// how many orders to generate per clients entry (same length as clients)
const ORDER_COUNTS = [2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1];

export const mockOrders: OrderRecord[] = [];

let orderIndex = 0;
let globalSeq = 128;
let fullyConfirmedCount = 0;

clients.forEach((client, cliIdx) => {
  const count = ORDER_COUNTS[cliIdx] ?? 1;
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
        cancellationTechnical = { status: "confirmed", date: makeDate(finOffset + 5) };
        cancellationFinancial = { status: "confirmed", date: makeDate(finOffset + 12) };
      } else if (bucket === 1) {
        lifecycleStatus = "cancellationInProgress";
        cancellationTechnical = { status: "confirmed", date: makeDate(finOffset + 5) };
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
      technical: { status: techState, date: techState === "pending" ? null : makeDate(techOffset) },
      financial: { status: finState, date: finState === "pending" ? null : makeDate(finOffset) },
      lifecycleStatus,
      cancellationTechnical,
      cancellationFinancial,
      billingCycle,
      amount,
      billingStatus: isFullyConfirmed && orderIndex % 4 === 0 ? "Closed" : "Open",
      billingRemarks: "",
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
        plan: "Standard",
        oneTime: null,
        gstProcess: "",
        selectGst: client.gstNo || "NA",
        ...product.mockDetails(orderIndex),
        firstBillingMonth: createdOn.slice(0, 7),
        billingCycle,
        agreement: 12,
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
