import { useState } from "react";
import type { MainTabId, OrdersSubTabId, ReportSubTabId } from "../types";

interface SubTab<T extends string> {
  id: T;
  label: string;
}

const reportSubTabs: SubTab<ReportSubTabId>[] = [
  { id: "approval", label: "Approval" },
  { id: "billing", label: "Billing" },
];

const ordersSubTabs: SubTab<OrdersSubTabId>[] = [
  { id: "order", label: "Order" },
  { id: "approvalSetting", label: "Approval Setting" },
  { id: "closeBilling", label: "Close Billing" },
];

interface SidebarProps {
  activeTab: MainTabId;
  activeReportSubTab: ReportSubTabId;
  activeOrdersSubTab: OrdersSubTabId;
  onSelect: (
    tab: MainTabId,
    subTab?: ReportSubTabId | OrdersSubTabId
  ) => void;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform duration-150 ${
        open ? "rotate-90" : ""
      }`}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 3h6v6H3V3zm8 0h6v4h-6V3zM3 11h6v6H3v-6zm8 2h6v4h-6v-4z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H4zm2 10a1 1 0 112 0v1a1 1 0 11-2 0v-1zm4-4a1 1 0 112 0v5a1 1 0 11-2 0V9zm4-2a1 1 0 112 0v7a1 1 0 11-2 0V7z" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4a1 1 0 011-1h10a1 1 0 011 1v1H4V4zM3 7h14l-1 9a1 1 0 01-1 1H5a1 1 0 01-1-1L3 7zm5 3a1 1 0 000 2h4a1 1 0 100-2H8z" />
    </svg>
  );
}

function ManagerReportIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6 2a2 2 0 00-2 2v1H3a1 1 0 00-1 1v9a2 2 0 002 2h12a2 2 0 002-2V6a1 1 0 00-1-1h-1V4a2 2 0 00-2-2H6zm0 3V4h6v1H6zM3 8h12v2H3V8zm0 3h5v2H3v-2z" />
    </svg>
  );
}

export default function Sidebar({
  activeTab,
  activeReportSubTab,
  activeOrdersSubTab,
  onSelect,
}: SidebarProps) {
  const [reportOpen, setReportOpen] = useState(activeTab === "report");
  const [ordersOpen, setOrdersOpen] = useState(activeTab === "orders");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-200">
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500 font-semibold text-white">
          O
        </div>
        <span className="text-lg font-semibold text-white">OMS</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <button
          onClick={() => onSelect("dashboard")}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "dashboard"
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <DashboardIcon />
          Dashboard
        </button>

        <div>
          <button
            onClick={() => {
              setReportOpen((v) => !v);
              if (activeTab !== "report") onSelect("report", activeReportSubTab);
            }}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "report"
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <ReportIcon />
            <span className="flex-1 text-left">Report</span>
            <ChevronIcon open={reportOpen} />
          </button>
          {reportOpen && (
            <div className="mt-1 space-y-0.5 pl-9">
              {reportSubTabs.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => onSelect("report", sub.id)}
                  className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    activeTab === "report" && activeReportSubTab === sub.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => {
              setOrdersOpen((v) => !v);
              if (activeTab !== "orders") onSelect("orders", activeOrdersSubTab);
            }}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "orders"
                ? "bg-slate-800 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <OrdersIcon />
            <span className="flex-1 text-left">Order Management</span>
            <ChevronIcon open={ordersOpen} />
          </button>
          {ordersOpen && (
            <div className="mt-1 space-y-0.5 pl-9">
              {ordersSubTabs.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => onSelect("orders", sub.id)}
                  className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                    activeTab === "orders" && activeOrdersSubTab === sub.id
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onSelect("managerReport")}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "managerReport"
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <ManagerReportIcon />
          Manager Report
        </button>
      </nav>
    </aside>
  );
}
