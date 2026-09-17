import { useMemo, useState } from "react";
import { BUSINESS_UNITS, type OrderRecord } from "../../types";
import { PRODUCT_NAMES } from "../../products";
import { billsInColumn, buildFiscalYearColumns, toggleSortState, type SortState } from "../../utils";
import { buildManagerForecast, formatINR, type ForecastQuarter, type ManagerForecastRow, type NavigateFn } from "../dashboard/shared";
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

const BU_LEGEND_ORDER = ["Enterprise CEP", "Premiere Inst", "Univ-Ops", "IMPACT", "ENTERPRISE"].filter((bu) =>
  (BUSINESS_UNITS as readonly string[]).includes(bu)
);

export default function Section4Forecast({ orders, onNavigate }: { orders: OrderRecord[]; onNavigate: NavigateFn }) {
  const open = orders.filter((o) => o.lifecycleStatus !== "cancelled");
  const totalForecast = open.reduce((sum, o) => sum + o.amount, 0);

  return (
    <Section
      accent={D2.link}
      title="Revenue and forecast"
      subtitle="Projected revenue by manager, product and business unit"
      right={<HeaderStat label="Total forecast" value={formatINR(totalForecast)} />}
    >
      <RevenueTrendPanel orders={open} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: 12 }} className="items-start">
        <ProductRevenuePanel orders={open} />
        <ManagerForecastPanel orders={orders} onNavigate={onNavigate} />
      </div>
    </Section>
  );
}

function RevenueTrendPanel({ orders }: { orders: OrderRecord[] }) {
  const fyColumns = buildFiscalYearColumns(new Date());
  const activeBUs = BU_LEGEND_ORDER.filter((bu) => orders.some((o) => o.bu === bu));

  const series = activeBUs.map((bu) => ({
    bu,
    color: D2.bu[bu] ?? D2.faint,
    values: fyColumns.map((col) => orders.filter((o) => o.bu === bu && billsInColumn(o, col)).reduce((sum, o) => sum + o.amount, 0)),
  }));
  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));

  const xFor = (i: number) => 10 + i * 60;
  const yFor = (v: number) => 236 - (v / maxValue) * (236 - 14);
  const pointsFor = (values: number[]) => values.map((v, i) => `${xFor(i)},${yFor(v).toFixed(1)}`).join(" ");

  const { tip, show, move, hide } = useChartTooltip();
  const [hoverPoint, setHoverPoint] = useState<{ bu: string; i: number } | null>(null);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PanelHeading title="Revenue Trend by Business Unit" subtitle={`FY ${fyColumns[0].year}–${fyColumns[11].year}, monthly`} />
        <div className="flex flex-wrap gap-3.5">
          {series.map((s) => (
            <div key={s.bu} className="flex items-center gap-1.5" style={{ fontSize: 12, color: D2.mutedStrong }}>
              <span style={{ width: 14, height: 2, background: s.color, display: "inline-block" }} />
              {s.bu}
            </div>
          ))}
        </div>
      </div>
      {series.length === 0 ? (
        <EmptyRow />
      ) : (
        <div>
          <svg viewBox="0 0 720 260" preserveAspectRatio="none" style={{ width: "100%", height: 260, display: "block" }}>
            {[14, 76, 138, 200, 236].map((y) => (
              <line key={y} x1={0} y1={y} x2={720} y2={y} stroke={y === 236 ? D2.border : D2.rowDivider} strokeWidth={1} />
            ))}
            {series.map((s) => (
              <polyline
                key={s.bu}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                opacity={hoverPoint && hoverPoint.bu !== s.bu ? 0.35 : 1}
                style={{ transition: "opacity 120ms ease-out" }}
                points={pointsFor(s.values)}
              />
            ))}
            {series.map((s) =>
              s.values.map((v, i) => {
                const active = hoverPoint?.bu === s.bu && hoverPoint.i === i;
                return (
                  <circle
                    key={`${s.bu}-${i}`}
                    cx={xFor(i)}
                    cy={yFor(v)}
                    r={active ? 4.5 : 8}
                    fill={active ? s.color : "transparent"}
                    stroke={active ? "#fff" : "none"}
                    strokeWidth={active ? 1.5 : 0}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      setHoverPoint({ bu: s.bu, i });
                      show(e, `${s.bu} · ${fyColumns[i].label}`, formatINR(v));
                    }}
                    onMouseMove={move}
                    onMouseLeave={() => {
                      setHoverPoint(null);
                      hide();
                    }}
                  />
                );
              })
            )}
          </svg>
          <ChartTooltip tip={tip} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12,minmax(0,1fr))", fontSize: 11, color: D2.faint, textAlign: "center", marginTop: 4 }}>
            {fyColumns.map((c) => (
              <div key={`${c.year}-${c.month0}`}>{c.label}</div>
            ))}
          </div>
        </div>
      )}
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
