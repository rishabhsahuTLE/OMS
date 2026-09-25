import { useState, type CSSProperties } from "react";
import type { OrderRecord } from "../../types";
import { getDisplayStage, getNextActionableStage, usePagination, type ApprovalStageKey } from "../../utils";
import {
  buildApprovalQueue,
  buildStuckData,
  buildTatStats,
  buildTurnaroundSummary,
  formatINR,
  type NavigateFn,
  type RoleDept,
  type TatPeriod,
} from "../dashboard/shared";
import { D2 } from "./tokens";
import { Bar, ChartTooltip, EmptyRow, HeaderStat, InfoTip, Panel, PanelHeading, PillTabs, Section, useChartTooltip, WaitingPill } from "./ui";

// Standard SVG donut-wedge trigonometry: angle 0 is the top (12 o'clock),
// increasing clockwise — shared by any wedge that needs its own in-slice
// label, which a plain stroke-dasharray ring can't position.
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutWedgePath(cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number) {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

const SHORT_STAGE: Record<ApprovalStageKey, string> = {
  technical: "Tech",
  financial: "Fin",
  cancellationTechnical: "TC",
  cancellationFinancial: "FC",
};

const STUCK_LABEL: Record<ApprovalStageKey, string> = {
  technical: "Technical",
  financial: "Financial",
  cancellationFinancial: "Cancellation — Financial",
  cancellationTechnical: "Cancellation — Technical",
};

const TAT_LABEL: Record<ApprovalStageKey, string> = {
  technical: "Technical",
  financial: "Financial",
  cancellationTechnical: "Cancellation — Tech",
  cancellationFinancial: "Cancellation — Fin",
};

const TAT_PERIOD_OPTIONS: { key: TatPeriod; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "Quarter" },
  { key: "all", label: "FY" },
];

export default function Section3Approvals({ orders, onNavigate }: { orders: OrderRecord[]; onNavigate: NavigateFn }) {
  const pending = orders.filter((o) => {
    const stage = getDisplayStage(o);
    return stage === "approvalPending";
  });
  const valueHeld = pending.reduce((sum, o) => sum + o.amount, 0);

  const techQueue = buildApprovalQueue(orders, "Tech");
  const finQueue = buildApprovalQueue(orders, "Finance");
  const oldest = Math.max(0, ...techQueue.map((q) => q.ageDays), ...finQueue.map((q) => q.ageDays));

  return (
    <Section
      accent={D2.red}
      title="Approvals"
      subtitle={`${pending.length} orders awaiting a technical or financial decision`}
      right={
        <div className="flex items-baseline gap-5">
          <HeaderStat
            label="Value held"
            value={formatINR(valueHeld)}
            tip="Total contracted value of orders still awaiting a Technical or Financial approval decision."
          />
          <HeaderStat
            label="Oldest"
            value={`${oldest}d`}
            color={D2.red}
            tip="The longest any order has been waiting in the Technical or Financial approval queue, in days."
          />
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr)", gap: 12 }} className="items-stretch">
        <OrdersStuckAtApprovalPanel orders={orders} />
        <TurnaroundPanel orders={orders} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }} className="items-stretch">
        <ApprovalQueuePanel
          title="Technical Approval Queue"
          subtitle="Technical / Cancellation-Technical decisions pending"
          dept="Tech"
          orders={orders}
          onNavigate={onNavigate}
        />
        <ApprovalQueuePanel
          title="Financial Approval Queue"
          subtitle="Financial / Cancellation-Financial decisions pending"
          dept="Finance"
          orders={orders}
          onNavigate={onNavigate}
        />
      </div>
    </Section>
  );
}

