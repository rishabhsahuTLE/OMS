import clientsData from "./clients.json";
import { PRODUCTS } from "../products";
import { baseOrderNo } from "../utils";
import type {
  ApprovalState,
  BillingCycle,
  BillingStatus,
  CancellationDetails,
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

// Rotating, realistic reasons for the orders below that actually go through
// cancellation initiation (bucket 2 / bucket 3) — CancellationConfirm.tsx's
// own mandatory-fields shape (see initiateClosure() in utils.ts), which the
// mock generator previously left unset entirely on every cancelled/
// cancellation-in-progress order (an inconsistent seed no real order could
// ever be in).
const CANCELLATION_REASONS = [
  "Client requested early termination.",
  "Budget reallocated away from this engagement.",
  "Service no longer required by the client.",
  "Client switching to an alternate vendor.",
];

function makeCancellationDetails(seed: number, amount: number, effectFromOffset: number): CancellationDetails {
  return {
    effectFromDate: makeDate(effectFromOffset),
    outstandingBalance: Math.round((amount * (0.15 + (seed % 4) * 0.07)) / 100) * 100,
    reason: CANCELLATION_REASONS[seed % CANCELLATION_REASONS.length],
    comments: "",
  };
}

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
    const bu = client.bu;
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
    // through toOpen / active / cancellation-in-progress / cancelled across
    // just the fully-confirmed orders (not the raw order index, which would
    // leave these buckets empty since only a handful of orders are ever
    // fully confirmed), so every bucket has a demo-able entry.
    let lifecycleStatus: OrderLifecycleStatus = "inactive";
    let cancellationTechnical: StageStatus = { status: "pending", date: null };
    let cancellationFinancial: StageStatus = { status: "pending", date: null };
    // Keyed off the fully-confirmed sequence itself (not orderIndex) so it's
    // guaranteed to land on an actual fully-confirmed order regardless of how
    // technicalPattern/financialPattern happen to line up at any given index.
    let amended = false;
    // Finance-owned billing status, seeded independently of the
    // Tech/Fin/TC/FC approval chain so Open/Close Billing's To Open / To
    // Close / Closed categories each have demo rows (To Amend only ever gets
    // populated by actually amending an order in the running app — no
    // seeded order carries `supersedes`). billingOpenedOn/billingClosedOn
    // mark the actual window billing ran in (as opposed to the projection
    // Billing.tsx computes from firstBillingMonth/billingCycle/agreement) —
    // the Billing report's green highlighting is keyed off this window, not
    // off billingStatus alone. Active always implies billingStatus "open" —
    // an order only becomes Active once Finance opens it (see
    // withRecomputedLifecycle()/getDisplayStage() in utils.ts) — so a
    // fully-confirmed order that hasn't been opened yet stays "inactive"
    // (display stage "toOpen") rather than being seeded straight to "active".
    let billingStatus: BillingStatus = "notOpened";
    let billingOpenedOn: string | null = null;
    let billingClosedOn: string | null = null;
    let cancellationDetails: CancellationDetails | undefined;
    if (isFullyConfirmed) {
      const bucket = fullyConfirmedCount % 4;
      amended = fullyConfirmedCount % 5 === 2;
      if (bucket === 3) {
        lifecycleStatus = "cancelled";
        cancellationTechnical = withMeta({ status: "confirmed", date: makeDate(finOffset + 5) }, orderIndex);
        cancellationFinancial = withMeta({ status: "confirmed", date: makeDate(finOffset + 12) }, orderIndex + 1);
        // Cancelled orders are mostly still awaiting billing closure (open),
        // with a deterministic minority already closed by finance.
        billingStatus = fullyConfirmedCount % 12 === 3 ? "closed" : "open";
        billingOpenedOn = makeDate(finOffset + 3);
        if (billingStatus === "closed") billingClosedOn = makeDate(finOffset + 12 + 10);
        // A cancelled order always went through cancellation initiation on
        // the way here (see initiateClosure() in utils.ts) — it's never
        // actually cancelled without cancellationDetails.
        cancellationDetails = makeCancellationDetails(orderIndex, amount, finOffset + 2);
      } else if (bucket === 2) {
        lifecycleStatus = "cancellationInProgress";
        cancellationTechnical = withMeta({ status: "confirmed", date: makeDate(finOffset + 5) }, orderIndex);
        // Cancellation was only ever initiated on an order whose billing was
        // already running.
        billingStatus = "open";
        billingOpenedOn = makeDate(finOffset + 3);
        cancellationDetails = makeCancellationDetails(orderIndex, amount, finOffset + 2);
      } else if (bucket === 1) {
        lifecycleStatus = "active";
        billingStatus = "open";
        billingOpenedOn = makeDate(finOffset + 3);
      } else {
        // bucket === 0: Tech+Fin cleared but Finance hasn't opened it yet —
        // stays "inactive" (display stage "toOpen"), billing never started.
        lifecycleStatus = "inactive";
      }
      fullyConfirmedCount++;
    }

    mockOrders.push({
      id: `ord-${orderIndex + 1}`,
      orderNo,
      product: product.name,
      clientId: client.id,
      client: client.name,
      bu,
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
      cancellationDetails,
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

// --- Seeded amendment pair --------------------------------------------------
// The main loop above deliberately never sets `supersedes` (a successor is
// only ever created by actually walking Manage Orders' Amend flow — see
// confirmAmendment() in OrderApproval.tsx, which this mirrors field-for-
// field), so Stage Distribution's "Amendment Pending" bucket, Billing
// Actions Due's "To Amend" bucket, and Revenue in Motion's "Amendment
// In-flight" segment would otherwise always read zero. These two
// hand-authored successors give each a real demo row: one still awaiting
// its unified Tech+Fin review ("Amendment Pending"), one past that and
// awaiting Finance to complete the amendment in Close Billing ("To Amend").
// Per confirmAmendment(), the predecessor itself is left completely
// untouched while its successor is worked through, so neither predecessor
// needs any change here.
function makeAmendmentSuccessor(predecessor: OrderRecord, seed: number, stage: "amendmentPending" | "toAmend"): OrderRecord {
  const bothConfirmed = stage === "toAmend";
  const reviewOffset = 24 + seed * 3;
  const amendedAmount = predecessor.amount + 8500 + seed * 500;
  return {
    ...predecessor,
    id: `${predecessor.id}-amend`,
    orderNo: `${baseOrderNo(predecessor.orderNo)}/1`,
    amended: true,
    supersedes: predecessor.id,
    lifecycleStatus: "inactive",
    technical: bothConfirmed ? withMeta({ status: "confirmed", date: makeDate(reviewOffset) }, seed) : { status: "pending", date: null },
    financial: bothConfirmed
      ? withMeta({ status: "confirmed", date: makeDate(reviewOffset + 6) }, seed + 1)
      : { status: "pending", date: null },
    cancellationTechnical: { status: "pending", date: null },
    cancellationFinancial: { status: "pending", date: null },
    billingStatus: "notOpened",
    billingOpenedOn: null,
    billingClosedOn: null,
    cancellationDetails: undefined,
    amount: amendedAmount,
    createdOn: makeDate(reviewOffset - 4),
    details: {
      ...predecessor.details,
      netAmount: amendedAmount,
      remarks: "Amendment: revised rate per client request.",
    },
  };
}

const activeOrdersForAmendment = mockOrders.filter((o) => o.lifecycleStatus === "active");
if (activeOrdersForAmendment[0]) {
  mockOrders.push(makeAmendmentSuccessor(activeOrdersForAmendment[0], 1, "amendmentPending"));
}
if (activeOrdersForAmendment[1]) {
  mockOrders.push(makeAmendmentSuccessor(activeOrdersForAmendment[1], 2, "toAmend"));
}
