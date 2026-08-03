import { useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import EmpowerTopBar from "./components/EmpowerTopBar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/Report";
import OrderPage from "./pages/orders/OrderPage";
import OrderApproval from "./pages/orders/OrderApproval";
import clientsData from "./data/clients.json";
import { mockOrders } from "./data/mockOrders";
import { promoteSuccessorOf } from "./utils";
import type { Client, MainTabId, OrderRecord, OrdersSubTabId, ReportSubTabId } from "./types";

const clients = clientsData as Client[];

function buildPath(
  tab: MainTabId,
  subTab?: ReportSubTabId | OrdersSubTabId,
  params?: Record<string, string>
) {
  const base = tab === "dashboard" ? "/dashboard" : subTab ? `/${tab}/${subTab}` : `/${tab}`;
  if (!params || Object.keys(params).length === 0) return base;
  return `${base}?${new URLSearchParams(params).toString()}`;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRecord[]>(mockOrders);
  const [createOrderPrefill, setCreateOrderPrefill] = useState<{ clientId: string; product: string } | null>(null);
  const [createOrderKey, setCreateOrderKey] = useState(0);

  // Sidebar's active-tab/sub-tab highlighting is derived straight from the
  // URL rather than app state — Sidebar itself needs no changes for this.
  const [, tabSeg, subSeg] = location.pathname.split("/");
  const activeTab = (tabSeg || "dashboard") as MainTabId;
  const activeOrdersSubTab = (subSeg as OrdersSubTabId) || "approval";

  function handleSelect(
    tab: MainTabId,
    subTab?: ReportSubTabId | OrdersSubTabId,
    params?: Record<string, string>
  ) {
    navigate(buildPath(tab, subTab, params));
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

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100">
      <EmpowerTopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeTab={activeTab} activeOrdersSubTab={activeOrdersSubTab} onSelect={handleSelect} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-auto p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard orders={orders} onNavigate={handleSelect} />} />
              <Route path="/report" element={<Navigate to="/report/approval" replace />} />
              <Route path="/report/:subTab" element={<Report orders={orders} />} />
              <Route path="/orders" element={<Navigate to="/orders/approval" replace />} />
              <Route
                path="/orders/approval"
                element={
                  <OrderApproval
                    orders={orders}
                    onUpdateOrder={handleUpdateOrder}
                    clients={clients}
                    onCreateOrder={handleCreateOrder}
                    createOrderPrefill={createOrderPrefill}
                    createOrderKey={createOrderKey}
                    onResetCreateOrder={handleResetCreateOrder}
                  />
                }
              />
              <Route path="/orders/amendCancel" element={<OrderPage orders={orders} onUpdateOrder={handleUpdateOrder} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
