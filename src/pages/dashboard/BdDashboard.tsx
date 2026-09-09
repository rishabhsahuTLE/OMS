import type { OrderRecord } from "../../types";
import type { DashboardFilters } from "./filters";
import type { NavigateFn } from "./shared";
import AgeAtStage from "./widgets/AgeAtStage";
import BillingActionsDue from "./widgets/BillingActionsDue";
import ManagerRevenue from "./widgets/ManagerRevenue";
import MyPipeline from "./widgets/MyPipeline";
import OpenedVsProjected from "./widgets/OpenedVsProjected";
import OrdersStuck from "./widgets/OrdersStuck";
import ProductRevenue from "./widgets/ProductRevenue";
import RejectedNeedsFix from "./widgets/RejectedNeedsFix";
import RevenueInMotion from "./widgets/RevenueInMotion";
import RevenueTrend from "./widgets/RevenueTrend";
import StageDistribution from "./widgets/StageDistribution";

interface BdDashboardProps {
  orders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
}

// BD's objective: "what's happening to my pipeline and revenue?" — the most
// commercially-oriented dashboard. My Pipeline is BD-only per the matrix; no
// Approval Queue/Clearance Stats here, those are execution-level widgets
// that belong to whoever actually makes the Tech/Fin decision.
// Grouped by shape/height (see TechDashboard.tsx's note): the two short KPI
// tiles share a row, the three donut-chart widgets share a row, rather than
// mixing shapes and stretching the shorter card to a taller neighbor's height.
export default function BdDashboard({ orders, filters, onNavigate }: BdDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-12">
        <MyPipeline orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-6">
        <BillingActionsDue orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-6">
        <OpenedVsProjected orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-6">
        <StageDistribution orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-6">
        <OrdersStuck orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-12">
        <RevenueInMotion orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-6">
        <ProductRevenue orders={orders} filters={filters} />
      </div>
      <div className="lg:col-span-6">
        <ManagerRevenue orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>

      <div className="lg:col-span-12">
        <RevenueTrend orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-12">
        <RejectedNeedsFix orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-12">
        <AgeAtStage orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
