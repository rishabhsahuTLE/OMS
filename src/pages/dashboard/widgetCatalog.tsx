import type { ReactNode } from "react";
import type { OrderRecord } from "../../types";
import type { DashboardFilters } from "./filters";
import type { NavigateFn } from "./shared";
import AgeAtStage from "./widgets/AgeAtStage";
import ApprovalQueue from "./widgets/ApprovalQueue";
import BillingActionsDue from "./widgets/BillingActionsDue";
import ClearanceStats from "./widgets/ClearanceStats";
import ManagerRevenue from "./widgets/ManagerRevenue";
import OpenedVsProjected from "./widgets/OpenedVsProjected";
import OrdersStuck from "./widgets/OrdersStuck";
import OutstandingBalance from "./widgets/OutstandingBalance";
import PipelineOverview from "./widgets/PipelineOverview";
import ProductRevenue from "./widgets/ProductRevenue";
import RejectedNeedsFix from "./widgets/RejectedNeedsFix";
import RevenueInMotion from "./widgets/RevenueInMotion";
import RevenueTrend from "./widgets/RevenueTrend";
import StageDistribution from "./widgets/StageDistribution";
import TatThisMonth from "./widgets/TatThisMonth";

// The single source of truth for "what widgets exist" — the Configuration
// page renders its checklist from this list, and Dashboard.tsx renders the
// page from this same list filtered by which keys are checked. Add a widget
// here once and it shows up correctly in both places; nothing about the
// dashboard layout hardcodes widget names anymore.

export type WidgetKey =
  | "stageDistribution"
  | "ordersStuck"
  | "productRevenue"
  | "tat"
  | "billingActionsDue"
  | "outstandingBalance"
  | "revenueInMotion"
  | "openedVsProjected"
  | "clearanceStats"
  | "pipelineOverview"
  | "approvalQueueTech"
  | "approvalQueueFinance"
  | "managerRevenue"
  | "revenueTrend"
  | "rejectedNeedsFix"
  | "ageAtStage";

// A widget's tier is what its row-mates are drawn from and how wide each
// gets at minimum — grouping by tier (rather than one blanket grid) is what
// keeps a lane's row height from ever being dictated by a much taller or
// much shorter neighbor (see ui.tsx's DashboardCard and buildWidgetSections
// below). "full" widgets (tables and the two big charts) always take the
// entire row to themselves regardless of what else is visible.
export type WidgetTier = "chart" | "statSmall" | "statMedium" | "queue" | "full";

// The CSS grid-template-columns value each grid-shaped tier lays its visible
// members out with — auto-fit distributes however many are actually
// checked across 1-4 columns and stretches them to fill the row, so turning
// a widget on/off never leaves a gap or a squeezed-in extra column.
export const TIER_GRID_COLUMNS: Partial<Record<WidgetTier, string>> = {
  chart: "repeat(auto-fit,minmax(560px,1fr))",
  statSmall: "repeat(auto-fit,minmax(320px,1fr))",
  statMedium: "repeat(auto-fit,minmax(380px,1fr))",
  queue: "repeat(auto-fit,minmax(560px,1fr))",
};

export interface WidgetCommonProps {
  orders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
}

export interface WidgetDef {
  key: WidgetKey;
  label: string;
  tier: WidgetTier;
  render: (props: WidgetCommonProps) => ReactNode;
}

