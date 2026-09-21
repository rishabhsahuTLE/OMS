import { useMemo, useState } from "react";
import type { OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import { billsInColumn, buildFiscalYearColumns, getDisplayStage, isBillingOpenInColumn, toggleSortState, type SortState } from "../../utils";
import { type DashboardFilters } from "../dashboard/filters";
import { buildManagerForecast, buildRevenueMotion, formatINR, type ForecastQuarter, type ManagerForecastRow, type NavigateFn } from "../dashboard/shared";
import RevenueTrend from "../dashboard/widgets/RevenueTrend";
import { D2 } from "./tokens";
import {
  Avatar,
  Bar,
  ChartTooltip,
  EmptyRow,
  HeaderStat,
  Panel,
  PanelHeading,
  PillTabs,
  Section,
  SortableHeader,
  useChartTooltip,
} from "./ui";

export default function Section2OrderAndBilling({
  orders,
  rawOrders,
  filters,
  onNavigate,
}: {
  orders: OrderRecord[];
  rawOrders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
}) {
  const motion = buildRevenueMotion(orders);
  const revenueInMotion = motion.active + motion.amendmentInFlight + motion.cancellationInFlight;
  const open = orders.filter((o) => o.lifecycleStatus !== "cancelled");
  const totalForecast = open.reduce((sum, o) => sum + o.amount, 0);

  return (
    <Section
      accent={D2.green}
      title="Order and Billing"
      subtitle="Live contracts, billing actions and revenue forecast by manager, product and business unit"
      right={
        <div className="flex items-baseline gap-5">
          <HeaderStat
            label="Revenue in motion"
            value={formatINR(revenueInMotion)}
            tip="Contracted value of orders that are active, mid-amendment, or mid-cancellation — excludes orders not yet activated and cancelled orders."
          />
          <HeaderStat
            label="Total forecast"
            value={formatINR(totalForecast)}
            tip="Total contracted value of every order that isn't cancelled, including ones still awaiting approval."
          />
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }} className="items-start">
        <RevenueInMotionPanel motion={motion} />
        <BillingActionsPanel orders={orders} onNavigate={onNavigate} />
        <OpenedVsProjectedPanel orders={orders} />
      </div>
      <RevenueTrend orders={rawOrders} filters={filters} size="lg" />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: 12 }} className="items-start">
        <ProductRevenuePanel orders={open} />
        <ManagerForecastPanel orders={orders} onNavigate={onNavigate} />
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
  const { tip, show, move, hide } = useChartTooltip();
  return (
    <Panel>
      <PanelHeading title="Revenue in Motion" subtitle="Stable vs. currently in transition" />
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 }}>
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div
              key={s.label}
              style={{ flex: total > 0 ? s.value : 1, background: s.color, transition: "opacity 120ms ease-out", opacity: tip?.label === s.label ? 0.82 : 1 }}
              onMouseEnter={(e) => show(e, s.label, `${formatINR(s.value)} (${pct}%)`)}
              onMouseMove={move}
              onMouseLeave={hide}
            />
          );
        })}
        <ChartTooltip tip={tip} />
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
        <Bar
          pct={pct}
          color={D2.green}
          height={10}
          tooltipLabel="Opened vs Projected"
          tooltipValue={`${formatINR(opened)} of ${formatINR(projected)} (${pct.toFixed(1)}%)`}
        />
        <div style={{ fontSize: 13, color: D2.muted, textAlign: "right", marginTop: 7 }}>{pct.toFixed(1)}% opened</div>
      </div>
    </Panel>
  );
}

