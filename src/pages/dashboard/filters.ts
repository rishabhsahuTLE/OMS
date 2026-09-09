import type { OrderRecord } from "../../types";
import type { DateRange } from "../../components/DateRangePicker";

// The one global filter bar (Dashboard.tsx) feeds every role dashboard the
// same DashboardFilters value. Each widget then decides for itself which
// parts of it are analytically meaningful — see the per-widget notes in each
// file under ./widgets. Nothing here blindly applies every filter to every
// widget; that decision is deliberately made at the call site, not here.

export type DatePreset = "1m" | "3m" | "6m" | "1y" | "custom";

export const DATE_PRESET_OPTIONS: { key: DatePreset; label: string }[] = [
  { key: "1m", label: "1 Month" },
  { key: "3m", label: "3 Months" },
  { key: "6m", label: "6 Months" },
  { key: "1y", label: "1 Year" },
  { key: "custom", label: "Custom" },
];

export interface DashboardFilters {
  // Not part of the prompt's 5 date options, but the sane default state for
  // a dashboard nobody has touched yet — "All Time" is what "Clear All"
  // resets back to, rather than silently defaulting to a 1-month window.
  datePreset: DatePreset | "all";
  dateRange: DateRange;
  businessUnits: Set<string>;
  products: Set<string>;
  managers: Set<string>;
}

export const DEFAULT_FILTERS: DashboardFilters = {
  datePreset: "all",
  dateRange: { start: null, end: null },
  businessUnits: new Set(),
  products: new Set(),
  managers: new Set(),
};

export function computePresetRange(preset: DatePreset | "all"): DateRange {
  if (preset === "all" || preset === "custom") return { start: null, end: null };
  const end = new Date();
  const start = new Date(end);
  if (preset === "1m") start.setMonth(start.getMonth() - 1);
  else if (preset === "3m") start.setMonth(start.getMonth() - 3);
  else if (preset === "6m") start.setMonth(start.getMonth() - 6);
  else if (preset === "1y") start.setFullYear(start.getFullYear() - 1);
  return { start, end };
}

function parseISO(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

// Generic "is this ISO date within the range" check, reused by every widget
// that applies the Date filter to its own date field (order.createdOn, a
// rejection date, a stage-entry date, ...) rather than to a hardcoded field
// picked in here.
export function inDateRange(iso: string | null | undefined, range: DateRange): boolean {
  if (!range.start || !range.end) return true;
  if (!iso) return false;
  const t = parseISO(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

// Business Unit + Product are broadly meaningful everywhere (both are core
// OMS dimensions), so every widget applies them unconditionally. Client
// Manager is meaningful only for a specific subset (My Pipeline,
// Manager-wise Revenue, Rejected, Age at Stage, Approval Queue, Stage
// Distribution, TAT — see the prompt's own filter-logic notes), so it's
// opt-in via `includeManager` rather than blanket-applied.
export function applyStructuralFilters(
  orders: OrderRecord[],
  filters: DashboardFilters,
  opts: { includeManager?: boolean } = {}
): OrderRecord[] {
  let result = orders;
  if (filters.businessUnits.size > 0) {
    result = result.filter((o) => filters.businessUnits.has(o.bu));
  }
  if (filters.products.size > 0) {
    result = result.filter((o) => filters.products.has(o.product));
  }
  if (opts.includeManager && filters.managers.size > 0) {
    result = result.filter((o) => filters.managers.has(o.clientManager));
  }
  return result;
}

export function activeFilterCount(filters: DashboardFilters): number {
  let n = 0;
  if (filters.datePreset !== "all") n += 1;
  if (filters.businessUnits.size > 0) n += 1;
  if (filters.products.size > 0) n += 1;
  if (filters.managers.size > 0) n += 1;
  return n;
}
