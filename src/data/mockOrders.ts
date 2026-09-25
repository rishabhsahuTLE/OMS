import clientsData from "./clients.json";
import { PRODUCTS } from "../products";
import { baseOrderNo, todayISO } from "../utils";
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

// Fixed reference date: 2026-07-21 — every mock date is a day offset from
// this constant (never Date.now()), so seed data doesn't shift day to day.
const REFERENCE_DATE = new Date(2026, 6, 21);

function makeDate(offsetDays: number) {
  const d = new Date(REFERENCE_DATE);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Spreads order creation dates across three real fiscal years (FY2024-25
// through FY2026-27) instead of one narrow band, so the Dashboard's FY
// preset filters actually show different data per FY. SPREAD_START_DATE
// sits a couple weeks inside FY2024-25 (not right on the Apr 1 boundary) so
// the oldest orders land unambiguously in that fiscal year.
const SPREAD_START_DATE = new Date(2024, 3, 15);
const SPREAD_END_BUFFER_DAYS = 30;
const TOTAL_SPREAD_DAYS =
  Math.round((REFERENCE_DATE.getTime() - SPREAD_START_DATE.getTime()) / 86_400_000) - SPREAD_END_BUFFER_DAYS;

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

// Precomputed (not hardcoded) so the spread below stays correct as
// clients.json grows — mirrors orderCountFor()'s own per-client count.
const totalOrders = clients.reduce((sum, _client, i) => sum + orderCountFor(i), 0);

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
    // Linear spread across FY2024-25 -> FY2026-27: orderIndex 0 (earliest
    // clients) lands nearest the reference date, the last order lands at
    // SPREAD_START_DATE — see TOTAL_SPREAD_DAYS above.
    const spreadFrac = totalOrders > 1 ? orderIndex / (totalOrders - 1) : 0;
    const signOffset = -Math.round(spreadFrac * TOTAL_SPREAD_DAYS) - SPREAD_END_BUFFER_DAYS;
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

// --- Recent already-open order for the default Dashboard 2 FY view --------
// Runs after the amendment pair above so it can't shift which order becomes
// activeOrdersForAmendment[0]/[1]. Dashboard 2's default filter is FY2026-27
// (createdOn between 2026-04-01 and 2027-03-31, matching REFERENCE_DATE's own
// fiscal year), but every order the main loop created within that window
// happens to land in bucket 0 (Tech+Fin confirmed, awaiting Finance to open
// billing) — so "Revenue — Opened vs Projected" would always show
// Opened = ₹0 under that default filter. Promote the earliest such order to
// already-open billing (mirroring bucket 1's own field assignments above) so
// the panel has a real, in-window opened order to sum.
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const recentReadyForBilling = mockOrders.find(
  (o) =>
    o.createdOn >= "2026-04-01" &&
    o.createdOn <= "2027-03-31" &&
    o.technical.status === "confirmed" &&
    o.financial.status === "confirmed" &&
    o.lifecycleStatus === "inactive"
);
if (recentReadyForBilling && recentReadyForBilling.financial.date) {
  recentReadyForBilling.lifecycleStatus = "active";
  recentReadyForBilling.billingStatus = "open";
  recentReadyForBilling.billingOpenedOn = addDays(recentReadyForBilling.financial.date, 3);
}

// --- Extra Approval-Queue-pending orders ------------------------------------
// The main loop's technicalPattern/financialPattern cycling only ever lands
// 17 orders in the pending Technical queue and 9 in pending Financial — too
// few (Financial especially) to demo Dashboard 2's Approval Queue pagination
// meaningfully at a real target size (Technical 20, Financial 15). Hand-
// authored here (same approach as makeAmendmentSuccessor/recentReadyForBilling
// above) rather than by editing technicalPattern/financialPattern themselves,
// since that array's confirmed/pending mix also drives fullyConfirmedCount and
// everything downstream of it (Active/Cancelled/ToOpen bucket counts, Billing
// projections) — isolated post-loop additions can't ripple into any of that.
function makeExtraPendingOrder(
  client: Client,
  product: (typeof PRODUCTS)[number],
  orderNo: string,
  seed: number,
  signOffset: number,
  amount: number,
  dept: "Tech" | "Finance"
): OrderRecord {
  const dateOfSign = makeDate(signOffset);
  const createdOn = makeDate(signOffset + 3);
  const techOffset = signOffset + 13;
  return {
    id: `ord-extra-${dept.toLowerCase()}-${seed}`,
    orderNo,
    product: product.name,
    clientId: client.id,
    client: client.name,
    bu: client.bu,
    clientManager: client.clientManager,
    dateOfSign,
    createdOn,
    technical: dept === "Finance" ? withMeta({ status: "confirmed", date: makeDate(techOffset) }, seed) : { status: "pending", date: null },
    financial: { status: "pending", date: null },
    lifecycleStatus: "inactive",
    cancellationTechnical: { status: "pending", date: null },
    cancellationFinancial: { status: "pending", date: null },
    billingCycle: billingCycles[seed % billingCycles.length],
    amount,
    amended: false,
    billingStatus: "notOpened",
    billingOpenedOn: null,
    billingClosedOn: null,
    details: {
      clientManager: client.clientManager,
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
      plan: seed % 2 === 0 ? "Prepaid" : "Postpaid",
      oneTime: null,
      gstProcess: "",
      selectGst: client.gstNo || "NA",
      ...product.mockDetails(seed),
      firstBillingMonth: createdOn.slice(0, 7),
      billingCycle: billingCycles[seed % billingCycles.length],
      agreement: AGREEMENT_MONTHS_CYCLE[seed % AGREEMENT_MONTHS_CYCLE.length],
      advance: null,
      tds: null,
      netAmount: amount,
      creditPeriod: null,
      documents: [],
      remarks: "",
    },
  };
}

mockOrders.push(
  // Financial queue: 9 existing + these 6 = 15.
  makeExtraPendingOrder(clients[0], PRODUCTS[0], "OD-P0000138", 1, -15, 245000, "Finance"),
  makeExtraPendingOrder(clients[1], PRODUCTS[4], "OD-P0000139", 2, -40, 318500, "Finance"),
  makeExtraPendingOrder(clients[2], PRODUCTS[1], "OD-P0000140", 3, -60, 176000, "Finance"),
  makeExtraPendingOrder(clients[3], PRODUCTS[2], "OD-P0000141", 4, -85, 292500, "Finance"),
  makeExtraPendingOrder(clients[4], PRODUCTS[3], "OD-P0000142", 5, -105, 158000, "Finance"),
  makeExtraPendingOrder(clients[5], PRODUCTS[5], "OD-P0000143", 6, -130, 267000, "Finance"),
  // Technical queue: 17 existing + these 3 = 20.
  makeExtraPendingOrder(clients[6], PRODUCTS[0], "OD-P0000144", 7, -20, 198500, "Tech"),
  makeExtraPendingOrder(clients[7], PRODUCTS[4], "OD-P0000145", 8, -50, 234000, "Tech"),
  makeExtraPendingOrder(clients[8], PRODUCTS[2], "OD-P0000146", 9, -75, 275500, "Tech")
);

// --- One order opened in the real current month -----------------------------
// "Revenue — Opened vs Projected"'s 2nd bar (Section2OrderAndBilling.tsx)
// deliberately scopes to the real current calendar month (new Date()), not
// the fixed REFERENCE_DATE every other mock date is anchored to — so as real
// time moves further past REFERENCE_DATE (2026-07-21), eventually no seeded
// order's billingOpenedOn falls in "this month" any more and that bar shows
// a flat ₹0. Anchoring this one order to the real todayISO() instead (rather
// than makeDate()) keeps it self-correcting: whenever the app is actually
// opened, this order's billing window and firstBillingMonth both land in
// whatever the real current month is.
const REAL_TODAY = todayISO();
mockOrders.push({
  id: "ord-extra-thismonth",
  orderNo: "OD-P0000147",
  product: PRODUCTS[0].name,
  clientId: clients[0].id,
  client: clients[0].name,
  bu: clients[0].bu,
  clientManager: clients[0].clientManager,
  dateOfSign: addDays(REAL_TODAY, -60),
  createdOn: addDays(REAL_TODAY, -55),
  technical: withMeta({ status: "confirmed", date: addDays(REAL_TODAY, -45) }, 10),
  financial: withMeta({ status: "confirmed", date: addDays(REAL_TODAY, -35) }, 11),
  lifecycleStatus: "active",
  cancellationTechnical: { status: "pending", date: null },
  cancellationFinancial: { status: "pending", date: null },
  billingCycle: "M",
  amount: 356000,
  amended: false,
  billingStatus: "open",
  billingOpenedOn: REAL_TODAY,
  billingClosedOn: null,
  details: {
    clientManager: clients[0].clientManager,
    billingAddress: clients[0].billingAddress,
    billingState: clients[0].billingState,
    billingCity: clients[0].billingCity,
    deliveryAddress: clients[0].deliveryAddress,
    deliveryState: clients[0].deliveryState,
    deliveryCity: clients[0].deliveryCity,
    gstNo: clients[0].gstNo,
    spocs: clients[0].spocs,
    product: PRODUCTS[0].name,
    dateOfSign: addDays(REAL_TODAY, -60),
    plan: "Prepaid",
    oneTime: null,
    gstProcess: "",
    selectGst: clients[0].gstNo || "NA",
    ...PRODUCTS[0].mockDetails(12),
    firstBillingMonth: REAL_TODAY.slice(0, 7),
    billingCycle: "M",
    agreement: null,
    advance: null,
    tds: null,
    netAmount: 356000,
    creditPeriod: null,
    documents: [],
    remarks: "",
  },
});
