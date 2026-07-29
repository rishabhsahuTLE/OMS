import type { OrderRecordDetails } from "./types";

export type ProductFieldType = "text" | "number" | "month" | "select" | "yesno";

export interface ProductFieldOption {
  value: string;
  label: string;
}

export interface ProductField {
  key: keyof OrderRecordDetails;
  label: string;
  type: ProductFieldType;
  required?: boolean;
  options?: ProductFieldOption[];
  hint?: string;
}

// Raw string values keyed by ProductField.key, as entered in the order form.
export type ProductFormValues = Record<string, string>;

function toNumber(v: string | undefined): number {
  const n = Number(v);
  return !v || v.trim() === "" || Number.isNaN(n) ? 0 : n;
}

// A Product encapsulates everything that differs between order types: the
// extra form fields to collect, how those fields feed into the order amount,
// and what to fill in for demo/mock orders. Add a new product by adding one
// class below and listing it in PRODUCTS — no other file needs to change.
export abstract class Product {
  abstract readonly name: string;

  // A method (not a static list) because Quirio's field order/required-ness
  // depends on the current form values (see QuirioProduct.fields below).
  // Products that don't need that can just ignore the `values` argument.
  abstract fields(values: ProductFormValues): ProductField[];

  emptyValues(): ProductFormValues {
    const values: ProductFormValues = {};
    for (const field of this.fields({})) values[field.key] = "";
    return values;
  }

  validate(values: ProductFormValues): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const field of this.fields(values)) {
      if (field.required && !(values[field.key] ?? "").trim()) {
        errors[field.key] = "Required";
      }
    }
    return errors;
  }

  // The portion of the order amount driven by this product's own fields
  // (on top of the shared "One Time" amount).
  abstract productAmount(values: ProductFormValues): number;

  // Deterministic sample values for seeded mock orders.
  abstract mockDetails(seed: number): Partial<OrderRecordDetails>;
}

const BILLED_ON_OPTIONS = ["No. of Users", "No. of Assessments"];
const DEVICE_TYPES = ["Desktop", "Mobile", "All Devices"];
const QUESTION_TYPES = ["MCQ", "Descriptive", "Video", "Audio"];

class LmsProduct extends Product {
  readonly name = "LMS";

  fields(): ProductField[] {
    return [
      { key: "numUsers", label: "No. of Users", type: "number", required: true },
      { key: "feePerUser", label: "Fee per User (₹)", type: "number", required: true },
    ];
  }

  productAmount(values: ProductFormValues): number {
    return toNumber(values.numUsers) * toNumber(values.feePerUser);
  }

  mockDetails(seed: number): Partial<OrderRecordDetails> {
    return { numUsers: 50 + seed * 5, feePerUser: 120 };
  }
}

class QuirioProduct extends Product {
  readonly name = "Quirio";

  fields(values: ProductFormValues): ProductField[] {
    const billedOn = values.billedOn;

    // Whichever of "No. of Users" / "No. of Assessments" billing is based on
    // becomes mandatory (alongside Unit Price) and comes first; the other
    // stays optional and moves after — nothing like this exists for LMS.
    const usersField: ProductField = {
      key: "numUsers",
      label: "No. of Users",
      type: "number",
      required: billedOn === "No. of Users",
    };
    const assessmentsField: ProductField = {
      key: "assessments",
      label: "Assessments",
      type: "number",
      hint: "(in number)",
      required: billedOn === "No. of Assessments",
    };
    const unitPriceField: ProductField = {
      key: "unitPrice",
      label: "Unit Price",
      type: "number",
      required: true,
      hint: "(in rupees)",
    };
    const usageFields =
      billedOn === "No. of Assessments"
        ? [assessmentsField, unitPriceField, usersField]
        : [usersField, unitPriceField, assessmentsField];

    return [
      {
        key: "billedOn",
        label: "Billed On",
        type: "select",
        required: true,
        options: BILLED_ON_OPTIONS.map((o) => ({ value: o, label: o })),
      },
      ...usageFields,
      { key: "automatedProctoring", label: "Automated remote proctoring required", type: "yesno", required: true },
      { key: "proctoringBySgTeam", label: "Proctoring by SG Team", type: "yesno", required: true },
      {
        key: "proctoringVideos",
        label: "Proctoring videos to be provided to the client",
        type: "yesno",
        required: true,
      },
      { key: "gradingBySgTeam", label: "Grading to be done by SG Team", type: "yesno", required: true },
      { key: "mathsEditor", label: "Maths Editor required", type: "yesno", required: true },
      { key: "freeAssessments", label: "Free Assessments", type: "number", required: true, hint: "(in number)" },
      {
        key: "questionType",
        label: "Question Type",
        type: "select",
        required: true,
        options: QUESTION_TYPES.map((q) => ({ value: q, label: q })),
      },
      {
        key: "deviceType",
        label: "Device Type",
        type: "select",
        required: true,
        options: DEVICE_TYPES.map((d) => ({ value: d, label: d })),
      },
    ];
  }

  productAmount(values: ProductFormValues): number {
    const unit = toNumber(values.unitPrice);
    const users = toNumber(values.numUsers);
    const assessments = toNumber(values.assessments);
    return unit * (users + assessments);
  }

  mockDetails(_seed: number): Partial<OrderRecordDetails> {
    return { billedOn: "No. of Users", assessments: 200, unitPrice: 40 };
  }
}

export const PRODUCTS: Product[] = [new LmsProduct(), new QuirioProduct()];

export const PRODUCT_NAMES = PRODUCTS.map((p) => p.name);

export function getProduct(name: string): Product | undefined {
  return PRODUCTS.find((p) => p.name === name);
}