function ProductRevenuePanel({ orders }: { orders: OrderRecord[] }) {
  const total = orders.reduce((sum, o) => sum + o.amount, 0);
  const metrics = PRODUCT_NAMES.map((product) => {
    const revenue = orders.filter((o) => o.product === product).reduce((sum, o) => sum + o.amount, 0);
    return { product, revenue, pct: total > 0 ? (revenue / total) * 100 : 0, color: D2.product[product] ?? D2.faint };
  }).filter((m) => m.revenue > 0);

  let cumulative = 0;
  const slices = metrics.map((m) => {
    const dashoffset = ((25 - cumulative) % 100 + 100) % 100;
    cumulative += m.pct;
    return { ...m, dashoffset };
  });

  const { tip, show, move, hide } = useChartTooltip();
  const [hoverSlice, setHoverSlice] = useState<string | null>(null);

  return (
    <Panel>
      <PanelHeading title="Product-wise Revenue" subtitle="Share of contracted value" />
      {slices.length === 0 ? (
        <EmptyRow />
      ) : (
        <>
          <div className="flex justify-center" style={{ padding: "6px 0" }}>
            <svg width="180" height="180" viewBox="0 0 42 42">
              {slices.map((s) => {
                const active = hoverSlice === s.product;
                return (
                  <circle
                    key={s.product}
                    cx="21"
                    cy="21"
                    r="15.9"
                    fill="transparent"
                    stroke={s.color}
                    strokeWidth={active ? 8.5 : 7}
                    strokeDasharray={`${s.pct} ${100 - s.pct}`}
                    strokeDashoffset={s.dashoffset}
                    style={{ cursor: "pointer", transition: "stroke-width 120ms ease-out", opacity: hoverSlice && !active ? 0.55 : 1 }}
                    onMouseEnter={(e) => {
                      setHoverSlice(s.product);
                      show(e, s.product, `${formatINR(s.revenue)} (${s.pct.toFixed(0)}%)`);
                    }}
                    onMouseMove={move}
                    onMouseLeave={() => {
                      setHoverSlice(null);
                      hide();
                    }}
                  />
                );
              })}
            </svg>
            <ChartTooltip tip={tip} />
          </div>
          <div className="flex flex-col gap-2.5">
            {slices.map((s) => (
              <div key={s.product} style={{ display: "grid", gridTemplateColumns: "10px minmax(0,1fr) 118px", gap: 10 }} className="items-center">
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color }} />
                <div style={{ fontSize: 14, color: D2.mutedStrong }}>{s.product}</div>
                <div style={{ fontSize: 14, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ fontWeight: 600 }}>{formatINR(s.revenue)}</span>{" "}
                  <span style={{ color: D2.muted, fontSize: 13 }}>{s.pct.toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

type SortKey = "manager" | "orders" | "forecast";
const ROW_COLUMNS = "minmax(0,1.2fr) 86px 140px minmax(0,1fr)";

function ManagerForecastPanel({ orders, onNavigate }: { orders: OrderRecord[]; onNavigate: NavigateFn }) {
  const [quarter, setQuarter] = useState<ForecastQuarter>("all");
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "forecast", direction: "desc" });
  const { rows } = useMemo(() => buildManagerForecast(orders, quarter), [orders, quarter]);

  const sorted = useMemo(() => {
    const base = [...rows].sort((a, b) => {
      if (sort.key === "manager") return a.manager.localeCompare(b.manager);
      if (sort.key === "orders") return a.orders - b.orders;
      return a.forecast - b.forecast;
    });
    return sort.direction === "asc" ? base : base.reverse();
  }, [rows, sort]);

  const top = sorted.slice(0, 4);

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSortState(prev, key));
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PanelHeading title="Manager forecast" subtitle="Projected revenue from orders under each manager, phased by first billing date" />
        <PillTabs
          options={[
            { key: "all", label: "All" },
            { key: "q3", label: "Q3" },
            { key: "q4", label: "Q4" },
          ]}
          value={quarter}
          onChange={setQuarter}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyRow />
      ) : (
        <>
          <div
            style={{ display: "grid", gridTemplateColumns: ROW_COLUMNS, gap: 16, borderBottom: `2px solid ${D2.border}`, paddingBottom: 9 }}
          >
            <SortableHeader label="Manager" sortKey="manager" sort={sort} onSort={handleSort} />
            <SortableHeader label="Orders" sortKey="orders" sort={sort} onSort={handleSort} align="right" />
            <SortableHeader label="Forecast" sortKey="forecast" sort={sort} onSort={handleSort} align="right" />
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: D2.muted, fontWeight: 600 }}>
              Share of total
            </div>
          </div>
          <div className="flex flex-col">
            {top.map((r, idx) => (
              <ManagerRow key={r.manager} row={r} last={idx === top.length - 1} onClick={() => onNavigate("report", "managerReport", { manager: r.manager })} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div style={{ fontSize: 13, color: D2.muted }}>Forecast = contracted value of open orders, recognised from each order's first billing date</div>
            <button type="button" onClick={() => onNavigate("report", "managerReport")} style={{ fontSize: 13, fontWeight: 600, color: D2.link }}>
              View all {rows.length} manager{rows.length === 1 ? "" : "s"} →
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}

function ManagerRow({ row, last, onClick }: { row: ManagerForecastRow; last: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: "grid", gridTemplateColumns: ROW_COLUMNS, gap: 16, alignItems: "center", padding: 12, borderBottom: last ? "none" : `1px solid ${D2.rowDivider}`, textAlign: "left" }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={row.manager} />
        <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.manager}</div>
      </div>
      <div style={{ fontSize: 15, textAlign: "right", fontVariantNumeric: "tabular-nums", color: D2.mutedStrong }}>{row.orders}</div>
      <div style={{ fontSize: 15, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{formatINR(row.forecast)}</div>
      <div className="flex items-center gap-2.5">
        <div style={{ flex: 1 }}>
          <Bar
            pct={row.share}
            color={D2.brand}
            height={8}
            tooltipLabel={row.manager}
            tooltipValue={`${formatINR(row.forecast)} · ${row.orders} order${row.orders === 1 ? "" : "s"} (${row.share.toFixed(0)}%)`}
          />
        </div>
        <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: D2.mutedStrong, width: 34, textAlign: "right" }}>
          {row.share.toFixed(0)}%
        </div>
      </div>
    </button>
  );
}
