import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Approval from "./pages/report/Approval";
import Billing from "./pages/report/Billing";
import OrderPage from "./pages/orders/OrderPage";
import CreateOrderModal from "./pages/orders/CreateOrderModal";
import OrderApproval from "./pages/orders/OrderApproval";
import ApprovalSetting from "./pages/orders/ApprovalSetting";
import CloseBilling from "./pages/orders/CloseBilling";
import ManagerReport from "./pages/ManagerReport";
import clientsData from "./data/clients.json";
import { mockOrders } from "./data/mockOrders";
import { nextOrderNumber, todayISO } from "./utils";
import type { BillingStatus, Client, MainTabId, OrderRecord, OrdersSubTabId, ReportSubTabId } from "./types";

const clients = clientsData as Client[];

const TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "report/approval": "Report / Approval",
  "report/billing": "Report / Billing",
  "report/managerReport": "Report / Manager Report",
  "orders/order": "Order Management / Order",
  "orders/createOrder": "Order Management / Create Order",
  "orders/approval": "Order Management / Approval",
  "orders/approvalSetting": "Order Management / Approval Setting",
  "orders/closeBilling": "Order Management / Close Billing",
};

function App() {
  const [activeTab, setActiveTab] = useState<MainTabId>("report");
  const [activeReportSubTab, setActiveReportSubTab] = useState<ReportSubTabId>("approval");
  const [activeOrdersSubTab, setActiveOrdersSubTab] = useState<OrdersSubTabId>("createOrder");
  const [orders, setOrders] = useState<OrderRecord[]>(mockOrders);
  const [createOrderPrefill, setCreateOrderPrefill] = useState<{ clientId: string; product: string } | null>(null);
  const [createOrderKey, setCreateOrderKey] = useState(0);
  const [autoOpenOrderModal, setAutoOpenOrderModal] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);

  function handleSelect(tab: MainTabId, subTab?: ReportSubTabId | OrdersSubTabId) {
    setActiveTab(tab);
    if (tab === "report" && subTab) setActiveReportSubTab(subTab as ReportSubTabId);
    if (tab === "orders" && subTab) setActiveOrdersSubTab(subTab as OrdersSubTabId);
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

  function handleDeleteOrder(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  // A duplicate-order check (University client + product already ordered)
  // hands the existing order back here; jump to the Order tab and open it
  // for editing there, and clear whatever was in progress on Create Order.
  function handleRequestAmend(order: OrderRecord) {
    setEditOrderId(order.id);
    setAutoOpenOrderModal(true);
    setActiveTab("orders");
    setActiveOrdersSubTab("order");
    handleResetCreateOrder();
  }

  function handleSetBillingStatus(ids: string[], billingStatus: BillingStatus) {
    const idSet = new Set(ids);
    setOrders((prev) => prev.map((o) => (idSet.has(o.id) ? { ...o, billingStatus } : o)));
  }

  function handleUpdateBillingRemarks(id: string, billingRemarks: string) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, billingRemarks } : o)));
  }

  function handleCreateOrderNow(fromOrder: OrderRecord) {
    setCreateOrderPrefill({ clientId: fromOrder.clientId, product: fromOrder.product });
    setCreateOrderKey((k) => k + 1);
    setActiveTab("orders");
    setActiveOrdersSubTab("createOrder");
  }

  function handleCreateOrderLater(fromOrder: OrderRecord) {
    const client = clients.find((c) => c.id === fromOrder.clientId);
    if (!client) return;

    const placeholder: OrderRecord = {
      id: `ord-${Math.random().toString(36).slice(2, 10)}`,
      orderNo: nextOrderNumber(orders, client.id),
      product: fromOrder.product,
      clientId: client.id,
      client: client.name,
      clientManager: client.clientManager,
      dateOfSign: "",
      createdOn: todayISO(),
      amount: 0,
      technical: { status: "pending", date: null },
      financial: { status: "pending", date: null },
      lifecycleStatus: "inactive",
      cancellationTechnical: { status: "pending", date: null },
      cancellationFinancial: { status: "pending", date: null },
      billingCycle: "",
      billingStatus: "Open",
      billingRemarks: "",
      amended: false,
      incomplete: true,
      details: {
        clientManager: client.clientManager,
        billingAddress: client.billingAddress,
        billingState: client.billingState,
        billingCity: client.billingCity,
        deliveryAddress: client.deliveryAddress,
        deliveryState: client.deliveryState,
        deliveryCity: client.deliveryCity,
        gstNo: client.gstNo,
        spocs: client.spocs,
        product: fromOrder.product,
        dateOfSign: "",
        plan: "",
        oneTime: null,
        gstProcess: "",
        selectGst: client.gstNo || "NA",
        firstBillingMonth: "",
        billingCycle: "",
        agreement: null,
        advance: null,
        tds: null,
        netAmount: 0,
        creditPeriod: null,
        documents: [],
        remarks: "",
      },
    };

    handleCreateOrder(placeholder);
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
    if (activeTab === "orders") {
      if (activeOrdersSubTab === "approvalSetting") return <ApprovalSetting />;
      if (activeOrdersSubTab === "approval") return <OrderApproval orders={orders} onUpdateOrder={handleUpdateOrder} />;
      if (activeOrdersSubTab === "order")
        return (
          <OrderPage
            clients={clients}
            orders={orders}
            onCreateOrder={handleCreateOrder}
            onUpdateOrder={handleUpdateOrder}
            onDeleteOrder={handleDeleteOrder}
            prefill={null}
            autoOpen={autoOpenOrderModal}
            editOrderId={editOrderId}
            onAutoOpenHandled={() => {
              setAutoOpenOrderModal(false);
              setEditOrderId(null);
            }}
          />
        );
      if (activeOrdersSubTab === "createOrder")
        return (
          <CreateOrderModal
            key={createOrderKey}
            open
            embedded
            clients={clients}
            orders={orders}
            prefillClientId={createOrderPrefill?.clientId}
            prefillProduct={createOrderPrefill?.product}
            onCreate={handleCreateOrder}
            onUpdate={handleUpdateOrder}
            onClose={() => {}}
            onReset={handleResetCreateOrder}
            onRequestAmend={handleRequestAmend}
          />
        );
      return (
        <CloseBilling
          orders={orders}
          onSetBillingStatus={handleSetBillingStatus}
          onUpdateBillingRemarks={handleUpdateBillingRemarks}
          onCreateOrderNow={handleCreateOrderNow}
          onCreateOrderLater={handleCreateOrderLater}
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
