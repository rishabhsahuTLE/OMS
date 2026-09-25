// Design tokens lifted 1:1 from oms-dashboard-reference.html's inline hex
// values — kept as one file so every Dashboard 2 component reads the exact
// same palette instead of each hand-copying hex strings.

export const D2 = {
  pageBg: "#f4f6f8",
  text: "#15242b",
  muted: "#5c7480",
  mutedStrong: "#40565f",
  faint: "#8a9aa3",
  border: "#dde3e8",
  panelBorder: "#e5eaee",
  rowDivider: "#eef1f4",
  panelBg: "#fafbfc",
  brand: "#12414f",
  brandTint: "#f2f6f8",
  brandChipBg: "#e8eef1",
  link: "#1a7fae",
  red: "#c4322d",
  redBg: "#fdeceb",
  amber: "#a76a10",
  amberBg: "#fdf3e6",
  green: "#1f7a5c",
  // Stage identity colors — reused verbatim everywhere a stage is named
  // (Pending Revenue by Approval Stage, Turnaround Time's non-bottleneck
  // bars), matching the reference's own reuse of one palette per stage.
  stage: {
    technical: "#3c5f7f",
    financial: "#2f8f72",
    cancellationFinancial: "#c68a2b",
    cancellationTechnical: "#7b5ea7",
  },
  // Stage Distribution's 5-bucket taxonomy (StageBucketKey) — one color per
  // bucket, reused wherever that bucket's order count is shown so e.g.
  // "Active" is always the same color on the page.
  stageBucket: {
    pending: "#a76a10",
    active: "#1f7a5c",
    agreementOver: "#3c5f7f",
    cancellationPending: "#c4322d",
    closed: "#5c7480",
  } as Record<string, string>,
  bu: {
    "Enterprise CEP": "#2f8f72",
    "Premiere Inst": "#7b5ea7",
    "Univ-Ops": "#d98424",
    IMPACT: "#c4322d",
    ENTERPRISE: "#4a8fb0",
  } as Record<string, string>,
  product: {
    LMS: "#c0654a",
    Exam: "#b23a6b",
    App: "#c98a2b",
    UMS: "#2f8f8f",
    Quirio: "#3c7fbf",
    Content: "#5c8a3a",
  } as Record<string, string>,
  avatar: ["#12414f", "#1a7fae", "#1f7a5c", "#7b5ea7", "#c4322d", "#d98424", "#3c7fbf", "#c0654a"],
} as const;

export const D2_FONT = '"Instrument Sans", system-ui, sans-serif';
