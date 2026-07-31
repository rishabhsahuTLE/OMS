export type MainTabId = "dashboard" | "report" | "orders" | "admin";

export type ReportSubTabId = "approval" | "billing" | "managerReport";

export type OrdersSubTabId = "amendCancel" | "approval";

export type AdminSubTabId = "approvalSetting";

export type BillingCycle = "M" | "B" | "Q" | "H" | "Y" | "O";

export type OrderStatusFilter = "all" | "closed" | "open";

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  M: "Monthly",
  B: "Bi-monthly",
  Q: "Quarterly",
  H: "Half-yearly",
  Y: "Yearly",
  O: "One-time",
};

export interface Spoc {
  name: string;
  email: string;
  mobile: string;
  remarks: string;
}

export interface Client {
  id: string;
  name: string;
  domain: string;
  type: string;
  billingAddress: string;
  billingState: string;
  billingCity: string;
  deliveryAddress: string;
  deliveryState: string;
  deliveryCity: string;
  gstNo: string;
  remark: string;
  spocs: Spoc[];
  clientManager: string;
  createdBy: string;
  createdOn: string; // ISO date (yyyy-mm-dd)
}

export const CLIENT_TYPES = ["Corporate", "University"] as const;

export const STATES = [
  "Maharashtra",
  "Delhi",
  "Karnataka",
  "Tamil Nadu",
  "Gujarat",
  "West Bengal",
  "Telangana",
  "Punjab",
  "Uttar Pradesh",
  "Rajasthan",
] as const;

export const CITIES_BY_STATE: Record<string, string[]> = {
  Maharashtra: ["Mumbai", "Pune", "Nagpur", "Thane", "Kalyan"],
  Delhi: ["New Delhi"],
  Karnataka: ["Bengaluru", "Mysuru"],
  "Tamil Nadu": ["Chennai", "Coimbatore"],
  Gujarat: ["Ahmedabad", "Surat"],
  "West Bengal": ["Kolkata", "Howrah"],
  Telangana: ["Hyderabad"],
  Punjab: ["Chandigarh", "Ludhiana"],
  "Uttar Pradesh": ["Lucknow", "Noida"],
  Rajasthan: ["Jaipur", "Udaipur"],
};

export type ApprovalState = "pending" | "confirmed" | "rejected";

export interface StageStatus {
  status: ApprovalState;
  date: string | null; // ISO date, set once status leaves "pending"
  processedBy?: string; // who set it, once status leaves "pending"
  remark?: string;
}

// The order lifecycle driven by Order Management's 2 tabs (Manage Orders /
// Approvals): inactive (awaiting T+F) -> active -> [closure initiated] ->
// cancellationInProgress (awaiting TC+FC) -> cancelled. Closure can be
// initiated from "inactive" too, in which case it skips straight to
// "cancelled" (nothing was ever activated, so there's nothing to unwind) —
// see initiateClosure() in utils.ts. An amendment successor (has
// `supersedes` set) stays "inactive" even after its own T+F clear, until the
// predecessor it supersedes reaches "cancelled" (see promoteSuccessorOf() in
// utils.ts) — it has no distinct stored status of its own for that wait, it
// just keeps displaying as Approval Pending (see getDisplayStage()).
export type OrderLifecycleStatus = "inactive" | "active" | "cancellationInProgress" | "cancelled";

// The 5 user-facing stage names — a derived/display-only layer over
// OrderLifecycleStatus (see getDisplayStage() in utils.ts). "agreementOver"
// isn't a stored status; it's a date-driven overlay on "active".
export type OrderDisplayStage = "approvalPending" | "active" | "agreementOver" | "closurePending" | "closed";

export interface OrderRecord {
  id: string;
  orderNo: string;
  product: string;
  clientId: string;
  client: string;
  clientManager: string;
  dateOfSign: string; // ISO date
  createdOn: string; // ISO date — Order Creation Date (OCD)
  technical: StageStatus; // Technically Cleared (T) — activation
  financial: StageStatus; // Financially Cleared (F) — activation
  lifecycleStatus: OrderLifecycleStatus;
  cancellationTechnical: StageStatus; // Technically Cleared (TC) — cancellation
  cancellationFinancial: StageStatus; // Financially Cleared (FC) — cancellation
  billingCycle: BillingCycle | "";
  amount: number;
  amended: boolean;
  // Set only on an amendment successor — the id of the order it was amended
  // from (the one immediately cancelled to make way for it). Used to look up
  // predecessor/successor pairs unambiguously, even across several
  // amendment generations of the same order.
  supersedes?: string;
  // Placeholder order still missing required order details (e.g. the
  // duplicate-order handoff before it's ever been completed) — remains
  // editable until completed.
  incomplete?: boolean;
  // Collected once, at the point cancellation is initiated (CancellationConfirm.tsx) —
  // absent until then, permanent afterward.
  cancellationDetails?: CancellationDetails;
  details: OrderRecordDetails;
}

export interface CancellationDetails {
  effectFromDate: string; // ISO date
  outstandingBalance: number;
  reason: string;
  comments: string;
}

export interface OrderRecordDetails {
  clientManager: string;
  billingAddress: string;
  billingState: string;
  billingCity: string;
  deliveryAddress: string;
  deliveryState: string;
  deliveryCity: string;
  gstNo: string;
  spocs: Spoc[];
  product: string;
  dateOfSign: string;
  plan: string;
  oneTime: number | null;
  gstProcess: string;
  selectGst: string;
  // per-product fields — see the Product subclasses in products.ts
  numUsers?: number | null;
  feePerUser?: number | null;
  billedOn?: string;
  assessments?: number | null;
  unitPrice?: number | null;
  automatedProctoring?: "Yes" | "No" | "";
  proctoringBySgTeam?: "Yes" | "No" | "";
  proctoringVideos?: "Yes" | "No" | "";
  gradingBySgTeam?: "Yes" | "No" | "";
  mathsEditor?: "Yes" | "No" | "";
  freeAssessments?: number | null;
  questionType?: string;
  deviceType?: string;
  // shared
  firstBillingMonth: string;
  billingCycle: BillingCycle | "";
  agreement: number | null;
  advance: number | null;
  tds: number | null;
  netAmount: number;
  creditPeriod: number | null;
  documents: { name: string; fileName: string }[];
  remarks: string;
}

export type ApprovalSettingStatus = "Active" | "Inactive";

export interface ApprovalSettingRow {
  id: string;
  approver: string;
  department: string;
  technical: boolean;
  financial: boolean;
  status: ApprovalSettingStatus;
}

// Department roster, as sourced from zingHR.
export const DEPARTMENTS = [
  "SSO Head-TL Edtech",
  "DSO Head-TL Edtech",
  "Finance Head-TL Edtech",
  "Admin-TL Edtech",
  "Team Admin-TL Edtech",
  "CEO-TL Edtech",
] as const;
