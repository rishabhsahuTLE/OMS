import { useMemo, useState } from "react";
import type { OrderRecord } from "../../types";
import { getDisplayStage, toggleSortState, type ApprovalStageKey, type SortState } from "../../utils";
import { buildAgeRows, formatINR, type NavigateFn, type StageAgeInfo } from "../dashboard/shared";
import { D2 } from "./tokens";
import { EmptyRow, HeaderStat, Panel, PanelHeading, Section, SortableHeader, WaitingPill } from "./ui";

const SHORT_STAGE: Record<ApprovalStageKey, string> = {
  technical: "Tech",
  financial: "Fin",
  cancellationTechnical: "TC",
  cancellationFinancial: "FC",
};

function shortStageLabel(r: StageAgeInfo): string {
  if (r.stageKey === null) return r.stageLabel;
  const short = SHORT_STAGE[r.stageKey];
  return r.stageLabel.replace(/^(Technical|Financial|Cancellation-Technical|Cancellation-Financial)/, short);
}

type SortKey = "order" | "client" | "stage" | "value" | "age";
const COLUMNS = "150px minmax(0,1fr) minmax(0,190px) 130px 110px";

export default function Section4Ageing({ orders, onNavigate }: { orders: OrderRecord[]; onNavigate: NavigateFn }) {
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "age", direction: "desc" });
  const rows = useMemo(() => buildAgeRows(orders), [orders]);
  const oldest = Math.max(0, ...rows.map((r) => r.ageDays));

  const sorted = useMemo(() => {
    const base = [...rows].sort((a, b) => {
      if (sort.key === "order") return a.order.orderNo.localeCompare(b.order.orderNo);
      if (sort.key === "client") return a.order.client.localeCompare(b.order.client);
      if (sort.key === "stage") return a.stageLabel.localeCompare(b.stageLabel);
      if (sort.key === "value") return a.order.amount - b.order.amount;
      return a.ageDays - b.ageDays;
    });
    return sort.direction === "asc" ? base : base.reverse();
  }, [rows, sort]);

  const shown = sorted.slice(0, 8);

  function handleSort(key: SortKey) {
    setSort((prev) => toggleSortState(prev, key));
  }

  function rowTarget(r: StageAgeInfo) {
    return r.stageKey !== null
      ? onNavigate("orders", "amendCancel", { stage: getDisplayStage(r.order), q: r.order.orderNo })
      : onNavigate("orders", "closeBilling");
  }

  return (
    <Section
      accent={D2.faint}
      title="Order ageing"
      subtitle="How long each open order has sat in its current stage"
      right={<HeaderStat label="Oldest" value={`${oldest}d`} color={D2.red} />}
    >
      <Panel>
        <PanelHeading title="Age at Stage — Order-wise" subtitle="Click any column heading to sort" />

        <div style={{ display: "grid", gridTemplateColumns: COLUMNS, gap: 16, borderBottom: `2px solid ${D2.border}`, paddingBottom: 9 }}>
          <SortableHeader label="Order" sortKey="order" sort={sort} onSort={handleSort} />
          <SortableHeader label="Client" sortKey="client" sort={sort} onSort={handleSort} />
          <SortableHeader label="Current Stage" sortKey="stage" sort={sort} onSort={handleSort} />
          <SortableHeader label="Order Value" sortKey="value" sort={sort} onSort={handleSort} align="right" />
          <SortableHeader label="Days at Stage" sortKey="age" sort={sort} onSort={handleSort} align="right" />
        </div>

        {shown.length === 0 ? (
          <EmptyRow message="Nothing in flight." />
        ) : (
          <div className="flex flex-col">
            {shown.map((r, idx) => (
              <button
                key={r.order.id}
                type="button"
                onClick={() => rowTarget(r)}
                style={{
                  display: "grid",
                  gridTemplateColumns: COLUMNS,
                  gap: 16,
                  alignItems: "center",
                  padding: "11px 12px",
                  borderBottom: idx === shown.length - 1 ? "none" : `1px solid ${D2.rowDivider}`,
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{r.order.orderNo}</div>
                <div style={{ fontSize: 14, color: D2.mutedStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.order.client}
                </div>
                <div style={{ fontSize: 14, color: D2.mutedStrong, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {shortStageLabel(r)}
                </div>
                <div style={{ fontSize: 14, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatINR(r.order.amount)}</div>
                <div style={{ textAlign: "right" }}>
                  <WaitingPill days={r.ageDays} />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3" style={{ paddingTop: 4 }}>
          <div style={{ fontSize: 13, color: D2.muted }}>
            Showing {shown.length} of {rows.length}, sorted by {sort.key === "age" ? "days at stage" : sort.key}
          </div>
          <button type="button" onClick={() => onNavigate("orders", "amendCancel")} style={{ fontSize: 13, fontWeight: 600, color: D2.link }}>
            Open in order list →
          </button>
        </div>
      </Panel>
    </Section>
  );
}
