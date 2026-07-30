import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Approval from "./pages/report/Approval";
import Billing from "./pages/report/Billing";
import OrderPage from "./pages/orders/OrderPage";
import OrderApproval from "./pages/orders/OrderApproval";
import ApprovalSetting from "./pages/orders/ApprovalSetting";
import CloseBilling from "./pages/orders/CloseBilling";
import ManagerReport from "./pages/ManagerReport";
import clientsData from "./data/clients.json";
import { mockOrders } from "./data/mockOrders";
import type {
  AdminSubTabId,
  BillingStatus,
  Client,
  MainTabId,
  OrderRecord,
  OrdersSubTabId,
  ReportSubTabId,
} from "./types";

const clients = clientsData as Client[];

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "report/approval": "Report / Approval",
  "report/billing": "Report / Billing",
  "report/managerReport": "Report / Manager Report",
  "orders/amendCancel": "Order Management / Amend / Cancel",
  "orders/approval": "Order Management / Manage Orders",
  "orders/closeBilling": "Order Management / Close Billing",
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
  const [autoOpenOrderModal, setAutoOpenOrderModal] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);

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

  function handleUpdateOrder(record: OrderRecord) {
    setOrders((prev) => prev.map((o) => (o.id === record.id ? record : o)));
  }

  // A duplicate-order check (University client + product already ordered)
  // hands the existing order back here; jump to the Amend/Cancel tab and
  // open it for editing there, and clear whatever was in progress on Create.
  function handleRequestAmend(order: OrderRecord) {
    setEditOrderId(order.id);
    setAutoOpenOrderModal(true);
    setActiveTab("orders");
    setActiveOrdersSubTab("amendCancel");
    handleResetCreateOrder();
  }

  // Closing billing on a cancelled order that was superseded by an amendment
  // is also what finally activates that amendment's successor — see
  // CloseBilling.tsx's isClosable(), which only allows closing such an order
  // once its successor has already reached "pendingClosure".
  function handleSetBillingStatus(ids: string[], billingStatus: BillingStatus) {
    const idSet = new Set(ids);
    setOrders((prev) => {
      const next = prev.map((o) => (idSet.has(o.id) ? { ...o, billingStatus } : o));
      if (billingStatus !== "Closed") return next;
      const successorIdsToActivate = new Set(
        prev
          .filter((o) => idSet.has(o.id))
          .map((o) => prev.find((s) => s.supersedes === o.id && s.lifecycleStatus === "pendingClosure"))
          .filter((s): s is OrderRecord => s !== undefined)
          .map((s) => s.id)
      );
      return next.map((o) => (successorIdsToActivate.has(o.id) ? { ...o, lifecycleStatus: "active" } : o));
    });
  }

  function handleUpdateBillingRemarks(id: string, billingRemarks: string) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, billingRemarks } : o)));
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
            onRequestAmend={handleRequestAmend}
            onNavigateToCloseBilling={() => setActiveOrdersSubTab("closeBilling")}
          />
        );
      if (activeOrdersSubTab === "amendCancel")
        return (
          <OrderPage
            clients={clients}
            orders={orders}
            onCreateOrder={handleCreateOrder}
            onUpdateOrder={handleUpdateOrder}
            autoOpen={autoOpenOrderModal}
            editOrderId={editOrderId}
            onAutoOpenHandled={() => {
              setAutoOpenOrderModal(false);
              setEditOrderId(null);
            }}
          />
        );
      return (
        <CloseBilling
          orders={orders}
          onSetBillingStatus={handleSetBillingStatus}
          onUpdateBillingRemarks={handleUpdateBillingRemarks}
        />
      );
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
