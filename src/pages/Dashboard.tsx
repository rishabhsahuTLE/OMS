import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { DashboardSubTabId, MainTabId, OrderRecord, OrdersSubTabId, ReportSubTabId } from "../types";
import { BUSINESS_UNITS } from "../types";
import { PRODUCT_NAMES } from "../products";
import DateRangePicker, { type DateRange } from "../components/DateRangePicker";
import AdminDashboard from "./dashboard/AdminDashboard";
import BdDashboard from "./dashboard/BdDashboard";
import FinanceDashboard from "./dashboard/FinanceDashboard";
import TechDashboard from "./dashboard/TechDashboard";

type NavigateFn = (
  tab: MainTabId,
  subTab?: ReportSubTabId | OrdersSubTabId,
  params?: Record<string, string>
) => void;

interface DashboardProps {
  orders: OrderRecord[];
  onNavigate: NavigateFn;
}

const DASHBOARD_TABS: { key: DashboardSubTabId; label: string }[] = [
  { key: "tech", label: "Tech" },
  { key: "finance", label: "Finance" },
  { key: "bd", label: "BD / Client Manager" },
  { key: "admin", label: "Admin" },
];

function parseISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

// Date filter is preset-driven (past 1/3/6 months, last year) rather than a
// bare calendar — "custom" is the one case that falls back to the calendar
// popover for a manual range.
type DatePreset = "all" | "1m" | "3m" | "6m" | "1y" | "custom";

const DATE_PRESET_OPTIONS: { key: DatePreset; label: string }[] = [
  { key: "all", label: "All Time" },
  { key: "1m", label: "Past 1 Month" },
  { key: "3m", label: "Past 3 Months" },
  { key: "6m", label: "Past 6 Months" },
  { key: "1y", label: "Last Year" },
  { key: "custom", label: "Custom Range" },
];

function computePresetRange(preset: DatePreset): DateRange {
  if (preset === "all" || preset === "custom") return { start: null, end: null };
  const end = new Date();
  const start = new Date(end);
  if (preset === "1m") start.setMonth(start.getMonth() - 1);
  else if (preset === "3m") start.setMonth(start.getMonth() - 3);
  else if (preset === "6m") start.setMonth(start.getMonth() - 6);
  else if (preset === "1y") start.setFullYear(start.getFullYear() - 1);
  return { start, end };
}

export default function Dashboard({ orders, onNavigate }: DashboardProps) {
  const { subTab } = useParams<{ subTab: string }>();
  const navigate = useNavigate();
  const activeTab = (subTab as DashboardSubTabId) || "admin";

  // Shared across every role tab — Date (by Order Creation Date, same
  // convention as every other list page's "Created On" filter), Business
  // Unit and Product all narrow `filteredOrders` below, which every tab is
  // built from.
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ start: null, end: null });
  const [buFilter, setBuFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");

  function handleDatePresetChange(preset: DatePreset) {
    setDatePreset(preset);
    setDateRange(computePresetRange(preset));
  }

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (dateRange.start && dateRange.end) {
      const startTime = dateRange.start.getTime();
      const endTime = dateRange.end.getTime();
      result = result.filter((o) => {
        const t = parseISO(o.createdOn).getTime();
        return t >= startTime && t <= endTime;
      });
    }
    if (productFilter !== "all") {
      result = result.filter((o) => o.product === productFilter);
    }
    if (buFilter !== "all") {
      result = result.filter((o) => o.bu === buFilter);
    }
    return result;
  }, [orders, dateRange, productFilter, buFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* -mt-6/-top-6 cancel out <main>'s own p-6 top padding (App.tsx) — that
          padding doesn't scroll away, so without this the bar would always
          sit stuck 24px below the real top of the viewport, with a
          permanent gap of page background showing above it. pt-6 puts that
          same 24px back as this element's own padding instead, so the
          visual spacing looks identical but now scrolls/sticks correctly. */}
      <div className="sticky -top-6 -mt-6 z-30 flex flex-wrap items-center justify-between gap-2 bg-slate-100 pt-6 pb-2">
        <div className="flex gap-2">
          {DASHBOARD_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate(`/dashboard/${t.key}`)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={datePreset}
            onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {DATE_PRESET_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          {datePreset === "custom" && <DateRangePicker value={dateRange} onChange={setDateRange} />}
          <select
            value={buFilter}
            onChange={(e) => setBuFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="all">All Business Units</option>
            {BUSINESS_UNITS.map((bu) => (
              <option key={bu} value={bu}>
                {bu}
              </option>
            ))}
          </select>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="all">All Products</option>
            {PRODUCT_NAMES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeTab === "tech" ? (
        <TechDashboard orders={filteredOrders} onNavigate={onNavigate} />
      ) : activeTab === "finance" ? (
        <FinanceDashboard orders={filteredOrders} onNavigate={onNavigate} />
      ) : activeTab === "bd" ? (
        <BdDashboard orders={filteredOrders} onNavigate={onNavigate} />
      ) : (
        <AdminDashboard orders={filteredOrders} onNavigate={onNavigate} />
      )}
    </div>
  );
}
