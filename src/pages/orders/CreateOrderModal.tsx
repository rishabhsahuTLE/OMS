import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/Modal";
import ConfirmDialog from "../../components/ConfirmDialog";
import type { BillingCycle, Client, OrderRecord, OrderRecordDetails, Spoc } from "../../types";
import { getProduct, PRODUCT_NAMES } from "../../products";
import type { ProductFormValues } from "../../products";
import { nextOrderNumber, todayISO } from "../../utils";

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  orders: OrderRecord[];
  editingOrder?: OrderRecord | null;
  prefillClientId?: string;
  prefillProduct?: string;
  onCreate: (record: OrderRecord) => void;
  onUpdate: (record: OrderRecord) => void;
  // Renders the form directly on a page instead of inside a Modal overlay.
  // Embedded instances have no "close" to return to, so Cancel becomes
  // Reset — the parent bumps a `key` to remount and clear the form.
  embedded?: boolean;
  onReset?: () => void;
  // University clients only ever get one order per product — when a match
  // already exists, we ask whether to amend that one instead of creating a
  // duplicate. "Yes" hands the existing order back up through this callback.
  onRequestAmend?: (order: OrderRecord) => void;
}

const PLANS = ["Prepaid", "Postpaid"];
const GST_PROCESSES = ["Included in Order Amount", "Excluded from Order Amount"];
const BILLING_CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "M", label: "Monthly" },
  { value: "B", label: "Bi-monthly" },
  { value: "Q", label: "Quarterly" },
  { value: "H", label: "Half-yearly" },
  { value: "Y", label: "Yearly" },
  { value: "O", label: "One-time" },
];

const emptySpoc: Spoc = { name: "", email: "", mobile: "", remarks: "" };

// Amending an already-active order only ever gets to touch this set of
// fields (see handleModalUpdate/OrderPage.tsx) — everything else on the
// form is shown for reference but locked. Doesn't apply to editing a
// not-yet-active order (e.g. completing an incomplete/duplicate-handoff
// order), which is still freely editable like a fresh Create.
const AMENDMENT_EDITABLE_PRODUCT_FIELDS = new Set(["numUsers", "feePerUser", "unitPrice"]);

// The form is split into these wizard pages, one per section the form
// already grouped fields into. Order here doubles as the Back/Next order.
type PageKey = "client" | "contact" | "order" | "payment" | "documents" | "remarks";

function BriefcaseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 4a2 2 0 012-2h2a2 2 0 012 2v1h2a2 2 0 012 2v2H3V7a2 2 0 012-2h2V4zm2 0v1h2V4H9zM3 10h14v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3.5 2.5c.5-.5 1.3-.5 1.8 0l1.7 1.7c.4.4.5 1 .2 1.5l-.8 1.4a11 11 0 004.5 4.5l1.4-.8c.5-.3 1.1-.2 1.5.2l1.7 1.7c.5.5.5 1.3 0 1.8l-1.1 1.1c-.6.6-1.5.9-2.3.6-3-.9-5.8-2.6-8-4.9-2.3-2.2-4-5-4.9-8-.3-.8 0-1.7.6-2.3L3.5 2.5z" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4 2a1 1 0 00-1 1v14a1 1 0 001.45.9L6 17l1.55.9a1 1 0 001 0L10 17l1.55.9a1 1 0 001 0L14 17l1.55.9A1 1 0 0017 17V3a1 1 0 00-1-1H4zm2 4h8v1.5H6V6zm0 3h8v1.5H6V9zm0 3h5v1.5H6V12z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm2 1v1h12V6H4zm0 3v5h12V9H4z" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8 4a3 3 0 016 0v7a5 5 0 01-10 0V6a1 1 0 112 0v5a3 3 0 006 0V4a1 1 0 10-2 0v6a1 1 0 11-2 0V4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M18 10c0 3.866-3.582 7-8 7a9 9 0 01-2.5-.35c-.5.4-1.7 1.1-3.2 1.3a.3.3 0 01-.3-.45c.4-.6.7-1.4.8-2.2A6.86 6.86 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a3 3 0 00-3 3v2H6a2 2 0 00-2 2v7a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a3 3 0 00-3-3zm-1 5V5a1 1 0 112 0v2H9z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 3a1 1 0 01.7.29l3 3a1 1 0 01-1.4 1.42L11 6.41V13a1 1 0 11-2 0V6.41L7.7 7.71a1 1 0 01-1.4-1.42l3-3A1 1 0 0110 3zM4 14a1 1 0 011 1v1h10v-1a1 1 0 112 0v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1 1 0 011-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="h-5 w-5 text-teal-600" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2.5 3a.5.5 0 000 1h1.04l1.7 8.02A2 2 0 007.2 13.5h6.1a2 2 0 001.96-1.6l1.05-5.4a.5.5 0 00-.49-.6H5.02l-.3-1.42A1.5 1.5 0 003.26 3H2.5zM7 17a1.25 1.25 0 100-2.5A1.25 1.25 0 007 17zm7 0a1.25 1.25 0 100-2.5 1.25 1.25 0 000 2.5z" />
    </svg>
  );
}

