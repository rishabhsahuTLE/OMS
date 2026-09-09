import { useMemo, useState } from "react";
import type { MainTabId, OrderRecord, OrdersSubTabId, ReportSubTabId } from "../types";
import { BUSINESS_UNITS } from "../types";
import { PRODUCT_NAMES } from "../products";
import { todayISO } from "../utils";
import DateRangePicker, { type DateRange } from "../components/DateRangePicker";
import FilterDrawer, { type FilterDrawerCategory } from "../components/FilterDrawer";
import {
  activeFilterCount,
  computePresetRange,
  DATE_PRESET_OPTIONS,
  DEFAULT_FILTERS,
  type DashboardFilters,
  type DatePreset,
} from "./dashboard/filters";
import { MultiSelectFilter } from "./dashboard/ui";
import AgeAtStage from "./dashboard/widgets/AgeAtStage";
import ApprovalQueue from "./dashboard/widgets/ApprovalQueue";
import BillingActionsDue from "./dashboard/widgets/BillingActionsDue";
import ClearanceStats from "./dashboard/widgets/ClearanceStats";
import ManagerRevenue from "./dashboard/widgets/ManagerRevenue";
import OpenedVsProjected from "./dashboard/widgets/OpenedVsProjected";
import OrdersStuck from "./dashboard/widgets/OrdersStuck";
import OutstandingBalance from "./dashboard/widgets/OutstandingBalance";
import PipelineOverview from "./dashboard/widgets/PipelineOverview";
import ProductRevenue from "./dashboard/widgets/ProductRevenue";
import RejectedNeedsFix from "./dashboard/widgets/RejectedNeedsFix";
import RevenueInMotion from "./dashboard/widgets/RevenueInMotion";
import RevenueTrend from "./dashboard/widgets/RevenueTrend";
import StageDistribution from "./dashboard/widgets/StageDistribution";
import TatThisMonth from "./dashboard/widgets/TatThisMonth";

type NavigateFn = (
  tab: MainTabId,
  subTab?: ReportSubTabId | OrdersSubTabId,
  params?: Record<string, string>
) => void;

interface DashboardProps {
  orders: OrderRecord[];
  onNavigate: NavigateFn;
}

