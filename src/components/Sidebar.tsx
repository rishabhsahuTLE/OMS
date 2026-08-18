import { useState } from "react";
import type { MainTabId, OrdersSubTabId, ReportSubTabId } from "../types";

interface SubTab<T extends string> {
  id: T;
  label: string;
}

const ordersSubTabs: SubTab<OrdersSubTabId>[] = [
  { id: "approval", label: "Manage Orders" },
  { id: "amendCancel", label: "Approvals" },
  { id: "closeBilling", label: "Open/Close Billing" },
];

interface SidebarProps {
  activeTab: MainTabId;
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
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 3h6v6H3V3zm8 0h6v4h-6V3zM3 11h6v6H3v-6zm8 2h6v4h-6v-4z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H4zm2 10a1 1 0 112 0v1a1 1 0 11-2 0v-1zm4-4a1 1 0 112 0v5a1 1 0 11-2 0V9zm4-2a1 1 0 112 0v7a1 1 0 11-2 0V7z" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4a1 1 0 011-1h10a1 1 0 011 1v1H4V4zM3 7h14l-1 9a1 1 0 01-1 1H5a1 1 0 01-1-1L3 7zm5 3a1 1 0 000 2h4a1 1 0 100-2H8z" />
    </svg>
  );
}

export default function Sidebar({
  activeTab,
  activeOrdersSubTab,
  onSelect,
}: SidebarProps) {
  // The rail itself expands on hover (icon-only at rest); each category's
  // sub-item list drops down on hover of that category and collapses when
  // the cursor leaves it — both independent of click state.
  const [expanded, setExpanded] = useState(false);
  const [ordersHovered, setOrdersHovered] = useState(false);

  function collapseAll() {
    setExpanded(false);
    setOrdersHovered(false);
  }

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={collapseAll}
      className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-indigo-900 text-slate-200 transition-all duration-150 ${
        expanded ? "w-64" : "w-16"
      }`}
    >
      <div className={`flex h-16 shrink-0 items-center gap-2 border-b border-indigo-800 ${expanded ? "px-5" : "justify-center px-2"}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-500 font-semibold text-white">
          O
        </div>
        {expanded && <span className="whitespace-nowrap text-lg font-semibold text-white">OMS</span>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <button
          onClick={() => onSelect("dashboard")}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            !expanded ? "justify-center" : ""
          } ${
            activeTab === "dashboard"
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <DashboardIcon />
          {expanded && <span className="whitespace-nowrap">Dashboard</span>}
        </button>

        <button
          onClick={() => onSelect("report", "billing")}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            !expanded ? "justify-center" : ""
          } ${
            activeTab === "report"
              ? "bg-indigo-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <ReportIcon />
          {expanded && <span className="whitespace-nowrap">Report</span>}
        </button>

        <div onMouseEnter={() => setOrdersHovered(true)} onMouseLeave={() => setOrdersHovered(false)}>
          <button
            onClick={() => onSelect("orders", activeOrdersSubTab)}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              !expanded ? "justify-center" : ""
            } ${
              activeTab === "orders"
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <OrdersIcon />
            {expanded && (
              <>
                <span className="flex-1 whitespace-nowrap text-left">Order Management</span>
                <ChevronIcon open={ordersHovered} />
              </>
            )}
          </button>
          {expanded && ordersHovered && (
            <div className="mt-1 space-y-0.5 pl-9">
              {ordersSubTabs.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => onSelect("orders", sub.id)}
                  className={`block w-full whitespace-nowrap rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
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
      </nav>
    </aside>
  );
}
