import { useState } from "react";
import type { OrderRecord } from "../../../types";
import { getDisplayStage } from "../../../utils";
import { applyStructuralFilters, inDateRange, type DashboardFilters } from "../filters";
import { buildAgeRows, formatINR, type NavigateFn, type StageAgeInfo } from "../shared";
import { agingHealth, Badge, DashboardCard, DataTable, EmptyState, SortSwitch, type CardSize, type DataTableColumn } from "../ui";

type SortKey = "oldest" | "newest" | "value";

// "Stage entered during period" reading of Date — filters by when each
// order entered its *current* stage, not order.createdOn.
export default function AgeAtStage({
  orders,
  filters,
  onNavigate,
  size = "lg",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
  size?: CardSize;
}) {
  const [sort, setSort] = useState<SortKey>("oldest");
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const rows = [...buildAgeRows(scoped).filter((r) => inDateRange(r.stageEnteredOn, filters.dateRange))].sort((a, b) =>
    sort === "value" ? b.order.amount - a.order.amount : sort === "oldest" ? b.ageDays - a.ageDays : a.ageDays - b.ageDays
  );

  const columns: DataTableColumn<StageAgeInfo>[] = [
    { key: "order", label: "Order", render: (r) => <span className="font-medium text-slate-800">{r.order.orderNo}</span> },
    { key: "client", label: "Client", render: (r) => r.order.client },
    { key: "stage", label: "Current Stage", render: (r) => r.stageLabel },
    { key: "value", label: "Order Value", align: "right", render: (r) => formatINR(r.order.amount) },
    {
      key: "age",
      label: "Days at Stage",
      align: "right",
      render: (r) => <Badge tone={agingHealth(r.ageDays)}>{r.ageDays}d</Badge>,
    },
  ];

  return (
    <DashboardCard
      title="Age at Stage — Order-wise"
      size={size}
      action={
        <SortSwitch
          options={[
            { key: "oldest", label: "Oldest" },
            { key: "newest", label: "Newest" },
            { key: "value", label: "Highest Value" },
          ]}
          value={sort}
          onChange={setSort}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState message="Nothing in flight." />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.order.id}
          maxHeight="max-h-96"
          onRowClick={(r) =>
            r.stageKey !== null
              ? onNavigate("orders", "amendCancel", { stage: getDisplayStage(r.order), q: r.order.orderNo })
              : onNavigate("orders", "closeBilling")
          }
        />
      )}
    </DashboardCard>
  );
}
