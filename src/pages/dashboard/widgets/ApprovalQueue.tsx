import { useState } from "react";
import type { OrderRecord } from "../../../types";
import { getDisplayStage } from "../../../utils";
import { applyStructuralFilters, type DashboardFilters } from "../filters";
import { buildApprovalQueue, formatINR, type NavigateFn, type QueueItem, type RoleDept } from "../shared";
import { agingHealth, Badge, DashboardCard, DataTable, EmptyState, SortSwitch, type CardSize, type DataTableColumn } from "../ui";

type SortKey = "oldest" | "newest";

// Current-state widget (whose turn is it right now) — no Date filter, but
// BU/Product/Manager all narrow it.
export default function ApprovalQueue({
  orders,
  filters,
  dept,
  onNavigate,
  size = "lg",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  dept: RoleDept;
  onNavigate: NavigateFn;
  size?: CardSize;
}) {
  const [sort, setSort] = useState<SortKey>("oldest");
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const items = buildApprovalQueue(scoped, dept).sort((a, b) => (sort === "oldest" ? b.ageDays - a.ageDays : a.ageDays - b.ageDays));

  const columns: DataTableColumn<QueueItem>[] = [
    {
      key: "orderNo",
      label: "Order Number",
      render: (r) => <span className="font-medium text-slate-800">{r.order.orderNo}</span>,
    },
    { key: "client", label: "Client", render: (r) => r.order.client },
    { key: "product", label: "Product", render: (r) => r.order.product },
    { key: "stage", label: "Stage", render: (r) => r.stageLabel },
    { key: "amount", label: "Order Value", align: "right", render: (r) => formatINR(r.amount) },
    {
      key: "age",
      label: "Days Waiting",
      align: "right",
      render: (r) => (
        <Badge tone={agingHealth(r.ageDays)}>{r.ageDays}d</Badge>
      ),
    },
  ];

  return (
    <DashboardCard
      title={`${dept === "Tech" ? "Technical" : "Financial"} Approval Queue`}
      subtitle={`${dept === "Tech" ? "Technical / Cancellation-Technical" : "Financial / Cancellation-Financial"} decisions pending`}
      size={size}
      accent="indigo"
      action={
        <SortSwitch
          options={[
            { key: "oldest", label: "Oldest" },
            { key: "newest", label: "Newest" },
          ]}
          value={sort}
          onChange={setSort}
        />
      }
    >
      {items.length === 0 ? (
        <EmptyState message={`Nothing waiting in the ${dept === "Tech" ? "Technical" : "Financial"} queue right now.`} />
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.order.id}
          maxHeight="max-h-96"
          onRowClick={(r) => onNavigate("orders", "amendCancel", { stage: getDisplayStage(r.order), q: r.order.orderNo })}
        />
      )}
    </DashboardCard>
  );
}
