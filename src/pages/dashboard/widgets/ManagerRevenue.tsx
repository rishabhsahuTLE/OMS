import { useState } from "react";
import type { OrderRecord } from "../../../types";
import { buildManagerStats } from "../../ManagerReport";
import { applyStructuralFilters, inDateRange, type DashboardFilters } from "../filters";
import { formatINR, type NavigateFn } from "../shared";
import { DashboardCard, DataTable, EmptyState, SortSwitch, type CardSize, type DataTableColumn } from "../ui";

type SortKey = "revenue" | "orders";

interface Row {
  manager: string;
  orders: number;
  revenue: number;
  share: number;
}

// "Activity during period" reading of Date: an order counts toward a
// manager's revenue here if it was created within the selected window.
export default function ManagerRevenue({
  orders,
  filters,
  onNavigate,
  size = "md",
}: {
  orders: OrderRecord[];
  filters: DashboardFilters;
  onNavigate: NavigateFn;
  size?: CardSize;
}) {
  const [sort, setSort] = useState<SortKey>("revenue");
  const dateRange = filters.dateRange;
  const scoped = applyStructuralFilters(orders, filters, { includeManager: true })
    .filter((o) => o.lifecycleStatus !== "cancelled")
    .filter((o) => inDateRange(o.createdOn, dateRange));

  const totalRevenue = scoped.reduce((sum, o) => sum + o.amount, 0);
  const rows: Row[] = buildManagerStats(scoped)
    .map((m) => ({ manager: m.manager, orders: m.total, revenue: m.amount, share: totalRevenue > 0 ? (m.amount / totalRevenue) * 100 : 0 }))
    .sort((a, b) => (sort === "revenue" ? b.revenue - a.revenue : b.orders - a.orders));

  const columns: DataTableColumn<Row>[] = [
    { key: "manager", label: "Client Manager", render: (r) => <span className="font-medium text-slate-800">{r.manager}</span> },
    { key: "orders", label: "Orders", align: "right", render: (r) => r.orders },
    { key: "revenue", label: "Revenue", align: "right", render: (r) => <span className="font-semibold">{formatINR(r.revenue)}</span> },
    { key: "share", label: "Share", align: "right", render: (r) => <span className="text-slate-400">{r.share.toFixed(0)}%</span> },
  ];

  return (
    <DashboardCard
      title="Manager-wise Revenue"
      size={size}
      action={
        <SortSwitch
          options={[
            { key: "revenue", label: "Highest Revenue" },
            { key: "orders", label: "Highest Orders" },
          ]}
          value={sort}
          onChange={setSort}
        />
      }
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.manager} onRowClick={(r) => onNavigate("report", "managerReport", { manager: r.manager })} />
      )}
    </DashboardCard>
  );
}
