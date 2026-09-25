import { useEffect, useMemo, useRef, useState } from "react";
import { BUSINESS_UNITS, type OrderRecord } from "../types";
import { PRODUCT_NAMES } from "../products";
import { todayISO } from "../utils";
import DateRangePicker, { type DateRange } from "../components/DateRangePicker";
import Section1StageDistribution from "./dashboard2/Section1StageDistribution";
import Section2OrderAndBilling from "./dashboard2/Section2OrderAndBilling";
import Section3Approvals from "./dashboard2/Section3Approvals";
import Section4Ageing from "./dashboard2/Section4Ageing";
import { D2, D2_FONT } from "./dashboard2/tokens";
import {
  applyStructuralFilters,
  computePresetRange,
  DATE_PRESET_OPTIONS,
  DEFAULT_FILTERS,
  inDateRange,
  type DashboardFilters,
  type DatePreset,
} from "./dashboard/filters";
import type { NavigateFn } from "./dashboard/shared";

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const DATE_LABELS: Record<DatePreset | "all", string> = {
  all: "All Time",
  fy2024: "FY 2024-25",
  fy2025: "FY 2025-26",
  fy2026: "Current FY (2026–27)",
  custom: "Custom",
};

export default function Dashboard2({ orders, onNavigate }: { orders: OrderRecord[]; onNavigate: NavigateFn }) {
  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    ...DEFAULT_FILTERS,
    datePreset: "fy2026",
    dateRange: computePresetRange("fy2026"),
  }));
  const [lastUpdated, setLastUpdated] = useState(() => todayISO());

  const managerOptions = useMemo(() => Array.from(new Set(orders.map((o) => o.clientManager))).sort(), [orders]);

  const scoped = useMemo(
    () =>
      applyStructuralFilters(orders, filters, { includeManager: true }).filter((o) => inDateRange(o.createdOn, filters.dateRange)),
    [orders, filters]
  );

  function setDatePreset(preset: DatePreset | "all") {
    setFilters((f) => ({ ...f, datePreset: preset, dateRange: computePresetRange(preset) }));
  }

  function clearAll() {
    setFilters({ ...DEFAULT_FILTERS, datePreset: "fy2026", dateRange: computePresetRange("fy2026") });
  }

  return (
    <div style={{ fontFamily: D2_FONT, color: D2.text, background: D2.pageBg }} className="-m-6 min-h-full pb-20">
      <div
        style={{ position: "sticky", top: 0, zIndex: 20, background: D2.panelBg, borderBottom: `1px solid ${D2.panelBorder}` }}
        className="px-6 py-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em" }}>Dashboard</div>
            <div style={{ fontSize: 14, color: D2.muted, marginTop: 2 }}>Overview of orders, approvals, billing and revenue</div>
          </div>
          <div className="flex items-center gap-3.5">
            <div style={{ fontSize: 13, color: D2.muted }}>Last updated {lastUpdated}</div>
            <button
              type="button"
              onClick={() => setLastUpdated(todayISO())}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: D2.brand,
                border: `1px solid #c8d3d9`,
                background: "#fff",
                borderRadius: 5,
                padding: "8px 14px",
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ height: 1, background: D2.rowDivider, margin: "16px 0" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <DateDropdown value={filters.datePreset} onChange={setDatePreset} dateRange={filters.dateRange} onRangeChange={(r) => setFilters((f) => ({ ...f, dateRange: r }))} />
          <CheckDropdown
            label="Business Units"
            options={[...BUSINESS_UNITS]}
            selected={filters.businessUnits}
            onToggle={(v) => setFilters((f) => ({ ...f, businessUnits: toggleInSet(f.businessUnits, v) }))}
          />
          <CheckDropdown
            label="Products"
            options={PRODUCT_NAMES}
            selected={filters.products}
            onToggle={(v) => setFilters((f) => ({ ...f, products: toggleInSet(f.products, v) }))}
          />
          <CheckDropdown
            label="Managers"
            options={managerOptions}
            selected={filters.managers}
            onToggle={(v) => setFilters((f) => ({ ...f, managers: toggleInSet(f.managers, v) }))}
          />
          <div style={{ flex: 1, minWidth: 20 }} />
          <div style={{ fontSize: 13, color: D2.muted, fontVariantNumeric: "tabular-nums" }}>
            {scoped.length} of {orders.length} orders
          </div>
          <div style={{ width: 1, height: 18, background: D2.border }} />
          <button type="button" onClick={clearAll} style={{ fontSize: 13, fontWeight: 600, color: D2.link }}>
            Clear All
          </button>
        </div>
      </div>

      <div className="flex flex-col px-6" style={{ gap: 34, paddingTop: 28 }}>
        <Section1StageDistribution orders={scoped} onNavigate={onNavigate} />
        <Section2OrderAndBilling orders={scoped} rawOrders={orders} filters={filters} onNavigate={onNavigate} />
        <Section3Approvals orders={scoped} onNavigate={onNavigate} />
        <Section4Ageing orders={scoped} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);
  return ref;
}

function DateDropdown({
  value,
  onChange,
  dateRange,
  onRangeChange,
}: {
  value: DatePreset | "all";
  onChange: (v: DatePreset | "all") => void;
  dateRange: DateRange;
  onRangeChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const active = value !== "all";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          fontWeight: active ? 600 : 400,
          border: `1px solid ${active ? D2.brand : D2.border}`,
          background: active ? D2.brandTint : "#fff",
          color: active ? D2.brand : D2.mutedStrong,
          borderRadius: 5,
          padding: "8px 13px",
        }}
      >
        {DATE_LABELS[value]}
        <span style={{ opacity: 0.5, fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden"
          style={{ background: "#fff", border: `1px solid ${D2.border}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(21,36,43,0.12)" }}
        >
          {(["all", ...DATE_PRESET_OPTIONS.map((o) => o.key)] as (DatePreset | "all")[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                if (key !== "custom") setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                fontSize: 13,
                padding: "9px 13px",
                color: value === key ? D2.brand : D2.mutedStrong,
                fontWeight: value === key ? 600 : 400,
                background: value === key ? D2.brandTint : "transparent",
              }}
            >
              {DATE_LABELS[key]}
            </button>
          ))}
          {value === "custom" && (
            <div style={{ padding: "8px 13px 12px" }}>
              <DateRangePicker value={dateRange} onChange={onRangeChange} autoOpen />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckDropdown({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const active = selected.size > 0;
  const text = active ? `${selected.size} ${label} selected` : `All ${label}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          border: `1px solid ${active ? D2.brand : D2.border}`,
          color: active ? D2.brand : D2.mutedStrong,
          background: active ? D2.brandTint : "#fff",
          borderRadius: 5,
          padding: "8px 13px",
        }}
      >
        {text}
        <span style={{ opacity: 0.45, fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-y-auto"
          style={{ background: "#fff", border: `1px solid ${D2.border}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(21,36,43,0.12)" }}
        >
          {options.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2" style={{ padding: "8px 13px", fontSize: 13, color: D2.mutedStrong }}>
              <input type="checkbox" checked={selected.has(o)} onChange={() => onToggle(o)} />
              {o}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
