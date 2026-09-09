import { useEffect, useRef, useState, type ReactNode } from "react";

// Generic, OMS-domain-agnostic building blocks shared by every dashboard
// widget. Nothing in this file knows about orders/stages/roles — that
// knowledge lives in shared.tsx (domain calculations) and the widgets
// themselves. Keeping the split this way is what lets every widget file stay
// short: it composes these primitives instead of re-implementing card
// chrome, empty/loading states, or table markup each time.

// ---------------------------------------------------------------------------
// Card shell
// ---------------------------------------------------------------------------

export type CardSize = "sm" | "md" | "lg";

const CARD_PADDING: Record<CardSize, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-4",
};

// The one card shell every widget renders inside. `size` only changes
// padding/title weight, not grid placement — grid span is controlled by the
// wrapper each role dashboard puts around a widget (see the *Dashboard.tsx
// files), so the same widget component can be "large" on one role's layout
// and "medium" on another's without the widget itself knowing.
export function DashboardCard({
  title,
  subtitle,
  action,
  size = "md",
  className = "",
  bodyClassName = "",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  size?: CardSize;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm ${CARD_PADDING[size]} ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className={size === "sm" ? "text-xs font-semibold text-slate-700" : "text-sm font-semibold text-slate-700"}>
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI / Badge
// ---------------------------------------------------------------------------

export type Tone = "emerald" | "amber" | "rose" | "indigo" | "violet" | "slate";

const TONE_TEXT: Record<Tone, string> = {
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  rose: "text-rose-600",
  indigo: "text-indigo-600",
  violet: "text-violet-600",
  slate: "text-slate-700",
};

const TONE_BG: Record<Tone, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  slate: "bg-slate-400",
};

const TONE_BADGE: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  violet: "bg-violet-100 text-violet-800 border-violet-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export function toneClass(tone: Tone) {
  return TONE_TEXT[tone];
}

export function toneBg(tone: Tone) {
  return TONE_BG[tone];
}

// A single big number + label, the atomic unit most widgets are built from.
export function KPI({
  label,
  value,
  sublabel,
  tone = "slate",
  size = "md",
  align = "left",
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
}) {
  const valueClass = size === "lg" ? "text-2xl font-bold" : size === "sm" ? "text-lg font-bold" : "text-xl font-bold";
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`${valueClass} ${TONE_TEXT[tone]}`}>{value}</p>
      {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
    </div>
  );
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_BADGE[tone]}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Health / aging thresholds — shared so a "3 days" bar and a "3 days" table
// row always agree on whether that's healthy.
// ---------------------------------------------------------------------------

export function tatHealth(days: number): Tone {
  if (days <= 3) return "emerald";
  if (days <= 7) return "amber";
  return "rose";
}

// Age-at-stage waits are naturally longer than a single TAT step, so this
// uses a more lenient scale than tatHealth rather than flagging everything
// past day 4 as critical.
export function agingHealth(days: number): Tone {
  if (days <= 5) return "emerald";
  if (days <= 14) return "amber";
  return "rose";
}

// ---------------------------------------------------------------------------
// Empty / loading states
// ---------------------------------------------------------------------------

export function EmptyState({ message = "No data matches the selected filters." }: { message?: string }) {
  return <p className="py-12 text-center text-sm text-slate-400">{message}</p>;
}

export function ErrorState({ message = "Unable to load data.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="text-sm text-rose-600">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// Every widget's data today comes from synchronous in-memory mock state
// (there is no backend/API in this app — see CLAUDE.md), so nothing ever
// actually renders this mid-flight. It exists so a widget can accept a
// `loading` prop and swap to this shape the moment data starts coming from a
// real API, without a later redesign.
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 rounded bg-slate-100" style={{ width: `${85 - i * 12}%` }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-select filter (checkbox dropdown) — generalized from what used to be
// BdDashboard's one-off ClientManagerFilter, now shared by the global filter
// bar for Business Unit / Product / Client Manager.
// ---------------------------------------------------------------------------

export function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
  widthClassName = "w-full sm:w-56",
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
  widthClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${widthClassName}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
      >
        <span className="truncate">{selected.size === 0 ? `All ${label}` : `${selected.size} ${label} selected`}</span>
        <span className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-full min-w-[14rem] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={onClear}
            className="block w-full px-3 py-1.5 text-left text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Clear (show all)
          </button>
          {options.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort switch — a small pill group, generalized from the
// "Oldest first / Newest first" link-style toggle several list widgets used.
// ---------------------------------------------------------------------------

export function SortSwitch<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
            value === o.key ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented horizontal bar — Revenue in Motion / My Pipeline share this exact
// "N stacked segments with a value+percentage legend below" shape.
// ---------------------------------------------------------------------------

export interface BarSegment {
  key: string;
  label: string;
  value: number;
  tone: Tone;
  display: string;
}

export function SegmentedBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((s) => (
          <div
            key={s.key}
            className={`h-full ${TONE_BG[s.tone]}`}
            style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_BG[s.tone]}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-slate-500">{s.label}</span>
              <span className="block text-sm font-semibold text-slate-800">
                {s.display}
                <span className="ml-1 text-xs font-normal text-slate-400">
                  ({total > 0 ? ((s.value / total) * 100).toFixed(0) : 0}%)
                </span>
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bar row — TAT — This Month's "one row per stage" shape.
// ---------------------------------------------------------------------------

export function HorizontalBarRow({
  label,
  sublabel,
  value,
  maxValue,
  tone,
  muted = false,
  title,
}: {
  label: string;
  sublabel?: string;
  value: string;
  maxValue: number;
  tone: Tone;
  muted?: boolean;
  title?: string;
}) {
  const pct = maxValue > 0 ? Math.min(100, (parsePctValue(value) / maxValue) * 100) : 0;
  return (
    <div className={muted ? "opacity-60" : ""} title={title}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="flex items-center gap-1.5">
          {sublabel && <span className="text-[11px] text-slate-400">{sublabel}</span>}
          <span className={`text-xs font-semibold ${TONE_TEXT[tone]}`}>{value}</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${TONE_BG[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function parsePctValue(display: string): number {
  const n = parseFloat(display);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Data table — Approval Queue / Rejected — Needs Fix / Age at Stage /
// Manager-wise Revenue all render as some flavor of this.
// ---------------------------------------------------------------------------

export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  maxHeight = "max-h-72",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  maxHeight?: string;
}) {
  const alignClass = (a?: "left" | "right" | "center") =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
  return (
    <div className={`overflow-auto ${maxHeight}`}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`sticky top-0 z-10 border-b border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-500 ${alignClass(
                  c.align
                )}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-slate-50 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""}`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`py-2 text-slate-700 ${alignClass(c.align)}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
