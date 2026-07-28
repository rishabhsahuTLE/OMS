export type MainTabId = "dashboard" | "report" | "orders" | "managerReport";

export type ReportSubTabId = "approval" | "billing";

export type OrdersSubTabId = "order" | "approvalSetting" | "closeBilling";

export type BillingCycle = "M" | "B" | "Q" | "H" | "Y" | "O";

export type OrderStatusFilter = "all" | "closed" | "open";

export type BillingStatus = "Open" | "Closed";

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
}

export interface OrderRecord {
  id: string;
  orderNo: string;
  product: string;
  clientId: string;
  client: string;
  clientManager: string;
  dateOfSign: string; // ISO date
  createdOn: string; // ISO date — Order Creation Date (OCD)
  technical: StageStatus; // Technically Cleared (TC)
  financial: StageStatus; // Financially Cleared (FC)
  billingCycle: BillingCycle | "";
  amount: number;
  billingStatus: BillingStatus;
  billingRemarks: string;
  amended: boolean;
  // Placeholder order created via "Create Order Later" from Close Billing —
  // still missing required order details, remains editable until completed.
  incomplete?: boolean;
  details: OrderRecordDetails;
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
