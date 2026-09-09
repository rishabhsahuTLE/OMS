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
import ProductRevenue from "./widgets/ProductRevenue";
import RejectedNeedsFix from "./widgets/RejectedNeedsFix";
import RevenueInMotion from "./widgets/RevenueInMotion";
import RevenueTrend from "./widgets/RevenueTrend";
import StageDistribution from "./widgets/StageDistribution";

interface FinanceDashboardProps {
  orders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
}

// Finance's objective: "what needs financial/billing action, and what's the
// revenue impact?" — a deliberate mixture of execution widgets (Approval
// Queue, Billing Actions Due) and financial analytics. No My Pipeline (that's
// BD's own portfolio view, not Finance's job) — per the matrix, not CSS.
export default function FinanceDashboard({ orders, filters, onNavigate }: FinanceDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <BillingActionsDue orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-4">
        <StageDistribution orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-4">
        <OutstandingBalance orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-12">
        <ApprovalQueue orders={orders} filters={filters} dept="Finance" onNavigate={onNavigate} />
      </div>

      <div className="lg:col-span-6">
        <OrdersStuck orders={orders} filters={filters} dept="Finance" />
      </div>
      <div className="lg:col-span-6">
        <OpenedVsProjected orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-12">
        <RevenueInMotion orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-6">
        <ProductRevenue orders={orders} filters={filters} />
      </div>
      <div className="lg:col-span-6">
        <ClearanceStats orders={orders} filters={filters} />
      </div>

      <div className="lg:col-span-12">
        <RevenueTrend orders={orders} filters={filters} />
      </div>
      <div className="lg:col-span-12">
        <ManagerRevenue orders={orders} filters={filters} onNavigate={onNavigate} />
      </div>

      <div className="lg:col-span-12">
        <RejectedNeedsFix orders={orders} filters={filters} dept="Finance" onNavigate={onNavigate} />
      </div>
      <div className="lg:col-span-12">
        <AgeAtStage orders={orders} filters={filters} dept="Finance" onNavigate={onNavigate} />
      </div>
    </div>
  );
}
