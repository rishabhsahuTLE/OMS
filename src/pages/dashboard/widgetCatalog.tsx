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

// A widget's tier is what its row-mates are drawn from and roughly how tall
// it naturally renders — grouping by tier (rather than one blanket grid) is
// what keeps row-mates the same height without that height being dictated
// by a much taller or much shorter neighbor. Deliberately just two grid
// tiers ("tall" and "short") rather than a finer-grained size per widget:
// - "tall": the 4 donut/bar charts and the 2 approval-queue tables — all in
//   the same ~380-500px range.
// - "short": the simpler single/double-KPI stat tiles — all ~150-220px.
// "full" widgets (data tables and Billing Actions Due) always take the
// entire row to themselves regardless of what else is visible.
export type WidgetTier = "tall" | "short" | "full";

// The CSS grid-template-columns value each grid-shaped tier lays its visible
// members out with. Each column has a target width with only a little give
// (not a bare 1fr) — turning a widget on/off changes how many *columns* fit
// per row, but a partial row is left as genuine empty space at the end
// rather than stretching the widgets that are present to fill it.
export const TIER_GRID_COLUMNS: Partial<Record<WidgetTier, string>> = {
  tall: "repeat(auto-fill,minmax(520px,600px))",
  short: "repeat(auto-fill,minmax(300px,360px))",
};

// Every grid-tier widget shares one fixed height per tier, so row-mates are
// never stretched unevenly and a widget with little content doesn't just
// get taller with dead space — it gets to lay that same content out at a
// more generous, centered size instead (see each widget's own JSX).
export const TIER_HEIGHT_PX: Partial<Record<WidgetTier, number>> = {
  tall: 420,
  short: 210,
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
// buildWidgetSections, which walks this list and only starts a new grid
// section when the tier changes (or a "full" widget is reached) — so e.g.
// the tall-tier chart widgets near the top and the tall-tier approval
// queues further down each still form their own row-group, since a "full"
// widget (Billing Actions Due) sits between them and breaks the run.
export const WIDGET_CATALOG: WidgetDef[] = [
  {
    key: "stageDistribution",
    label: "Stage Distribution",
    tier: "tall",
    render: (p) => <StageDistribution orders={p.orders} filters={p.filters} onNavigate={p.onNavigate} />,
  },
  {
    key: "ordersStuck",
    label: "Where Orders Are Stuck",
    tier: "tall",
    render: (p) => <OrdersStuck orders={p.orders} filters={p.filters} />,
  },
  {
    key: "productRevenue",
    label: "Product-wise Revenue",
    tier: "tall",
    render: (p) => <ProductRevenue orders={p.orders} filters={p.filters} />,
  },
  {
    key: "tat",
    label: "TAT — This Month",
    tier: "tall",
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
    tier: "short",
    render: (p) => <OutstandingBalance orders={p.orders} filters={p.filters} />,
  },
  {
    key: "revenueInMotion",
    label: "Revenue in Motion",
    tier: "short",
    render: (p) => <RevenueInMotion orders={p.orders} filters={p.filters} />,
  },
  {
    key: "openedVsProjected",
    label: "Revenue — Opened vs Projected",
    tier: "short",
    render: (p) => <OpenedVsProjected orders={p.orders} filters={p.filters} />,
  },
  {
    key: "clearanceStats",
    label: "Clearance Stats",
    tier: "short",
    render: (p) => <ClearanceStats orders={p.orders} filters={p.filters} />,
  },
  {
    key: "pipelineOverview",
    label: "Pipeline Overview",
    tier: "short",
    render: (p) => <PipelineOverview orders={p.orders} filters={p.filters} />,
  },
  {
    key: "approvalQueueTech",
    label: "Technical Approval Queue",
    tier: "tall",
    render: (p) => <ApprovalQueue orders={p.orders} filters={p.filters} dept="Tech" onNavigate={p.onNavigate} />,
  },
  {
    key: "approvalQueueFinance",
    label: "Financial Approval Queue",
    tier: "tall",
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
