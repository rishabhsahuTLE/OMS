import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SortDirection, SortState } from "../../utils";
import { D2 } from "./tokens";

// Every presentational building block Dashboard 2 is assembled from,
// styled to match oms-dashboard-reference.html exactly (hardcoded hex
// values from tokens.ts, not the main Dashboard's indigo/slate Tailwind
// tokens) — kept separate from ./dashboard/ui.tsx on purpose, since that
// file's whole point is the *other* dashboard's own look.

// ---------------------------------------------------------------------------
// Hover tooltip — shared by every chart-like element below (Bar, the
// Revenue in Motion segments, the SVG line chart's points, the SVG donut's
// slices). None of these are recharts (Dashboard 2 is hand-rolled SVG/div to
// pixel-match oms-dashboard-reference.html), so none of them get a tooltip
// for free the way Dashboard 1's recharts-based widgets do — this one small
// hook + presentational pair is reused everywhere instead of each chart
// inventing its own.
// ---------------------------------------------------------------------------

export interface TooltipState {
  x: number;
  y: number;
  label: string;
  value: string;
}

export function useChartTooltip() {
  const [tip, setTip] = useState<TooltipState | null>(null);
  function show(e: MouseEvent, label: string, value: string) {
    setTip({ x: e.clientX, y: e.clientY, label, value });
  }
  function move(e: MouseEvent) {
    setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  }
  function hide() {
    setTip(null);
  }
  return { tip, show, move, hide };
}

// A position:fixed div that follows the cursor — styled to read as the same
// "chart tooltip" idiom as Dashboard 1's recharts Tooltip
// (contentStyle={{ fontSize: 12, borderRadius: 8 }}) for cross-dashboard
// consistency even though the implementation is hand-rolled here.
//
// Portaled to document.body rather than rendered in place: every chart that
// uses this sits inside a Section/Panel, and Section/Panel both get a
// `translate` applied on :hover (see below) for the lift effect — any
// non-"none" `translate`/`transform` on an ancestor establishes a new
// containing block for `position: fixed` descendants (CSS spec), which
// would silently re-anchor this tooltip to that ancestor's box instead of
// the viewport the instant its parent Panel is also hovered (which it
// always is, since hover bubbles). Portaling sidesteps that entirely.
export function ChartTooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: tip.x + 14,
        top: tip.y + 14,
        zIndex: 50,
        pointerEvents: "none",
        background: "#fff",
        border: `1px solid ${D2.border}`,
        borderRadius: 8,
        boxShadow: "0 8px 20px rgba(21,36,43,0.18)",
        padding: "7px 10px",
        fontSize: 12,
        color: D2.text,
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ color: D2.muted, marginBottom: 2 }}>{tip.label}</div>
      <div style={{ fontWeight: 700 }}>{tip.value}</div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Section — the big colored-left-border card each of the 5 groups renders
// inside; `accent` is the 4px left rule's color, unique per section.
// ---------------------------------------------------------------------------

