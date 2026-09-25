import { useMemo, useState } from "react";
import type { OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import { billsInColumn, buildFiscalYearColumns, getDisplayStage, isBillingOpenInColumn, toggleSortState, type SortState } from "../../utils";
import { type DashboardFilters } from "../dashboard/filters";
import {
  buildManagerForecast,
  buildRevenueMotion,
  formatINR,
  formatINRCompact,
  type ForecastQuarter,
  type ManagerForecastRow,
  type NavigateFn,
} from "../dashboard/shared";
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }} className="items-stretch">
        <ProductRevenuePanel orders={open} />
        <BillingActionsPanel orders={orders} onNavigate={onNavigate} />
        <OpenedVsProjectedPanel orders={orders} />
      </div>
      <RevenueTrend orders={rawOrders} filters={filters} size="lg" />
      <ManagerForecastPanel orders={orders} onNavigate={onNavigate} />
    </Section>
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

  // Second bar is scoped to just the current calendar month's column, not
  // the FY-to-date total — a standalone snapshot of this month rather than
  // a cumulative figure.
  const currentCol = fyColumns.find((c) => c.isCurrent) ?? fyColumns[fyColumns.length - 1];
  const monthLabel = `${currentCol.label.charAt(0)}${currentCol.label.slice(1).toLowerCase()} ${currentCol.year}`;
  let monthProjected = 0;
  let monthOpened = 0;
  scoped.forEach((o) => {
    if (!billsInColumn(o, currentCol)) return;
    monthProjected += o.amount;
    if (isBillingOpenInColumn(o, currentCol)) monthOpened += o.amount;
  });
  const pctMonth = monthProjected > 0 ? Math.min(100, (monthOpened / monthProjected) * 100) : 0;

  return (
    <Panel className="justify-between">
      <PanelHeading title="Revenue — Opened vs Projected" subtitle={`FY ${fyColumns[0].year}–${fyColumns[11].year}`} />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: D2.muted, fontWeight: 600 }}>Opened</div>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{formatINR(opened)}</div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span style={{ fontSize: 13, color: D2.mutedStrong }}>vs Full-Year Projection</span>
            <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{formatINR(projected)}</span>
          </div>
          <Bar
            pct={pct}
            color={D2.green}
            height={10}
            tooltipLabel="Opened vs Full-Year Projection"
            tooltipValue={`${formatINR(opened)} of ${formatINR(projected)} (${Math.round(pct)}%)`}
          />
          <div style={{ fontSize: 12, color: D2.muted, textAlign: "right" }}>{Math.round(pct)}% of full year</div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span style={{ fontSize: 13, color: D2.mutedStrong }}>Opened vs Projected — {monthLabel}</span>
            <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {formatINR(monthOpened)} <span style={{ color: D2.muted, fontWeight: 400 }}>of</span> {formatINR(monthProjected)}
            </span>
          </div>
          <Bar
            pct={pctMonth}
            color={D2.brand}
            height={10}
            tooltipLabel={`Opened vs Projected — ${monthLabel}`}
            tooltipValue={`${formatINR(monthOpened)} of ${formatINR(monthProjected)} (${Math.round(pctMonth)}%)`}
          />
          <div style={{ fontSize: 12, color: D2.muted, textAlign: "right" }}>{Math.round(pctMonth)}% opened this month</div>
        </div>
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
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {slices.map((s) => (
              <div key={s.product} className="flex items-center gap-1.5">
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: D2.mutedStrong }}>{s.product}</span>
              </div>
            ))}
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <svg width="100%" height="100%" viewBox="0 0 42 42" style={{ maxWidth: 260, maxHeight: 260 }}>
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
                    strokeWidth={active ? 6.5 : 5.5}
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
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span style={{ fontSize: 13, fontWeight: 600, color: D2.link }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: D2.text, lineHeight: 1.3 }}>{formatINRCompact(total)}</span>
              <span style={{ fontSize: 12, color: D2.muted }}>100%</span>
            </div>
            <ChartTooltip tip={tip} />
          </div>
        </div>
      )}
    </Panel>
  );
}

type SortKey = "manager" | "orders" | "forecast";
const ROW_COLUMNS = "minmax(0,1.1fr) 54px 54px 62px 120px minmax(0,1fr)";

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
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: D2.muted, fontWeight: 600, textAlign: "right" }}>
              Active
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: D2.muted, fontWeight: 600, textAlign: "right" }}>
              Pending
            </div>
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
      <div style={{ fontSize: 15, textAlign: "right", fontVariantNumeric: "tabular-nums", color: D2.mutedStrong }}>{row.activeOrders}</div>
      <div
        style={{
          fontSize: 15,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          color: row.pendingOrders > 0 ? D2.red : D2.mutedStrong,
          fontWeight: row.pendingOrders > 0 ? 600 : 400,
        }}
      >
        {row.pendingOrders}
      </div>
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
