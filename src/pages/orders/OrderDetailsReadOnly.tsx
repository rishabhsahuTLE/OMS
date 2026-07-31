import type { ReactNode } from "react";
import type { OrderRecord } from "../../types";
import { getProduct } from "../../products";
import { formatDDMMYYYY } from "../../utils";

const readonlyClass = "w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-3">
        <h3 className="text-sm font-semibold tracking-wide text-slate-700">{title}</h3>
      </div>
      <div className="space-y-4 px-6 py-5">{children}</div>
    </div>
  );
}

export function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-center gap-x-4">
      <label className="text-right text-sm font-medium text-slate-700">{label}</label>
      <input className={`${readonlyClass} max-w-lg`} value={value || "—"} disabled />
    </div>
  );
}

// Account/Contact/Order/Payment/Document sections, all non-editable — used
// both by the Approval review page and the cancellation-confirmation page,
// wherever the full order needs to be shown strictly for reference.
export default function OrderDetailsReadOnly({ order }: { order: OrderRecord }) {
  const product = getProduct(order.product);

  return (
    <>
      <Section title="ACCOUNT DETAILS">
        <ReadRow label="Client Name" value={order.client} />
        <ReadRow label="Client Manager" value={order.clientManager} />
        <ReadRow label="Billing Address" value={order.details.billingAddress} />
        <ReadRow label="Billing State" value={order.details.billingState} />
        <ReadRow label="Billing City" value={order.details.billingCity} />
        <ReadRow label="Delivery Address" value={order.details.deliveryAddress} />
        <ReadRow label="Delivery State" value={order.details.deliveryState} />
        <ReadRow label="Delivery City" value={order.details.deliveryCity} />
        <ReadRow label="Customer GST No." value={order.details.gstNo || "NA"} />
      </Section>

      <Section title="CONTACT DETAILS">
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">SPOC Name</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">SPOC Email</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">SPOC Mobile</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {order.details.spocs.map((s, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-slate-700">{s.name || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{s.email || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{s.mobile || "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{s.remarks || "—"}</td>
                </tr>
              ))}
              {order.details.spocs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                    No SPOCs on record.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="ORDER DETAILS">
        <ReadRow label="Product" value={order.product} />
        <ReadRow label="Date Of Sign" value={formatDDMMYYYY(order.dateOfSign)} />
        <ReadRow label="Plan" value={order.details.plan} />
        <ReadRow label="One Time (₹)" value={order.details.oneTime != null ? String(order.details.oneTime) : ""} />
        <ReadRow label="GST Process" value={order.details.gstProcess} />
        <ReadRow label="Select GST" value={order.details.selectGst} />
        {product?.fields(order.details as unknown as Record<string, string>).map((field) => (
          <ReadRow
            key={field.key}
            label={field.label}
            value={String(order.details[field.key as keyof typeof order.details] ?? "")}
          />
        ))}
        <ReadRow label="First Billing Month" value={order.details.firstBillingMonth} />
        <ReadRow label="Billing Cycle" value={order.billingCycle} />
        <ReadRow label="Agreement" value={order.details.agreement != null ? `${order.details.agreement} months` : ""} />
      </Section>

      <Section title="PAYMENT DETAILS">
        <ReadRow label="Advance (₹)" value={order.details.advance != null ? String(order.details.advance) : ""} />
        <ReadRow label="TDS (₹)" value={order.details.tds != null ? String(order.details.tds) : ""} />
        <ReadRow label="Net Amount (₹)" value={order.details.netAmount.toLocaleString("en-IN")} />
        <ReadRow
          label="Credit Period"
          value={order.details.creditPeriod != null ? `${order.details.creditPeriod} days` : ""}
        />
      </Section>

      <Section title="DOCUMENT DETAILS">
        {order.details.documents.length === 0 ? (
          <p className="text-sm text-slate-400">No documents attached.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-700">
            {order.details.documents.map((d, i) => (
              <li key={i}>
                {d.name || "(unnamed)"} — {d.fileName || "no file"}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {order.cancellationDetails && (
        <Section title="CLOSURE DETAILS">
          <ReadRow label="Effect From Date" value={formatDDMMYYYY(order.cancellationDetails.effectFromDate)} />
          <ReadRow
            label="Outstanding Balance (₹)"
            value={order.cancellationDetails.outstandingBalance.toLocaleString("en-IN")}
          />
          <ReadRow label="Reason for Cancellation" value={order.cancellationDetails.reason} />
          <ReadRow label="Comments" value={order.cancellationDetails.comments} />
        </Section>
      )}
    </>
  );
}