function OrdersStuckAtApprovalPanel({ orders }: { orders: OrderRecord[] }) {
  const data = buildStuckData(orders);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  const GAP_DEG = 2;
  const CX = 130;
  const CY = 130;
  const OUTER_R = 115;
  const INNER_R = 52;

  let cursor = 0;
  const wedges = data.map((d) => {
    const sweep = totalCount > 0 ? (d.count / totalCount) * 360 : 0;
    const startAngle = cursor + GAP_DEG / 2;
    const endAngle = cursor + sweep - GAP_DEG / 2;
    cursor += sweep;
    const mid = polarToCartesian(CX, CY, (OUTER_R + INNER_R) / 2, (startAngle + endAngle) / 2);
    return { ...d, path: sweep > GAP_DEG ? donutWedgePath(CX, CY, INNER_R, OUTER_R, startAngle, endAngle) : null, labelX: mid.x, labelY: mid.y };
  });

  const { tip, show, move, hide } = useChartTooltip();
  const [hoverKey, setHoverKey] = useState<ApprovalStageKey | null>(null);

  return (
    <Panel style={{ minHeight: 450 }}>
      <PanelHeading title="Orders Stuck at Approval" subtitle="Which approval each pending order is sitting in" />
      {totalCount === 0 ? (
        <EmptyRow />
      ) : (
        <div className="flex flex-1 items-stretch gap-6">
          <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center">
            <svg width="100%" height="100%" viewBox="0 0 260 260" style={{ maxWidth: 380, maxHeight: 380 }}>
              {wedges.map(
                (w) =>
                  w.path && (
                    <path
                      key={w.key}
                      d={w.path}
                      fill={w.color}
                      style={{ cursor: "pointer", transition: "opacity 120ms ease-out", opacity: hoverKey && hoverKey !== w.key ? 0.55 : 1 }}
                      onMouseEnter={(e) => {
                        setHoverKey(w.key);
                        show(e, STUCK_LABEL[w.key], `${w.count} order${w.count === 1 ? "" : "s"} (${formatINR(w.revenue)})`);
                      }}
                      onMouseMove={move}
                      onMouseLeave={() => {
                        setHoverKey(null);
                        hide();
                      }}
                    />
                  )
              )}
              {wedges.map(
                (w) =>
                  w.path && (
                    <text
                      key={w.key}
                      x={w.labelX}
                      y={w.labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ fill: "#fff", fontSize: 16, fontWeight: 700, pointerEvents: "none" }}
                    >
                      {w.count}
                    </text>
                  )
              )}
            </svg>
            <ChartTooltip tip={tip} />
          </div>
          <div className="flex shrink-0 flex-col justify-center gap-4" style={{ width: 140 }}>
            {data.map((d) => (
              <div key={d.key} className="flex items-center gap-2.5">
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: D2.mutedStrong }}>
                  {STUCK_LABEL[d.key]}
                  <br />
                  <span style={{ color: D2.faint, fontSize: 13 }}>
                    {d.count} order{d.count === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function TurnaroundPanel({ orders }: { orders: OrderRecord[] }) {
  const [period, setPeriod] = useState<TatPeriod>("month");
  const summary = buildTurnaroundSummary(orders, period);
  const stats = buildTatStats(orders, period);
  const domainMax = Math.max(1, summary.avgClearance * 2);
  const avgPct = 50;

  return (
    <Panel style={{ minHeight: 450 }}>
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Turnaround time</div>
        <PillTabs options={TAT_PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", border: `1px solid ${D2.panelBorder}`, borderRadius: 5, background: D2.panelBg }}>
        <TatStat
          label="Avg clearance"
          value={`${summary.avgClearance.toFixed(1)}`}
          unit="d"
          border
          tip="Mean turnaround, in days, across every Technical / Financial / Cancellation-Technical / Cancellation-Financial decision made in the selected period, pooled into one list — not an average of the 4 stage bars below. Falls back to all-time if the period has no decisions yet."
        />
        <TatStat label="Median" value={`${summary.median.toFixed(1)}`} unit="d" border />
        <TatStat label="Cleared" value={String(summary.ordersCleared)} />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="flex items-baseline justify-between">
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: D2.muted, fontWeight: 600 }}>By stage</div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: D2.muted }}>
            <span style={{ display: "inline-block", width: 20, borderTop: `2px dashed ${D2.faint}` }} />
            Avg {summary.avgClearance.toFixed(1)}d
          </div>
        </div>

        <div className="grid gap-y-5" style={{ gridTemplateColumns: "150px minmax(0,1fr) 46px" }}>
          {stats.map((s, i) => {
            const pastAvg = s.avgDays > summary.avgClearance;
            const pct = Math.min(100, (s.avgDays / domainMax) * 100);
            const row = i + 1;
            const color = pastAvg ? D2.red : D2.stage[s.key];
            return (
              <div key={s.key} className="contents">
                <span style={{ fontSize: 14, color: D2.mutedStrong, gridColumn: 1, gridRow: row }} className="flex items-center">
                  {TAT_LABEL[s.key]}
                </span>
                <span style={{ gridColumn: 2, gridRow: row }} className="flex items-center">
                  <div style={{ flex: 1 }}>
                    <Bar
                      pct={pct}
                      color={color}
                      height={34}
                      tooltipLabel={TAT_LABEL[s.key]}
                      tooltipValue={`${s.avgDays.toFixed(1)}d avg${pastAvg ? " — above the overall average" : ""}`}
                    />
                  </div>
                </span>
                <span
                  style={{
                    fontSize: 14,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: pastAvg ? 600 : 400,
                    color: pastAvg ? D2.text : D2.mutedStrong,
                    gridColumn: 3,
                    gridRow: row,
                  }}
                  className="flex items-center justify-end"
                >
                  {s.avgDays.toFixed(1)}d
                </span>
              </div>
            );
          })}
          <div className="relative" style={{ gridColumn: 2, gridRow: `1 / ${stats.length + 1}` }}>
            <span
              className="pointer-events-none absolute inset-y-0"
              style={{ left: `${avgPct}%`, borderLeft: `2px dashed ${D2.faint}` }}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function TatStat({
  label,
  value,
  unit,
  border,
  tip,
}: {
  label: string;
  value: string;
  unit?: string;
  border?: boolean;
  tip?: string;
}) {
  return (
    <div style={{ padding: "11px 14px", borderRight: border ? `1px solid ${D2.panelBorder}` : undefined }}>
      <div className="flex items-center gap-1" style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: D2.muted, fontWeight: 600 }}>{label}</div>
        {tip && <InfoTip text={tip} />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
        {unit && <span style={{ fontSize: 13, color: D2.muted }}>{unit}</span>}
      </div>
    </div>
  );
}

function ApprovalQueuePanel({
  title,
  subtitle,
  dept,
  orders,
  onNavigate,
}: {
  title: string;
  subtitle: string;
  dept: RoleDept;
  orders: OrderRecord[];
  onNavigate: NavigateFn;
}) {
  const [sort, setSort] = useState<"oldest" | "newest">("oldest");
  const items = buildApprovalQueue(orders, dept).sort((a, b) => (sort === "oldest" ? b.ageDays - a.ageDays : a.ageDays - b.ageDays));
  const { page, setPage, totalPages, pageRows: shown } = usePagination(items, 5);
  const totalHeld = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <Panel style={{ minHeight: 540 }}>
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <PanelHeading title={title} subtitle={`${subtitle} · ${formatINR(totalHeld)} held across ${items.length} orders`} />
        <PillTabs
          options={[
            { key: "oldest", label: "Oldest" },
            { key: "newest", label: "Newest" },
          ]}
          value={sort}
          onChange={setSort}
        />
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) 96px 62px", gap: 12, borderBottom: `2px solid ${D2.border}`, paddingBottom: 8 }}
      >
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: D2.muted, fontWeight: 600 }}>Order / Client</div>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: D2.muted, fontWeight: 600 }}>Product / Stage</div>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: D2.muted, fontWeight: 600, textAlign: "right" }}>
          Order Value
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: D2.muted, fontWeight: 600, textAlign: "right" }}>
          Waiting
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyRow message={`Nothing waiting in the ${dept} queue right now.`} />
      ) : (
        <div className="flex flex-col">
          {shown.map((item, idx) => {
            const stageKey = getNextActionableStage(item.order)?.key ?? "technical";
            return (
              <button
                key={item.order.id}
                type="button"
                onClick={() => onNavigate("orders", "amendCancel", { stage: getDisplayStage(item.order), q: item.order.orderNo })}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr) 96px 62px",
                  gap: 12,
                  alignItems: "center",
                  padding: "11px 0",
                  borderBottom: idx === shown.length - 1 ? "none" : `1px solid ${D2.rowDivider}`,
                  textAlign: "left",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{item.order.orderNo}</div>
                  <div style={{ fontSize: 13, color: D2.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.order.client}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: D2.mutedStrong, whiteSpace: "nowrap" }}>{item.order.product}</div>
                  <div style={{ fontSize: 12, color: D2.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {SHORT_STAGE[stageKey]} approval
                  </div>
                </div>
                <div style={{ fontSize: 14, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{formatINR(item.amount)}</div>
                <div style={{ textAlign: "right" }}>
                  <WaitingPill days={item.ageDays} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3" style={{ paddingTop: 4 }}>
        <QueuePager page={page} totalPages={totalPages} onPageChange={setPage} />
        <button
          type="button"
          onClick={() => onNavigate("orders", "amendCancel")}
          style={{ fontSize: 13, fontWeight: 600, color: D2.link }}
        >
          View all {items.length} →
        </button>
      </div>
    </Panel>
  );
}

// A small D2-styled pager, following the same page-button-windowing idea as
// the app's shared PaginationFooter.tsx (src/components/PaginationFooter.tsx)
// — reimplemented locally with D2 tokens rather than importing that
// component directly, since it's Tailwind/indigo-styled to match the other
// list pages, not Dashboard 2's own hand-rolled token-driven look.
function pageButtons(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = Array.from(keep)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

function QueuePager({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return <div />;
  const btnBase: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 600,
  };
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{ ...btnBase, border: `1px solid ${D2.panelBorder}`, color: D2.mutedStrong, opacity: page <= 1 ? 0.4 : 1 }}
      >
        ‹
      </button>
      {pageButtons(page, totalPages).map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} style={{ fontSize: 12, color: D2.faint, padding: "0 2px" }}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            style={
              p === page
                ? { ...btnBase, background: D2.brand, color: "#fff" }
                : { ...btnBase, border: `1px solid ${D2.panelBorder}`, color: D2.mutedStrong }
            }
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={{ ...btnBase, border: `1px solid ${D2.panelBorder}`, color: D2.mutedStrong, opacity: page >= totalPages ? 0.4 : 1 }}
      >
        ›
      </button>
    </div>
  );
}
