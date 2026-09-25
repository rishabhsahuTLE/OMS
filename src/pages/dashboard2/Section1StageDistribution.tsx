import type { OrderRecord } from "../../types";
import { buildStageBuckets, formatINR, type NavigateFn } from "../dashboard/shared";
import { D2 } from "./tokens";
import { Section, StatTile } from "./ui";

export default function Section1StageDistribution({ orders, onNavigate }: { orders: OrderRecord[]; onNavigate: NavigateFn }) {
  const buckets = buildStageBuckets(orders);
  const totalCount = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);

  function go(stageParam: string) {
    onNavigate("orders", "approval", { stage: stageParam });
  }

  return (
    <Section accent={D2.brand} title="Stage Distribution">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12 }}>
        <StatTile label="All Orders" value={totalCount} amount={formatINR(totalRevenue)} highlighted onClick={() => go("all")} />
        {buckets.map((b) => (
          <StatTile
            key={b.key}
            label={b.label}
            value={b.count}
            amount={formatINR(b.revenue)}
            valueColor={D2.stageBucket[b.key]}
            onClick={() => go(b.stageParam)}
          />
        ))}
      </div>
    </Section>
  );
}
