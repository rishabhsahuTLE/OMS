import type { OrderRecord } from "../../types";
import { billsInColumn, buildFiscalYearColumns, getDisplayStage, isBillingOpenInColumn } from "../../utils";
import { buildRevenueMotion, formatINR, type NavigateFn } from "../dashboard/shared";
import { D2 } from "./tokens";
import { Bar, HeaderStat, Panel, PanelHeading, Section } from "./ui";

export default function Section3Billing({ orders, onNavigate }: { orders: OrderRecord[]; onNavigate: NavigateFn }) {
  const motion = buildRevenueMotion(orders);
  const revenueInMotion = motion.active + motion.amendmentInFlight + motion.cancellationInFlight;

  return (
    <Section
      accent={D2.green}
      title="Active and billing"
      subtitle="Live contracts, in-flight changes and billing actions waiting"
      right={<HeaderStat label="Revenue in motion" value={formatINR(revenueInMotion)} />}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }} className="items-start">
        <RevenueInMotionPanel motion={motion} />
        <BillingActionsPanel orders={orders} onNavigate={onNavigate} />
        <OpenedVsProjectedPanel orders={orders} />
      </div>
    </Section>
  );
}

function RevenueInMotionPanel({ motion }: { motion: { active: number; amendmentInFlight: number; cancellationInFlight: number } }) {
  const total = motion.active + motion.amendmentInFlight + motion.cancellationInFlight;
  const segments = [
    { label: "Active Revenue", value: motion.active, color: D2.green },
    { label: "Amendment In-flight", value: motion.amendmentInFlight, color: "#4a8fb0" },
    { label: "Cancellation In-flight", value: motion.cancellationInFlight, color: D2.red },
  ];
  return (
    <Panel>
      <PanelHeading title="Revenue in Motion" subtitle="Stable vs. currently in transition" />
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ flex: total > 0 ? s.value : 1, background: s.color }} />
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {segments.map((s) => (
          <div key={s.label} style={{ display: "grid", gridTemplateColumns: "10px minmax(0,1fr) 118px", gap: 10 }} className="items-center">
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
            <div style={{ fontSize: 14, color: D2.mutedStrong }}>{s.label}</div>
            <div style={{ fontSize: 14, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              <span style={{ fontWeight: 600 }}>{formatINR(s.value)}</span>{" "}
              <span style={{ color: D2.muted, fontSize: 13 }}>{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function BillingActionsPanel({ orders, onNavigate }: { orders: OrderRecord[]; onNavigate: NavigateFn }) {
  const toOpen = orders.filter((o) => getDisplayStage(o) === "toOpen");
  const toAmend = orders.filter((o) => getDisplayStage(o) === "toAmend");
  const toClose = orders.filter((o) => o.lifecycleStatus === "cancelled" && o.billingStatus === "open");
  const amount = [...toOpen, ...toAmend, ...toClose].reduce((sum, o) => sum + o.amount, 0);
  const rows = [
    { label: "To Open", count: toOpen.length },
    { label: "To Amend", count: toAmend.length },
    { label: "To Close", count: toClose.length },
  ];

  return (
    <Panel className="justify-between">
      <div className="flex flex-col gap-3.5">
        <PanelHeading title="Billing Actions Due" subtitle="Orders waiting on a billing action" />
        <div className="flex flex-col">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3"
              style={{ padding: "10px 0", borderBottom: i === rows.length - 1 ? "none" : `1px solid ${D2.rowDivider}` }}
            >
              <div style={{ fontSize: 14, color: D2.mutedStrong }}>{r.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.count}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2.5">
        <div style={{ fontSize: 13, color: D2.muted }}>{formatINR(amount)} contracted value pending action</div>
        <button
          type="button"
          onClick={() => onNavigate("orders", "closeBilling")}
          style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: D2.brand, borderRadius: 5, padding: "9px 14px" }}
        >
          Close Billing
        </button>
      </div>
    </Panel>
  );
}

function OpenedVsProjectedPanel({ orders }: { orders: OrderRecord[] }) {
  const scoped = orders.filter((o) => o.lifecycleStatus !== "cancelled");
  const fyColumns = buildFiscalYearColumns(new Date());
  let projected = 0;
  let opened = 0;
  fyColumns.forEach((col) => {
    scoped.forEach((o) => {
      if (!billsInColumn(o, col)) return;
      projected += o.amount;
      if (isBillingOpenInColumn(o, col)) opened += o.amount;
    });
  });
  const pct = projected > 0 ? Math.min(100, (opened / projected) * 100) : 0;

  return (
    <Panel>
      <PanelHeading title="Revenue — Opened vs Projected" subtitle={`FY ${fyColumns[0].year}–${fyColumns[11].year}`} />
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: D2.muted, fontWeight: 600 }}>Opened</div>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{formatINR(opened)}</div>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: D2.muted, fontWeight: 600 }}>
            Projected (full FY)
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{formatINR(projected)}</div>
        </div>
      </div>
      <div>
        <Bar pct={pct} color={D2.green} height={10} />
        <div style={{ fontSize: 13, color: D2.muted, textAlign: "right", marginTop: 7 }}>{pct.toFixed(1)}% opened</div>
      </div>
    </Panel>
  );
}
