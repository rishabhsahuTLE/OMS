import type { OrderRecord } from "../../types";
import type { DashboardFilters } from "./filters";
import type { NavigateFn } from "./shared";
import AgeAtStage from "./widgets/AgeAtStage";
import ApprovalQueue from "./widgets/ApprovalQueue";
import ClearanceStats from "./widgets/ClearanceStats";
import OrdersStuck from "./widgets/OrdersStuck";
import RejectedNeedsFix from "./widgets/RejectedNeedsFix";
import StageDistribution from "./widgets/StageDistribution";
import TatThisMonth from "./widgets/TatThisMonth";

interface TechDashboardProps {
  orders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
}

// Tech's objective: "what needs technical action?" — operational, not
// revenue-heavy. Per the role→widget matrix this dashboard never renders
// Billing Actions Due, Outstanding Balance, Product-wise Revenue, Revenue
// Trend, Revenue in Motion, Opened vs Projected, Manager-wise Revenue, or My
// Pipeline — there's no CSS hiding involved, those widgets simply aren't
// imported into this file.
// Widgets are grouped by natural shape/height, not just by the prompt's
// literal TOP/MAIN/BOTTOM order — pairing a donut+list card (Stage
// Distribution) next to a single-number KPI card (Clearance Stats) leaves
// the grid row stretched to the taller one's height, with dead space inside
// the shorter card. Same-shape widgets are paired instead so a row's height
// is never dictated by a mismatched neighbor.
export default function TechDashboard({ orders, filters, onNavigate }: TechDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-6">
        <StageDistribution orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-6">
        <OrdersStuck orders={orders} filters={filters} dept="Tech" />
      </div>

      <div className="lg:col-span-12">
        <ApprovalQueue orders={orders} filters={filters} dept="Tech" onNavigate={onNavigate} />
      </div>

      <div className="lg:col-span-6">
        <TatThisMonth orders={orders} filters={filters} dept="Tech" />
      </div>
      <div className="lg:col-span-6">
        <ClearanceStats orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-12">
        <RejectedNeedsFix orders={orders} filters={filters} dept="Tech" onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-12">
        <AgeAtStage orders={orders} filters={filters} dept="Tech" onNavigate={onNavigate} />
      </div>
    </div>
  );
}
