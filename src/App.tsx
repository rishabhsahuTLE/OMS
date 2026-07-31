import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Approval from "./pages/report/Approval";
import Billing from "./pages/report/Billing";
import OrderPage from "./pages/orders/OrderPage";
import OrderApproval from "./pages/orders/OrderApproval";
import ApprovalSetting from "./pages/orders/ApprovalSetting";
import ManagerReport from "./pages/ManagerReport";
import clientsData from "./data/clients.json";
import { mockOrders } from "./data/mockOrders";
import { promoteSuccessorOf } from "./utils";
import type { AdminSubTabId, Client, MainTabId, OrderRecord, OrdersSubTabId, ReportSubTabId } from "./types";

const clients = clientsData as Client[];

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "report/approval": "Report / Approval",
  "report/billing": "Report / Billing",
  "report/managerReport": "Report / Manager Report",
  "orders/approval": "Order Management / Manage Orders",
  "orders/amendCancel": "Order Management / Approvals",
  "admin/approvalSetting": "Admin / Approval Setting",
};

function App() {
  const [activeTab, setActiveTab] = useState<MainTabId>("report");
  const [activeReportSubTab, setActiveReportSubTab] = useState<ReportSubTabId>("approval");
  const [activeOrdersSubTab, setActiveOrdersSubTab] = useState<OrdersSubTabId>("approval");
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<AdminSubTabId>("approvalSetting");
  const [orders, setOrders] = useState<OrderRecord[]>(mockOrders);
  const [createOrderPrefill, setCreateOrderPrefill] = useState<{ clientId: string; product: string } | null>(null);
  const [createOrderKey, setCreateOrderKey] = useState(0);

  function handleSelect(tab: MainTabId, subTab?: ReportSubTabId | OrdersSubTabId | AdminSubTabId) {
    setActiveTab(tab);
    if (tab === "report" && subTab) setActiveReportSubTab(subTab as ReportSubTabId);
    if (tab === "orders" && subTab) setActiveOrdersSubTab(subTab as OrdersSubTabId);
    if (tab === "admin" && subTab) setActiveAdminSubTab(subTab as AdminSubTabId);
  }

  function handleResetCreateOrder() {
    setCreateOrderPrefill(null);
    setCreateOrderKey((k) => k + 1);
  }

  function handleCreateOrder(record: OrderRecord) {
    setOrders((prev) => [record, ...prev]);
  }

  // Central order-update handler — whenever an update lands an order on
  // "cancelled" (Closed), also check whether some other order is an
  // amendment successor waiting on this one and promote it to Active in the
  // same pass (see promoteSuccessorOf in utils.ts).
  function handleUpdateOrder(record: OrderRecord) {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === record.id ? record : o));
      if (record.lifecycleStatus !== "cancelled") return next;
      const promoted = promoteSuccessorOf(record, next);
      return promoted ? next.map((o) => (o.id === promoted.id ? promoted : o)) : next;
    });
  }

  let titleKey = "dashboard";
  if (activeTab === "report") titleKey = `report/${activeReportSubTab}`;
  if (activeTab === "orders") titleKey = `orders/${activeOrdersSubTab}`;

  function renderPage() {
    if (activeTab === "dashboard") return <Dashboard />;
    if (activeTab === "report") {
      if (activeReportSubTab === "approval") return <Approval orders={orders} />;
      if (activeReportSubTab === "billing") return <Billing orders={orders} />;
      return <ManagerReport orders={orders} />;
    }
    if (activeTab === "admin") {
      return <ApprovalSetting />;
    }
    if (activeTab === "orders") {
      if (activeOrdersSubTab === "approval")
        return (
          <OrderApproval
            orders={orders}
            onUpdateOrder={handleUpdateOrder}
            clients={clients}
            onCreateOrder={handleCreateOrder}
            createOrderPrefill={createOrderPrefill}
            createOrderKey={createOrderKey}
            onResetCreateOrder={handleResetCreateOrder}
          />
        );
      return <OrderPage orders={orders} onUpdateOrder={handleUpdateOrder} />;
    }
    return null;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100">
      <Sidebar
        activeTab={activeTab}
        activeReportSubTab={activeReportSubTab}
        activeOrdersSubTab={activeOrdersSubTab}
        activeAdminSubTab={activeAdminSubTab}
        onSelect={handleSelect}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <h1 className="text-base font-semibold text-slate-800">{TITLES[titleKey]}</h1>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700">
              A
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{renderPage()}</main>
      </div>
    </div>
  );
}

export default App;
