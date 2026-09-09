import type { OrderRecord } from "../../../types";
import { formatDDMMYYYY, getDisplayStage } from "../../../utils";
import { applyStructuralFilters, inDateRange, type DashboardFilters } from "../filters";
import { buildRejectedRows, type NavigateFn, type RejectedRow } from "../shared";
import { agingHealth, Badge, Button, DashboardCard, DataTable, EmptyState, type CardSize, type DataTableColumn } from "../ui";

// "Rejected during period" reading of Date — filters by each row's own
// rejection date, not order.createdOn.
export default function RejectedNeedsFix({
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
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true });
  const rows = buildRejectedRows(scoped).filter((r) => inDateRange(r.rejectedDate, filters.dateRange));

  const columns: DataTableColumn<RejectedRow>[] = [
    { key: "orderNo", label: "Order Number", render: (r) => <span className="font-medium text-slate-800">{r.order.orderNo}</span> },
    { key: "client", label: "Client", render: (r) => r.order.client },
    { key: "product", label: "Product", render: (r) => r.order.product },
    { key: "stage", label: "Rejected Stage", render: (r) => r.stageLabel },
    { key: "reason", label: "Rejection Reason", render: (r) => <span className="text-slate-500">{r.reason}</span> },
    { key: "date", label: "Rejected Date", render: (r) => formatDDMMYYYY(r.rejectedDate) },
    {
      key: "days",
      label: "Days Since",
      align: "right",
      render: (r) => <Badge tone={agingHealth(r.daysSince)}>{r.daysSince}d</Badge>,
    },
    {
      key: "edit",
      label: "",
      align: "right",
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Button onClick={() => onNavigate("orders", "approval", { edit: r.order.id })}>Edit</Button>
        </span>
      ),
    },
  ];

  return (
    <DashboardCard title="Rejected — Needs Fix" subtitle="Fix and resubmit" size={size} accent="rose">
      {rows.length === 0 ? (
        <EmptyState message="Nothing rejected right now." />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => `${r.order.id}-${r.stageKey}`}
          maxHeight="max-h-96"
          onRowClick={(r) => onNavigate("orders", "amendCancel", { stage: getDisplayStage(r.order), q: r.order.orderNo })}
        />
      )}
    </DashboardCard>
  );
}
