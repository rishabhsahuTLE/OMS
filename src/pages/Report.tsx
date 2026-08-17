import { useNavigate, useParams } from "react-router-dom";
import type { OrderRecord, ReportSubTabId } from "../types";
import Approval from "./report/Approval";
import Billing from "./report/Billing";
import ManagerReport from "./ManagerReport";

interface ReportProps {
  orders: OrderRecord[];
}

const REPORT_TABS: { key: ReportSubTabId; label: string }[] = [
  { key: "billing", label: "Billing" },
  { key: "approval", label: "Approval" },
  { key: "managerReport", label: "Manager Report" },
];

export default function Report({ orders }: ReportProps) {
  const { subTab } = useParams<{ subTab: string }>();
  const navigate = useNavigate();
  const activeTab = (subTab as ReportSubTabId) || "billing";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-2">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate(`/report/${t.key}`)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "billing" ? (
          <Billing orders={orders} />
        ) : activeTab === "managerReport" ? (
          <ManagerReport orders={orders} />
        ) : (
          <Approval orders={orders} />
        )}
      </div>
    </div>
  );
}