// Order here is the dashboard's display order top-to-bottom — see
// buildWidgetSections, which walks this list and only starts a new section
// when the tier actually changes, so e.g. the four chart-tier widgets stay
// one shared row-group even though other tiers sit before and after them.
export const WIDGET_CATALOG: WidgetDef[] = [
  {
    key: "stageDistribution",
    label: "Stage Distribution",
    tier: "chart",
    render: (p) => <StageDistribution orders={p.orders} filters={p.filters} onNavigate={p.onNavigate} />,
  },
  {
    key: "ordersStuck",
    label: "Where Orders Are Stuck",
    tier: "chart",
    render: (p) => <OrdersStuck orders={p.orders} filters={p.filters} />,
  },
  {
    key: "productRevenue",
    label: "Product-wise Revenue",
    tier: "chart",
    render: (p) => <ProductRevenue orders={p.orders} filters={p.filters} />,
  },
  {
    key: "tat",
    label: "TAT — This Month",
    tier: "chart",
    render: (p) => <TatThisMonth orders={p.orders} filters={p.filters} />,
  },
  {
    key: "billingActionsDue",
    label: "Billing Actions Due",
    tier: "full",
    render: (p) => <BillingActionsDue orders={p.orders} filters={p.filters} onNavigate={p.onNavigate} />,
  },
  {
    key: "outstandingBalance",
    label: "Outstanding Balance (To Close)",
    tier: "statSmall",
    render: (p) => <OutstandingBalance orders={p.orders} filters={p.filters} />,
  },
  {
    key: "revenueInMotion",
    label: "Revenue in Motion",
    tier: "statSmall",
    render: (p) => <RevenueInMotion orders={p.orders} filters={p.filters} />,
  },
  {
    key: "openedVsProjected",
    label: "Revenue — Opened vs Projected",
    tier: "statSmall",
    render: (p) => <OpenedVsProjected orders={p.orders} filters={p.filters} />,
  },
  {
    key: "clearanceStats",
    label: "Clearance Stats",
    tier: "statMedium",
    render: (p) => <ClearanceStats orders={p.orders} filters={p.filters} />,
  },
  {
    key: "pipelineOverview",
    label: "Pipeline Overview",
    tier: "statMedium",
    render: (p) => <PipelineOverview orders={p.orders} filters={p.filters} />,
  },
  {
    key: "approvalQueueTech",
    label: "Technical Approval Queue",
    tier: "queue",
    render: (p) => <ApprovalQueue orders={p.orders} filters={p.filters} dept="Tech" onNavigate={p.onNavigate} />,
  },
  {
    key: "approvalQueueFinance",
    label: "Financial Approval Queue",
    tier: "queue",
    render: (p) => <ApprovalQueue orders={p.orders} filters={p.filters} dept="Finance" onNavigate={p.onNavigate} />,
  },
  {
    key: "managerRevenue",
    label: "Manager-wise Revenue",
    tier: "full",
    render: (p) => <ManagerRevenue orders={p.orders} filters={p.filters} onNavigate={p.onNavigate} />,
  },
  {
    key: "revenueTrend",
    label: "Revenue Trend by Business Unit",
    tier: "full",
    render: (p) => <RevenueTrend orders={p.orders} filters={p.filters} />,
  },
  {
    key: "rejectedNeedsFix",
    label: "Rejected — Needs Fix",
    tier: "full",
    render: (p) => <RejectedNeedsFix orders={p.orders} filters={p.filters} onNavigate={p.onNavigate} />,
  },
  {
    key: "ageAtStage",
    label: "Age at Stage — Order-wise",
    tier: "full",
    render: (p) => <AgeAtStage orders={p.orders} filters={p.filters} onNavigate={p.onNavigate} />,
  },
];

export const DEFAULT_VISIBLE_WIDGETS: Set<WidgetKey> = new Set(WIDGET_CATALOG.map((w) => w.key));

export type WidgetSection =
  | { type: "grid"; tier: WidgetTier; items: WidgetDef[] }
  | { type: "solo"; item: WidgetDef };

// Groups consecutive same-tier, currently-visible widgets into one shared
// auto-fit row; a "full" tier widget always gets its own solo section
// regardless of its neighbors, since those are never meant to sit side by
// side no matter how many happen to be visible.
export function buildWidgetSections(visible: Set<WidgetKey>): WidgetSection[] {
  const sections: WidgetSection[] = [];
  for (const item of WIDGET_CATALOG) {
    if (!visible.has(item.key)) continue;
    if (item.tier === "full") {
      sections.push({ type: "solo", item });
      continue;
    }
    const last = sections[sections.length - 1];
    if (last && last.type === "grid" && last.tier === item.tier) {
      last.items.push(item);
    } else {
      sections.push({ type: "grid", tier: item.tier, items: [item] });
    }
  }
  return sections;
}
