import { useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import EmpowerTopBar from "./components/EmpowerTopBar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/Report";
import OrderPage from "./pages/orders/OrderPage";
import OrderApproval from "./pages/orders/OrderApproval";
import CloseBilling from "./pages/orders/CloseBilling";
import clientsData from "./data/clients.json";
import { mockOrders } from "./data/mockOrders";
import { resolveAmendmentOf } from "./utils";
import type { Client, MainTabId, OrderRecord, OrdersSubTabId, ReportSubTabId } from "./types";

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
  // Session-only, in-memory, same as `orders` — no persistence anywhere in
  // this app, so a refresh resets both back to their seed data.
  const [clients, setClients] = useState<Client[]>(clientsData as Client[]);
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

  function handleUpdateClient(record: Client) {
    setClients((prev) => prev.map((c) => (c.id === record.id ? record : c)));
  }

  // Central order-update handler — whenever an update lands an order on
  // "active", also check whether it's an amendment successor and cancel the
  // predecessor it superseded in the same pass (see resolveAmendmentOf in
  // utils.ts) — the one-process amendment model's sole promotion trigger.
  function handleUpdateOrder(record: OrderRecord) {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === record.id ? record : o));
      if (record.lifecycleStatus !== "active") return next;
      const resolved = resolveAmendmentOf(record, next);
      return resolved ? next.map((o) => (o.id === resolved.id ? resolved : o)) : next;
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
                    onUpdateClient={handleUpdateClient}
                    onCreateOrder={handleCreateOrder}
                    createOrderPrefill={createOrderPrefill}
                    createOrderKey={createOrderKey}
                    onResetCreateOrder={handleResetCreateOrder}
                  />
                }
              />
              <Route path="/orders/amendCancel" element={<OrderPage orders={orders} onUpdateOrder={handleUpdateOrder} />} />
              <Route path="/orders/closeBilling" element={<CloseBilling orders={orders} onUpdateOrder={handleUpdateOrder} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