export function Section({
  accent,
  title,
  subtitle,
  right,
  children,
}: {
  accent: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{ background: "#fff", border: `1px solid ${D2.border}`, borderRadius: 10, padding: 16 }}
      className="flex flex-col gap-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(21,36,43,0.10)]"
    >
      <div
        style={{ borderLeft: `4px solid ${accent}` }}
        className="m-0.5 mb-1.5 flex flex-wrap items-end justify-between gap-5 py-px pl-3.5"
      >
        <div>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 14, color: D2.muted, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// The small "LABEL  value" pairing used in several Section headers (Value
// held / Oldest / Revenue in motion / Total forecast / Oldest).
export function HeaderStat({ label, value, color, tip }: { label: string; value: ReactNode; color?: string; tip?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <div className="flex items-center gap-1">
        <div style={{ fontSize: 13, color: D2.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
        </div>
        {tip && <InfoTip text={tip} />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? D2.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// Small (i) icon + explanatory bubble for a label that isn't self-explanatory
// on its own — hover shows it via CSS group-hover, click toggles an
// independent boolean (kept separate so a real click's own hover-in doesn't
// immediately re-close what hovering opened), same UX convention as
// Billing.tsx's own InfoTooltip, restyled with D2 tokens to match this
// dashboard's look instead of that one's Tailwind slate classes.
export function InfoTip({ text }: { text: string }) {
  const [clicked, setClicked] = useState(false);
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={() => setClicked((v) => !v)}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
        style={{ color: D2.faint }}
        aria-label="Info"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <span
        className={`absolute left-1/2 top-full z-30 mt-1.5 w-48 -translate-x-1/2 rounded-md px-2.5 py-1.5 text-center shadow-lg group-hover:block ${
          clicked ? "block" : "hidden"
        }`}
        style={{ background: D2.text, color: "#fff", fontSize: 12, fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}
      >
        {text}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Panel — the fafbfc-bordered sub-card every metric/table sits inside.
// ---------------------------------------------------------------------------

export function Panel({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{ background: D2.panelBg, border: `1px solid ${D2.panelBorder}`, borderRadius: 6, padding: "18px 20px", ...style }}
      className={`flex flex-col gap-3.5 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(21,36,43,0.09)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: D2.muted, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile — Section 1's 6-across All Orders/Pending/... cards.
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  amount,
  highlighted,
  valueColor,
  onClick,
}: {
  label: string;
  value: ReactNode;
  amount?: string;
  highlighted?: boolean;
  valueColor?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: D2.panelBg,
        border: `1px solid ${highlighted ? D2.brand : D2.panelBorder}`,
        borderRadius: 6,
        padding: "15px 17px",
        textAlign: "left",
      }}
      className="transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(21,36,43,0.09)]"
    >
      <div style={{ fontSize: 14, color: D2.mutedStrong, marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 700, lineHeight: 1, color: valueColor ?? D2.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {amount && <div style={{ fontSize: 13, color: D2.muted, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{amount}</div>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pill tabs — This month/Quarter/FY, Oldest/Newest, All/Q3/Q4 — all the
// same small segmented control.
// ---------------------------------------------------------------------------

export function PillTabs<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 3, background: "#f0f3f5", borderRadius: 5, padding: 3 }}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          style={{
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 3,
            background: value === o.key ? "#fff" : "transparent",
            fontWeight: value === o.key ? 600 : 400,
            color: value === o.key ? D2.text : D2.muted,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable column header — the double-triangle icon, highlighted chip when
// active, exactly matching the reference's hand-drawn SVG.
// ---------------------------------------------------------------------------

function SortGlyph({ direction, active }: { direction: SortDirection; active: boolean }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 0, gap: 2 }}>
      <svg width="8" height="5" viewBox="0 0 8 5" fill={D2.brand} opacity={active && direction === "desc" ? 0.25 : active ? 1 : 0.35}>
        <path d="M4 0l4 5H0z" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill={D2.brand} opacity={active && direction === "asc" ? 0.25 : active ? 1 : 0.35}>
        <path d="M4 5L0 0h8z" />
      </svg>
    </span>
  );
}

export function SortableHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        gap: 5,
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: active ? 700 : 600,
        color: active ? D2.brand : D2.muted,
        background: active ? D2.brandChipBg : "transparent",
        margin: active ? "0 -6px" : 0,
        padding: active ? "5px 6px" : 0,
        borderRadius: 3,
      }}
    >
      {label}
      <SortGlyph direction={active ? sort.direction : "asc"} active={active} />
    </button>
  );
}

export function PlainHeader({ label, align = "left" }: { label: string; align?: "left" | "right" }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: D2.muted,
        fontWeight: 600,
        textAlign: align,
      }}
    >
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar — initials circle for Manager forecast.
// ---------------------------------------------------------------------------

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name }: { name: string }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: D2.brandChipBg,
        color: D2.brand,
        fontSize: 11,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
      }}
    >
      {initialsOf(name)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Waiting-days pill — red past a long-overdue threshold, amber before it.
// Our mock data now spans back to 2024 (see mockOrders.ts), so "days
// waiting" on a still-pending order legitimately runs into the hundreds —
// thresholds are picked for that scale, not the few-day range a real
// operational deployment would see.
// ---------------------------------------------------------------------------

export function WaitingPill({ days }: { days: number }) {
  const alert = days >= 400;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        background: alert ? D2.redBg : D2.amberBg,
        color: alert ? D2.red : D2.amber,
        borderRadius: 10,
        padding: "3px 8px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {days}d
    </span>
  );
}

// ---------------------------------------------------------------------------
// Horizontal progress bar — track + fill, used everywhere a %/share needs a
// visual bar (Pending Revenue by stage, Turnaround Time, Revenue Opened vs
// Projected, Manager forecast share).
// ---------------------------------------------------------------------------

export function Bar({
  pct,
  color,
  height = 20,
  tooltipLabel,
  tooltipValue,
}: {
  pct: number;
  color: string;
  height?: number;
  // Omit both to keep a Bar non-interactive (e.g. inside an already-hovered
  // row that has its own tooltip elsewhere) — passing both wires up hover.
  tooltipLabel?: string;
  tooltipValue?: string;
}) {
  const { tip, show, move, hide } = useChartTooltip();
  const interactive = tooltipLabel !== undefined && tooltipValue !== undefined;
  return (
    <div
      style={{ height, background: "#f0f3f5", borderRadius: 3, overflow: "hidden" }}
      onMouseEnter={interactive ? (e) => show(e, tooltipLabel, tooltipValue) : undefined}
      onMouseMove={interactive ? move : undefined}
      onMouseLeave={interactive ? hide : undefined}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: "100%",
          background: color,
          borderRadius: 3,
          transition: "opacity 120ms ease-out",
          opacity: interactive && tip ? 0.82 : 1,
        }}
      />
      {interactive && <ChartTooltip tip={tip} />}
    </div>
  );
}

export function EmptyRow({ message = "Nothing here right now." }: { message?: string }) {
  return <div style={{ fontSize: 13, color: D2.muted, padding: "16px 0", textAlign: "center" }}>{message}</div>;
}
