import type { OrderRecord } from "../../types";
import type { DashboardFilters } from "./filters";
import type { NavigateFn } from "./shared";
import AgeAtStage from "./widgets/AgeAtStage";
import BillingActionsDue from "./widgets/BillingActionsDue";
import ManagerRevenue from "./widgets/ManagerRevenue";
import OpenedVsProjected from "./widgets/OpenedVsProjected";
import OrdersStuck from "./widgets/OrdersStuck";
import OutstandingBalance from "./widgets/OutstandingBalance";
import ProductRevenue from "./widgets/ProductRevenue";
import RejectedNeedsFix from "./widgets/RejectedNeedsFix";
import RevenueInMotion from "./widgets/RevenueInMotion";
import RevenueTrend from "./widgets/RevenueTrend";
import StageDistribution from "./widgets/StageDistribution";
import TatThisMonth from "./widgets/TatThisMonth";

interface AdminDashboardProps {
  orders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
}

// Admin's objective: "what's the overall health of the OMS?" — the broadest
// overview, but deliberately not personal/execution widgets: no Approval
// Queue, Clearance Stats, or My Pipeline here (per the matrix).
export default function AdminDashboard({ orders, filters, onNavigate }: AdminDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <StageDistribution orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-4">
        <BillingActionsDue orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-4">
        <OutstandingBalance orders={orders} filters={filters} compact />
      </div>

      <div className="lg:col-span-6">
        <OrdersStuck orders={orders} filters={filters} />
      </div>
      <div className="lg:col-span-6">
        <TatThisMonth orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-6">
        <OpenedVsProjected orders={orders} filters={filters} />
      </div>
      <div className="lg:col-span-6">
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