const PAGES: { key: PageKey; label: string; icon: React.ReactNode }[] = [
  { key: "client", label: "Client Details", icon: <BriefcaseIcon /> },
  { key: "contact", label: "Contact Details", icon: <PhoneIcon /> },
  { key: "order", label: "Order Details", icon: <ReceiptIcon /> },
  { key: "payment", label: "Payment Details", icon: <CardIcon /> },
  { key: "documents", label: "Documents", icon: <PaperclipIcon /> },
  { key: "remarks", label: "Remarks", icon: <ChatIcon /> },
];
const PAGE_ORDER: PageKey[] = PAGES.map((p) => p.key);

// Free-jump stepper: click any stage to go straight to it. A page is
// "complete" (check badge) once its own required fields are filled; during
// an amendment of an already-active order, a page that's entirely
// non-editable (see AMENDMENT_EDITABLE_PRODUCT_FIELDS/isAmendingActiveOrder)
// gets a lock badge instead — Client Details/Order Details/Payment Details
// keep at least one editable field during an amendment, so they never lock.
function OrderFormStepper({
  activePage,
  onSelect,
  isComplete,
  isLocked,
  isDisabled,
}: {
  activePage: PageKey;
  onSelect: (key: PageKey) => void;
  isComplete: (key: PageKey) => boolean;
  isLocked: (key: PageKey) => boolean;
  isDisabled: (key: PageKey) => boolean;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center">
        {PAGES.map((p, i) => {
          const current = p.key === activePage;
          const complete = isComplete(p.key) && !current;
          const locked = isLocked(p.key);
          const disabled = isDisabled(p.key);
          const circleClass = current
            ? "border-teal-600 bg-teal-600 text-white"
            : complete
            ? "border-emerald-400 bg-emerald-50 text-emerald-600"
            : "border-slate-300 bg-white text-slate-400";
          return (
            <div key={p.key} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => !disabled && onSelect(p.key)}
                disabled={disabled}
                title={locked ? `${p.label} — locked for amendments, shown for reference only` : p.label}
                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${circleClass} ${
                  disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                }`}
              >
                {p.icon}
                {complete && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                    <CheckIcon />
                  </span>
                )}
                {locked && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-white ring-2 ring-white">
                    <LockIcon />
                  </span>
                )}
              </button>
              {i < PAGES.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 ${complete ? "bg-emerald-400" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex">
        {PAGES.map((p) => (
          <div
            key={p.key}
            className={`flex-1 px-1 text-center text-[11px] font-medium leading-tight last:flex-none last:w-9 ${
              p.key === activePage ? "text-teal-700" : "text-slate-500"
            }`}
          >
            {p.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Required() {
  return <span className="text-rose-500">*</span>;
}

const readonlyInputClass =
  "w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600";
const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400";

function FieldRow({
  label,
  required,
  children,
  align = "center",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div className={`grid grid-cols-[200px_1fr] gap-x-4 ${align === "start" ? "items-start" : "items-center"}`}>
      <label className={`text-right text-sm font-medium text-slate-700 ${align === "start" ? "pt-2" : ""}`}>
        {label}
        {required && <Required />}
      </label>
      <div className="max-w-lg">{children}</div>
    </div>
  );
}

function YesNoRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: "Yes" | "No" | "";
  onChange: (v: "Yes" | "No") => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[280px_1fr] items-center gap-x-4">
      <label className="text-right text-sm font-medium text-slate-700">
        {label}
        <Required />
      </label>
      <div className="flex gap-8">
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="radio" checked={value === "Yes"} onChange={() => onChange("Yes")} disabled={disabled} />
          Yes
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="radio" checked={value === "No"} onChange={() => onChange("No")} disabled={disabled} />
          No
        </label>
      </div>
    </div>
  );
}

interface FormState {
  dateOfSign: string;
  plan: string;
  oneTime: string;
  gstProcess: string;
  firstBillingMonth: string;
  billingCycle: BillingCycle | "";
  agreement: string;
  advance: string;
  tds: string;
  creditPeriod: string;
  remarks: string;
}

const emptyForm: FormState = {
  dateOfSign: "",
  plan: "",
  oneTime: "",
  gstProcess: "",
  firstBillingMonth: "",
  billingCycle: "",
  agreement: "",
  advance: "",
  tds: "",
  creditPeriod: "",
  remarks: "",
};

function toNumber(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toFieldString(v: number | string | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

export default function CreateOrderModal({
  open,
  onClose,
  clients,
  orders,
  editingOrder,
  prefillClientId,
  prefillProduct,
  onCreate,
  onUpdate,
  embedded,
  onReset,
  onRequestAmend,
}: CreateOrderModalProps) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [spocs, setSpocs] = useState<Spoc[]>([]);
  const [documents, setDocuments] = useState<{ name: string; fileName: string }[]>([]);
  const [productValues, setProductValues] = useState<ProductFormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateOrder, setDuplicateOrder] = useState<OrderRecord | null>(null);
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);
  const [activePage, setActivePage] = useState<PageKey>("client");

  const isEditing = editingOrder != null;
  // A true amendment (editing an already-*active* order) locks the form down
  // to just Product/Users/Rate/Payment Terms/Billing Month/Agreement/Advance —
  // editing an order that hasn't activated yet (e.g. completing an
  // incomplete/duplicate-handoff order) stays fully editable, same as Create.
  const isAmendingActiveOrder = editingOrder != null && editingOrder.lifecycleStatus === "active";
  // If the amender actually switches the product, there's no prior value to
  // preserve for that product's fields, so unlock the whole product section
  // rather than locking it to a permanently-blank, unsavable state.
  const productChanged = editingOrder != null && editingOrder.product !== selectedProduct;
  const productFieldsLocked = isAmendingActiveOrder && !productChanged;
  const client = clients.find((c) => c.id === selectedClientId) ?? null;
  const currentProduct = useMemo(() => (selectedProduct ? getProduct(selectedProduct) ?? null : null), [
    selectedProduct,
  ]);

  const nextOrderNo = useMemo(() => {
    if (editingOrder) return editingOrder.orderNo;
    if (!selectedClientId) return "";
    return nextOrderNumber(orders, selectedClientId);
  }, [editingOrder, selectedClientId, orders]);

  // Universities only ever get one order per product — if one already
  // exists for this client+product pick, offer to amend it instead of
  // silently letting a duplicate get created.
  useEffect(() => {
    if (editingOrder || !client || !selectedProduct || client.type !== "University") {
      setDuplicateOrder(null);
      return;
    }
    const existing = orders.find((o) => o.clientId === client.id && o.product === selectedProduct) ?? null;
    setDuplicateOrder(existing);
    setDuplicateDismissed(false);
  }, [client, selectedProduct, editingOrder, orders]);

  // Re-sync the form whenever the modal opens — blank for a new order (with
  // an optional client/product prefill), prefilled from editingOrder when
  // editing an existing one.
  useEffect(() => {
    if (!open) return;
    if (editingOrder) {
      setSelectedClientId(editingOrder.clientId);
      setSelectedProduct(editingOrder.product);
      setForm({
        dateOfSign: editingOrder.dateOfSign,
        plan: editingOrder.details.plan,
        oneTime: toFieldString(editingOrder.details.oneTime),
        gstProcess: editingOrder.details.gstProcess,
        firstBillingMonth: editingOrder.details.firstBillingMonth,
        billingCycle: editingOrder.billingCycle,
        agreement: toFieldString(editingOrder.details.agreement),
        advance: toFieldString(editingOrder.details.advance),
        tds: toFieldString(editingOrder.details.tds),
        creditPeriod: toFieldString(editingOrder.details.creditPeriod),
        remarks: editingOrder.details.remarks,
      });
      setSpocs(editingOrder.details.spocs);
      setDocuments(editingOrder.details.documents);
    } else {
      setSelectedClientId(prefillClientId ?? "");
      setSelectedProduct(prefillProduct ?? "");
      setForm(emptyForm);
      setSpocs([]);
      setDocuments([]);
    }
    setErrors({});
    setActivePage("client");
  }, [open, editingOrder, prefillClientId, prefillProduct]);

  // Whenever the chosen product changes, reset its product-specific fields —
  // prefilled from editingOrder if it's the order's original product, blank
  // otherwise (e.g. the user picked a different product for a new order).
  useEffect(() => {
    if (!open || !currentProduct) {
      setProductValues({});
      return;
    }
    if (editingOrder && editingOrder.product === currentProduct.name) {
      const values: ProductFormValues = {};
      for (const field of currentProduct.fields({})) {
        values[field.key] = toFieldString(
          editingOrder.details[field.key as keyof OrderRecordDetails] as string | number | null | undefined
        );
      }
      setProductValues(values);
    } else {
      setProductValues(currentProduct.emptyValues());
    }
  }, [open, currentProduct, editingOrder]);

  // Reset SPOCs when the client changes on a new (non-editing) order, so a
  // previously-picked client's contacts don't linger after switching clients.
  useEffect(() => {
    if (!open || editingOrder) return;
    setSpocs([]);
  }, [selectedClientId, open, editingOrder]);

  const effectiveSpocs = spocs.length > 0 ? spocs : client?.spocs.length ? [client.spocs[0]] : [{ ...emptySpoc }];

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateProductValue(key: string, value: string) {
    setProductValues((prev) => ({ ...prev, [key]: value }));
  }

  function updateSpoc(index: number, key: keyof Spoc, value: string) {
    const base = spocs.length > 0 ? spocs : effectiveSpocs;
    setSpocs(base.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  }

  function selectSpoc() {
    const base = spocs.length > 0 ? spocs : effectiveSpocs;
    setSpocs([...base, { ...emptySpoc }]);
  }

  function removeSpoc(index: number) {
    const base = spocs.length > 0 ? spocs : effectiveSpocs;
    setSpocs(base.filter((_, i) => i !== index));
  }

  function addDocument() {
    setDocuments((prev) => [...prev, { name: "", fileName: "" }]);
  }

  function updateDocument(index: number, key: "name" | "fileName", value: string) {
    setDocuments((prev) => prev.map((d, i) => (i === index ? { ...d, [key]: value } : d)));
  }

  function removeDocument(index: number) {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  }

  const netAmount = useMemo(() => {
    const oneTime = toNumber(form.oneTime) ?? 0;
    const advance = toNumber(form.advance) ?? 0;
    const tds = toNumber(form.tds) ?? 0;
    const base = oneTime + (currentProduct?.productAmount(productValues) ?? 0);
    return Math.max(0, base - advance - tds);
  }, [form.oneTime, form.advance, form.tds, productValues, currentProduct]);

  function handleCancel() {
    if (embedded) {
      onReset?.();
      return;
    }
    onClose();
  }

  // A pending duplicate blocks the rest of the form outright — dismissing
  // the popup (Cancel / click-outside) just hides the dialog, it doesn't
  // make the fields below appear. The only ways forward are amending the
  // existing order or picking a different client/product.
  const ready = client !== null && currentProduct !== null && duplicateOrder === null;

  // Powers the stepper's check badges — same fields the "Required" stars
  // already call out, not new validation rules.
  function isPageComplete(page: PageKey): boolean {
    switch (page) {
      case "client":
        return ready;
      case "contact": {
        const first = effectiveSpocs[0];
        return !!first?.name.trim() && !!first?.mobile.trim();
      }
      case "order":
        return (
          !!currentProduct &&
          !!form.dateOfSign &&
          !!form.plan &&
          !!form.firstBillingMonth &&
          !!form.billingCycle &&
          !!form.agreement &&
          Object.keys(currentProduct.validate(productValues)).length === 0
        );
      case "payment":
        return true;
      case "documents":
        return documents.length === 0 || documents.every((d) => d.name.trim() && d.fileName.trim());
      case "remarks":
        return true;
    }
  }

  // Only pages that are entirely non-editable during an amendment get the
  // lock badge — Client/Order/Payment Details each keep at least one
  // still-editable field (see AMENDMENT_EDITABLE_PRODUCT_FIELDS), so a lock
  // badge there would overstate the restriction; the amber banner already
  // spells out exactly what stays editable on those.
  function isPageLocked(page: PageKey): boolean {
    if (!isAmendingActiveOrder) return false;
    return page === "contact" || page === "documents" || page === "remarks";
  }

  function isPageNavDisabled(page: PageKey): boolean {
    return page !== "client" && !ready;
  }

  function pageForErrors(errs: Record<string, string>): PageKey {
    if (errs.spocName || errs.spocMobile) return "contact";
    return "order";
  }

  const pageIndex = PAGE_ORDER.indexOf(activePage);
  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex === PAGE_ORDER.length - 1;

  function goPrev() {
    if (!isFirstPage) setActivePage(PAGE_ORDER[pageIndex - 1]);
  }

  function goNext() {
    if (!isLastPage) setActivePage(PAGE_ORDER[pageIndex + 1]);
  }

  function handleSave() {
    if (!client || !currentProduct) return;
    const nextErrors: Record<string, string> = {};
    if (!form.dateOfSign) nextErrors.dateOfSign = "Date of sign is required";
    if (!form.plan) nextErrors.plan = "Plan is required";
    Object.assign(nextErrors, currentProduct.validate(productValues));
    const firstSpoc = effectiveSpocs[0];
    if (!firstSpoc?.name.trim()) nextErrors.spocName = "SPOC name is required";
    if (!firstSpoc?.mobile.trim()) nextErrors.spocMobile = "SPOC mobile is required";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setActivePage(pageForErrors(nextErrors));
      return;
    }

    const productDetails: Partial<OrderRecordDetails> = {};
    for (const field of currentProduct.fields(productValues)) {
      const raw = productValues[field.key] ?? "";
      (productDetails as Record<string, unknown>)[field.key] = field.type === "number" ? toNumber(raw) : raw;
    }

    const details: OrderRecordDetails = {
      clientManager: client.clientManager,
      billingAddress: client.billingAddress,
      billingState: client.billingState,
      billingCity: client.billingCity,
      deliveryAddress: client.deliveryAddress,
      deliveryState: client.deliveryState,
      deliveryCity: client.deliveryCity,
      gstNo: client.gstNo,
      spocs: effectiveSpocs,
      product: selectedProduct,
      dateOfSign: form.dateOfSign,
      plan: form.plan,
      oneTime: toNumber(form.oneTime),
      gstProcess: form.gstProcess,
      selectGst: client.gstNo || "NA",
      ...productDetails,
      firstBillingMonth: form.firstBillingMonth,
      billingCycle: form.billingCycle,
      agreement: toNumber(form.agreement),
      advance: toNumber(form.advance),
      tds: toNumber(form.tds),
      netAmount,
      creditPeriod: toNumber(form.creditPeriod),
      documents,
      remarks: form.remarks,
    };

    if (editingOrder) {
      onUpdate({
        ...editingOrder,
        clientManager: client.clientManager,
        dateOfSign: form.dateOfSign,
        billingCycle: form.billingCycle,
        amount: netAmount,
        incomplete: false,
        details,
      });
    } else {
      onCreate({
        id: `ord-${Math.random().toString(36).slice(2, 10)}`,
        orderNo: nextOrderNo,
        product: selectedProduct,
        clientId: client.id,
        client: client.name,
        clientManager: client.clientManager,
        dateOfSign: form.dateOfSign,
        createdOn: todayISO(),
        amount: netAmount,
        technical: { status: "pending", date: null },
        financial: { status: "pending", date: null },
        lifecycleStatus: "inactive",
        cancellationTechnical: { status: "pending", date: null },
        cancellationFinancial: { status: "pending", date: null },
        billingCycle: form.billingCycle,
        amended: false,
        details,
      });
    }

    if (embedded) {
      onReset?.();
    } else {
      onClose();
    }
  }

  const sameAsBilling =
    !!client &&
    client.deliveryAddress === client.billingAddress &&
    client.deliveryState === client.billingState &&
    client.deliveryCity === client.billingCity;

  const content = (
    <>
      <ConfirmDialog
        open={duplicateOrder !== null && !duplicateDismissed}
        title="Order Already Exists"
        message={`${client?.name ?? "This university"} already has an order (${duplicateOrder?.orderNo}) for ${selectedProduct}. Do you want to amend it instead?`}
        confirmLabel="Yes, amend it"
        onConfirm={() => {
          if (duplicateOrder) onRequestAmend?.(duplicateOrder);
          setDuplicateDismissed(true);
        }}
        onCancel={() => setDuplicateDismissed(true)}
      />
      <div className={embedded ? "" : "max-h-[85vh] overflow-y-auto"}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <CartIcon />
          <h2 className="text-sm font-semibold tracking-wide text-slate-700">
            {editingOrder ? (isAmendingActiveOrder ? "AMEND ORDER" : "EDIT ORDER") : "CREATE ORDER"}
          </h2>
        </div>

        <OrderFormStepper
          activePage={activePage}
          onSelect={(key) => {
            if (!isPageNavDisabled(key)) setActivePage(key);
          }}
          isComplete={isPageComplete}
          isLocked={isPageLocked}
          isDisabled={isPageNavDisabled}
        />

        {ready && isAmendingActiveOrder && (
          <p className="mx-6 mb-2 rounded-md bg-amber-50 px-4 py-3 text-xs text-amber-700">
            This order is active — an amendment can only change Product, No. of Users, Rate, Payment Terms (Plan),
            First Billing Month, Agreement, and Advance. Everything else is shown for reference only.
          </p>
        )}

        {activePage === "client" && (
          <>
            <div className="space-y-4 border-t border-slate-200 px-6 py-6">
              <FieldRow label="Select Client" required>
                <select
                  className={inputClass}
                  value={selectedClientId}
                  disabled={isEditing}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">--Select Client--</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FieldRow>

              <FieldRow label="Select Product" required>
                <select
                  className={inputClass}
                  value={selectedProduct}
                  disabled={isEditing && !isAmendingActiveOrder}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                >
                  <option value="">--Select Product--</option>
                  {PRODUCT_NAMES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>

            {!ready && (
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-8">
                <p className="text-sm text-slate-400">
                  {duplicateOrder
                    ? `${client?.name ?? "This client"} already has an order (${duplicateOrder.orderNo}) for ${selectedProduct} — amend that one, or pick a different client/product.`
                    : "Select a client and product to continue."}
                </p>
                {!embedded && (
                  <button
                    onClick={handleCancel}
                    className="rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}

            {ready && client && currentProduct && (
              <>
                <div className="flex items-center gap-2 border-y border-slate-200 px-6 py-4">
                  <svg className="h-5 w-5 text-teal-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a3 3 0 00-3 3v2H6a2 2 0 00-2 2v7a2 2 0 002 2h8a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a3 3 0 00-3-3zm-1 5V5a1 1 0 112 0v2H9z" />
                  </svg>
                  <h2 className="text-sm font-semibold tracking-wide text-slate-700">CLIENT DETAILS</h2>
                </div>

                <div className="space-y-4 px-6 py-6">
                  <FieldRow label="Client Name" required>
                    <input className={readonlyInputClass} value={client.name} disabled />
                  </FieldRow>

                  <FieldRow label="Client Manager" required>
                    <input className={readonlyInputClass} value={client.clientManager} disabled />
                  </FieldRow>

                  <FieldRow label="Billing Address" required align="start">
                    <textarea
                      className={`${readonlyInputClass} min-h-[70px] resize-y`}
                      value={client.billingAddress}
                      disabled
                    />
                  </FieldRow>

                  <FieldRow label="Billing State" required>
                    <input className={readonlyInputClass} value={client.billingState} disabled />
                  </FieldRow>

                  <FieldRow label="Billing City">
                    <input className={readonlyInputClass} value={client.billingCity} disabled />
                  </FieldRow>

                  <FieldRow label="Delivery Address" required align="start">
                    <label className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <input type="checkbox" checked={sameAsBilling} disabled />
                      Same as Billing Address
                    </label>
                    <textarea
                      className={`${readonlyInputClass} min-h-[70px] resize-y`}
                      value={client.deliveryAddress}
                      disabled
                    />
                  </FieldRow>

                  <FieldRow label="Delivery State" required>
                    <input className={readonlyInputClass} value={client.deliveryState} disabled />
                  </FieldRow>

                  <FieldRow label="Delivery City">
                    <input className={readonlyInputClass} value={client.deliveryCity} disabled />
                  </FieldRow>

                  <FieldRow label="Customer GST No.">
                    <input className={readonlyInputClass} value={client.gstNo || "NA"} disabled />
                  </FieldRow>
                </div>
              </>
            )}
          </>
        )}

        {ready && client && currentProduct && activePage === "contact" && (
          <>
            <div className="flex items-center gap-2 border-y border-slate-200 px-6 py-3">
              <PhoneIcon />
              <h3 className="text-sm font-semibold tracking-wide text-slate-700">CONTACT DETAILS</h3>
            </div>

            <div className="px-6 py-4">
              {!isAmendingActiveOrder && (
                <button
                  onClick={selectSpoc}
                  className="mb-3 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                  </svg>
                  Add Spoc
                </button>
              )}

              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">
                        SPOC Name<Required />
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">SPOC Email</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">
                        SPOC Mobile<Required />
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Remarks</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {effectiveSpocs.map((s, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <input
                            list="spoc-suggestions"
                            className="w-full border-none p-0 text-sm focus:outline-none focus:ring-0"
                            value={s.name}
                            disabled={isAmendingActiveOrder}
                            onChange={(e) => updateSpoc(i, "name", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full border-none p-0 text-sm focus:outline-none focus:ring-0"
                            value={s.email}
                            disabled={isAmendingActiveOrder}
                            onChange={(e) => updateSpoc(i, "email", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full border-none p-0 text-sm focus:outline-none focus:ring-0"
                            value={s.mobile}
                            disabled={isAmendingActiveOrder}
                            onChange={(e) => updateSpoc(i, "mobile", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full border-none p-0 text-sm focus:outline-none focus:ring-0"
                            value={s.remarks}
                            disabled={isAmendingActiveOrder}
                            onChange={(e) => updateSpoc(i, "remarks", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          {!isAmendingActiveOrder && effectiveSpocs.length > 1 && (
                            <button onClick={() => removeSpoc(i)} className="text-slate-400 hover:text-rose-500">
                              ✕
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <datalist id="spoc-suggestions">
                {client.spocs.map((s) => (
                  <option key={s.name} value={s.name} />
                ))}
              </datalist>
              {(errors.spocName || errors.spocMobile) && (
                <p className="mt-1 text-xs text-rose-500">{errors.spocName || errors.spocMobile}</p>
              )}
            </div>
          </>
        )}

        {ready && client && currentProduct && activePage === "order" && (
          <>
            <div className="flex items-center gap-2 border-y border-slate-200 px-6 py-3">
              <ReceiptIcon />
              <h3 className="text-sm font-semibold tracking-wide text-slate-700">ORDER DETAILS</h3>
            </div>

            <div className="space-y-4 px-6 py-6">
              <FieldRow label="Product" required>
                <input className={readonlyInputClass} value={selectedProduct} disabled />
              </FieldRow>

              <FieldRow label="Date Of Sign" required>
                <input
                  type="date"
                  className={inputClass}
                  value={form.dateOfSign}
                  disabled={isAmendingActiveOrder}
                  onChange={(e) => update("dateOfSign", e.target.value)}
                />
                {errors.dateOfSign && <p className="mt-1 text-xs text-rose-500">{errors.dateOfSign}</p>}
              </FieldRow>

              <FieldRow label="Plan" required>
                <select className={inputClass} value={form.plan} onChange={(e) => update("plan", e.target.value)}>
                  <option value="">--Select Plan--</option>
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {errors.plan && <p className="mt-1 text-xs text-rose-500">{errors.plan}</p>}
              </FieldRow>

              <FieldRow label="One Time (₹)">
                <input
                  type="number"
                  className={inputClass}
                  value={form.oneTime}
                  disabled={isAmendingActiveOrder}
                  onChange={(e) => update("oneTime", e.target.value)}
                />
              </FieldRow>

              <FieldRow label="GST Process">
                <select
                  className={inputClass}
                  value={form.gstProcess}
                  disabled={isAmendingActiveOrder}
                  onChange={(e) => update("gstProcess", e.target.value)}
                >
                  <option value="">--Select Process--</option>
                  {GST_PROCESSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FieldRow>

              <FieldRow label="Select GST" required>
                <input className={readonlyInputClass} value={client.gstNo || "NA"} disabled />
              </FieldRow>

              {currentProduct.fields(productValues).map((field) => {
                const value = productValues[field.key] ?? "";
                const error = errors[field.key];
                const fieldDisabled = productFieldsLocked && !AMENDMENT_EDITABLE_PRODUCT_FIELDS.has(field.key);

                if (field.type === "yesno") {
                  return (
                    <YesNoRow
                      key={field.key}
                      label={field.label}
                      value={value as "Yes" | "No" | ""}
                      onChange={(v) => updateProductValue(field.key, v)}
                      disabled={fieldDisabled}
                    />
                  );
                }

                return (
                  <FieldRow key={field.key} label={field.label} required={field.required}>
                    {field.type === "select" ? (
                      <select
                        className={inputClass}
                        value={value}
                        disabled={fieldDisabled}
                        onChange={(e) => updateProductValue(field.key, e.target.value)}
                      >
                        <option value="">{`--Select ${field.label}--`}</option>
                        {field.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : field.type === "month" ? "month" : "text"}
                        className={inputClass}
                        value={value}
                        disabled={fieldDisabled}
                        onChange={(e) => updateProductValue(field.key, e.target.value)}
                      />
                    )}
                    {field.hint && <p className="mt-1 text-xs text-slate-400">{field.hint}</p>}
                    {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
                  </FieldRow>
                );
              })}

              <FieldRow label="First Billing Month" required>
                <input
                  type="month"
                  className={inputClass}
                  value={form.firstBillingMonth}
                  onChange={(e) => update("firstBillingMonth", e.target.value)}
                />
              </FieldRow>

              <FieldRow label="Billing Cycle" required>
                <select
                  className={inputClass}
                  value={form.billingCycle}
                  disabled={isAmendingActiveOrder}
                  onChange={(e) => update("billingCycle", e.target.value as BillingCycle)}
                >
                  <option value="">--Select Cycle--</option>
                  {BILLING_CYCLES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </FieldRow>

              <FieldRow label="Agreement" required>
                <input
                  type="number"
                  className={inputClass}
                  value={form.agreement}
                  onChange={(e) => update("agreement", e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400">(in months)</p>
              </FieldRow>
            </div>
          </>
        )}

        {ready && client && currentProduct && activePage === "payment" && (
          <>
            <div className="flex items-center gap-2 border-y border-slate-200 px-6 py-3">
              <CardIcon />
              <h3 className="text-sm font-semibold tracking-wide text-slate-700">PAYMENT DETAILS</h3>
            </div>

            <div className="space-y-4 px-6 py-6">
              <FieldRow label="Advance (₹)">
                <input
                  type="number"
                  className={inputClass}
                  value={form.advance}
                  onChange={(e) => update("advance", e.target.value)}
                />
              </FieldRow>
              <FieldRow label="TDS (₹)">
                <input
                  type="number"
                  className={inputClass}
                  value={form.tds}
                  disabled={isAmendingActiveOrder}
                  onChange={(e) => update("tds", e.target.value)}
                />
              </FieldRow>
              <FieldRow label="Net Amt.(₹)">
                <input className={readonlyInputClass} value={netAmount.toLocaleString("en-IN")} disabled />
              </FieldRow>
              <FieldRow label="Credit Period">
                <input
                  type="number"
                  className={inputClass}
                  value={form.creditPeriod}
                  disabled={isAmendingActiveOrder}
                  onChange={(e) => update("creditPeriod", e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400">(in days)</p>
              </FieldRow>
            </div>
          </>
        )}

        {ready && client && currentProduct && activePage === "documents" && (
          <>
            <div className="flex items-center gap-2 border-y border-slate-200 px-6 py-3">
              <PaperclipIcon />
              <h3 className="text-sm font-semibold tracking-wide text-slate-700">
                DOCUMENTS <span className="ml-1 text-xs font-normal text-slate-400">(Max Size 8 MB)</span>
              </h3>
            </div>

            <div className="px-6 py-4">
              {!isAmendingActiveOrder && (
                <button
                  onClick={addDocument}
                  className="mb-3 flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                  </svg>
                  Add Document
                </button>
              )}

              {documents.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          Document Name<Required />
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600">
                          File<Required />
                        </th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {documents.map((d, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">
                            <input
                              className={inputClass}
                              placeholder="e.g. Signed Agreement"
                              value={d.name}
                              disabled={isAmendingActiveOrder}
                              onChange={(e) => updateDocument(i, "name", e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <label
                              className={`flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs font-medium transition-colors ${
                                isAmendingActiveOrder
                                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                  : "cursor-pointer border-slate-300 bg-slate-50 text-slate-600 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"
                              }`}
                            >
                              <UploadIcon />
                              <span className="truncate">{d.fileName || "Choose File"}</span>
                              <input
                                type="file"
                                className="hidden"
                                disabled={isAmendingActiveOrder}
                                onChange={(e) => updateDocument(i, "fileName", e.target.files?.[0]?.name ?? "")}
                              />
                            </label>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {!isAmendingActiveOrder && (
                              <button onClick={() => removeDocument(i)} className="text-slate-400 hover:text-rose-500">
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {ready && client && currentProduct && activePage === "remarks" && (
          <>
            <div className="flex items-center gap-2 border-y border-slate-200 px-6 py-3">
              <ChatIcon />
              <h3 className="text-sm font-semibold tracking-wide text-slate-700">REMARKS</h3>
            </div>

            <div className="px-6 py-4">
              <label className="mb-1 block text-sm text-slate-600">Remarks</label>
              <textarea
                className={`${inputClass} min-h-[80px] resize-y`}
                placeholder="Enter remark.."
                value={form.remarks}
                disabled={isAmendingActiveOrder}
                onChange={(e) => update("remarks", e.target.value)}
              />
            </div>
          </>
        )}

        {ready && client && currentProduct && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
            <button
              onClick={handleCancel}
              className="rounded-md bg-slate-200 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
            >
              {embedded ? "Reset" : "Cancel"}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={goPrev}
                disabled={isFirstPage}
                className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>
              {isLastPage ? (
                <button
                  onClick={handleSave}
                  className="rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  {editingOrder ? "Update" : "Save"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div className="rounded-lg border border-slate-200 bg-white shadow-sm">{content}</div>;
  }

  return (
    <Modal open={open} onClose={handleCancel} widthClassName="max-w-4xl">
      {content}
    </Modal>
  );
}
