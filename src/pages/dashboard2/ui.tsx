import type { ReactNode } from "react";
import type { SortDirection, SortState } from "../../utils";
import { D2 } from "./tokens";

// Every presentational building block Dashboard 2 is assembled from,
// styled to match oms-dashboard-reference.html exactly (hardcoded hex
// values from tokens.ts, not the main Dashboard's indigo/slate Tailwind
// tokens) — kept separate from ./dashboard/ui.tsx on purpose, since that
// file's whole point is the *other* dashboard's own look.

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
      className="flex flex-col gap-3"
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
export function HeaderStat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <div style={{ fontSize: 13, color: D2.muted, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? D2.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel — the fafbfc-bordered sub-card every metric/table sits inside.
// ---------------------------------------------------------------------------

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      style={{ background: D2.panelBg, border: `1px solid ${D2.panelBorder}`, borderRadius: 6, padding: "18px 20px" }}
      className={`flex flex-col gap-3.5 ${className}`}
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
  onClick,
}: {
  label: string;
  value: ReactNode;
  amount?: string;
  highlighted?: boolean;
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
    >
      <div style={{ fontSize: 14, color: D2.mutedStrong, marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 27, fontWeight: 700, lineHeight: 1, color: D2.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
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

export function Bar({ pct, color, height = 20 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{ height, background: "#f0f3f5", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: color, borderRadius: 3 }} />
    </div>
  );
}

export function EmptyRow({ message = "Nothing here right now." }: { message?: string }) {
  return <div style={{ fontSize: 13, color: D2.muted, padding: "16px 0", textAlign: "center" }}>{message}</div>;
}