const FILTER_CATEGORIES: FilterDrawerCategory[] = [
  { key: "date", label: "Date" },
  { key: "bu", label: "Business Unit" },
  { key: "product", label: "Product" },
  { key: "manager", label: "Client Manager" },
];

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function Dashboard({ orders, onNavigate }: DashboardProps) {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [lastUpdated, setLastUpdated] = useState(() => todayISO());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCategory, setDrawerCategory] = useState(FILTER_CATEGORIES[0].key);

  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  function setDatePreset(preset: DatePreset | "all") {
    setFilters((f) => ({ ...f, datePreset: preset, dateRange: computePresetRange(preset) }));
  }

  function clearAll() {
    setFilters(DEFAULT_FILTERS);
  }

  const activeCount = activeFilterCount(filters);

  const w = { orders, filters };

  return (
    <div className="flex flex-col gap-4">
      {/* Compact header — no wasted vertical space: title/subtitle on the
          left, Last updated + Refresh on the right, all on one row. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
          <p className="text-xs text-slate-500">Overview of orders, approvals, billing and revenue</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Last updated {lastUpdated}</span>
          <button
            type="button"
            onClick={() => setLastUpdated(todayISO())}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      {/* Global filter bar — one bar for the whole dashboard, not one per
          widget. Each widget then decides for itself which of these are
          analytically meaningful (see filters.ts and each widget's own
          notes) rather than every filter blindly applying everywhere. */}
      <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm md:flex">
        <select
          value={filters.datePreset}
          onChange={(e) => setDatePreset(e.target.value as DatePreset | "all")}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="all">All Time</option>
          {DATE_PRESET_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        {filters.datePreset === "custom" && (
          <DateRangePicker value={filters.dateRange} onChange={(r: DateRange) => setFilters((f) => ({ ...f, dateRange: r }))} />
        )}

        <div className="h-5 w-px bg-slate-200" />

        <MultiSelectFilter
          label="Business Units"
          options={[...BUSINESS_UNITS]}
          selected={filters.businessUnits}
          onToggle={(v) => setFilters((f) => ({ ...f, businessUnits: toggleInSet(f.businessUnits, v) }))}
          onClear={() => setFilters((f) => ({ ...f, businessUnits: new Set() }))}
          widthClassName="w-44"
        />
        <MultiSelectFilter
          label="Products"
          options={PRODUCT_NAMES}
          selected={filters.products}
          onToggle={(v) => setFilters((f) => ({ ...f, products: toggleInSet(f.products, v) }))}
          onClear={() => setFilters((f) => ({ ...f, products: new Set() }))}
          widthClassName="w-40"
        />
        <MultiSelectFilter
          label="Managers"
          options={managerOptions}
          selected={filters.managers}
          onToggle={(v) => setFilters((f) => ({ ...f, managers: toggleInSet(f.managers, v) }))}
          onClear={() => setFilters((f) => ({ ...f, managers: new Set() }))}
          widthClassName="w-48"
        />

        <div className="ml-auto flex items-center gap-2">
          {activeCount > 0 && <span className="text-xs font-medium text-indigo-600">{activeCount} active</span>}
          <button type="button" onClick={clearAll} className="text-xs font-medium text-slate-500 hover:text-slate-700">
            Clear All
          </button>
        </div>
      </div>

      {/* Mobile/tablet: a single Filters button opens the same filter set in
          a drawer instead of a cramped inline row. */}
      <div className="flex items-center justify-between md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Filters {activeCount > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{activeCount}</span>}
        </button>
        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="text-xs font-medium text-slate-500 hover:text-slate-700">
            Clear All
          </button>
        )}
      </div>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Dashboard Filters"
        categories={FILTER_CATEGORIES}
        activeCategory={drawerCategory}
        onSelectCategory={setDrawerCategory}
        onClear={clearAll}
        onApply={() => setDrawerOpen(false)}
      >
        {drawerCategory === "date" && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setDatePreset("all")}
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                filters.datePreset === "all" ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
              }`}
            >
              All Time
            </button>
            {DATE_PRESET_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setDatePreset(o.key)}
                className={`rounded-md border px-3 py-2 text-left text-sm ${
                  filters.datePreset === o.key ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"
                }`}
              >
                {o.label}
              </button>
            ))}
            {filters.datePreset === "custom" && (
              <DateRangePicker value={filters.dateRange} onChange={(r: DateRange) => setFilters((f) => ({ ...f, dateRange: r }))} />
            )}
          </div>
        )}
        {drawerCategory === "bu" && (
          <CheckboxList
            options={[...BUSINESS_UNITS]}
            selected={filters.businessUnits}
            onToggle={(v) => setFilters((f) => ({ ...f, businessUnits: toggleInSet(f.businessUnits, v) }))}
          />
        )}
        {drawerCategory === "product" && (
          <CheckboxList
            options={PRODUCT_NAMES}
            selected={filters.products}
            onToggle={(v) => setFilters((f) => ({ ...f, products: toggleInSet(f.products, v) }))}
          />
        )}
        {drawerCategory === "manager" && (
          <CheckboxList
            options={managerOptions}
            selected={filters.managers}
            onToggle={(v) => setFilters((f) => ({ ...f, managers: toggleInSet(f.managers, v) }))}
          />
        )}
      </FilterDrawer>

      {/* Every widget, grouped by shape rather than by who used to own it —
          donut/chart widgets pair with donut/chart widgets, short KPI tiles
          pair with short KPI tiles, so no grid row ever stretches a shorter
          card to a taller neighbor's height (see ui.tsx's DashboardCard). */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <StageDistribution orders={w.orders} filters={w.filters} onNavigate={onNavigate} />
        </div>
        <div className="lg:col-span-6">
          <OrdersStuck orders={w.orders} filters={w.filters} />
        </div>

        <div className="lg:col-span-4">
          <BillingActionsDue orders={w.orders} filters={w.filters} onNavigate={onNavigate} />
        </div>
        <div className="lg:col-span-4">
          <OutstandingBalance orders={w.orders} filters={w.filters} />
        </div>
        <div className="lg:col-span-4">
          <ClearanceStats orders={w.orders} filters={w.filters} />
        </div>

        <div className="lg:col-span-12">
          <ApprovalQueue orders={w.orders} filters={w.filters} dept="Tech" onNavigate={onNavigate} />
        </div>
        <div className="lg:col-span-12">
          <ApprovalQueue orders={w.orders} filters={w.filters} dept="Finance" onNavigate={onNavigate} />
        </div>

        <div className="lg:col-span-6">
          <TatThisMonth orders={w.orders} filters={w.filters} />
        </div>
        <div className="lg:col-span-6">
          <ProductRevenue orders={w.orders} filters={w.filters} />
        </div>

        <div className="lg:col-span-6">
          <OpenedVsProjected orders={w.orders} filters={w.filters} />
        </div>
        <div className="lg:col-span-6">
          <RevenueInMotion orders={w.orders} filters={w.filters} />
        </div>

        <div className="lg:col-span-12">
          <PipelineOverview orders={w.orders} filters={w.filters} />
        </div>

        <div className="lg:col-span-12">
          <ManagerRevenue orders={w.orders} filters={w.filters} onNavigate={onNavigate} />
        </div>

        <div className="lg:col-span-12">
          <RevenueTrend orders={w.orders} filters={w.filters} />
        </div>

        <div className="lg:col-span-12">
          <RejectedNeedsFix orders={w.orders} filters={w.filters} onNavigate={onNavigate} />
        </div>
        <div className="lg:col-span-12">
          <AgeAtStage orders={w.orders} filters={w.filters} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

function CheckboxList({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {options.map((o) => (
        <label key={o} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={selected.has(o)}
            onChange={() => onToggle(o)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
          />
          {o}
        </label>
      ))}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
      <path d="M16 10a6 6 0 10-1.76 4.24M16 10V6m0 4h-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
