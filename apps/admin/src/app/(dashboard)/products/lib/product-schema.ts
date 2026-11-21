import * as z from "zod";
import {
  rupeesToPaise,
  paiseToInputValue,
  type Paise,
} from "@/lib/money";

/**
 * Unit options for unit pricing (weight/volume/dimension/count).
 * Mirrors the UNIT_OPTIONS used in PricingSection.
 */
export const UNIT_OPTIONS = [
  { value: "mg", label: "Milligram (mg)" },
  { value: "g", label: "Gram (g)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "ml", label: "Milliliter (ml)" },
  { value: "cl", label: "Centiliter (cl)" },
  { value: "L", label: "Liter (L)" },
  { value: "m3", label: "Cubic meter (m³)" },
  { value: "mm", label: "Millimeter (mm)" },
  { value: "cm", label: "Centimeter (cm)" },
  { value: "m", label: "Meter (m)" },
  { value: "m2", label: "Square meter (m²)" },
  { value: "item", label: "Item (item)" },
] as const;

export type UnitOptionValue = (typeof UNIT_OPTIONS)[number]["value"];

/**
 * Dimension units for shipping package dimensions.
 */
export const DIMENSION_UNITS = ["cm", "in"] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

/**
 * Weight units for shipping weight.
 */
export const WEIGHT_UNITS = ["g", "kg", "oz", "lb"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

/**
 * Product status values supported by the schema and database.
 */
export type ProductStatus = "draft" | "active" | "archived";

export type ProductOptionInput = {
  name: string;
  values: string[];
};

export type VariantInput = {
  id?: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string;
  barcode: string | null;
  price: string;
  compare_at_price: string | null;
  cost_per_item: string;
  track_quantity: boolean;
  quantity: string;
  continue_selling_when_out_of_stock: boolean;
  weight: string | null;
  weight_unit: WeightUnit;
  requires_shipping: boolean;
  is_active: boolean;
};

/**
 * Complete Zod schema for the product creation/editing form.
 *
 * Monetary values are captured as display strings (rupees with up to 2 decimals)
 * and converted to integer paise at submission time via `toCreatePayload`.
 * Never store or accumulate floating-point currency.
 */
export const productFormSchema = z.object({
  // ── Identity ──────────────────────────────────────────────────────────
  name: z
    .string()
    .trim()
    .min(2, "Product title must be at least 2 characters.")
    .max(160, "Product title must be at most 160 characters."),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters.")
    .optional()
    .or(z.literal("")),
  handle: z
    .string()
    .trim()
    .max(255, "Handle must be at most 255 characters.")
    .optional()
    .or(z.literal("")),
  vendor: z
    .string()
    .trim()
    .max(100, "Vendor must be at most 100 characters.")
    .optional()
    .or(z.literal("")),
  product_type: z
    .string()
    .trim()
    .max(100, "Product type must be at most 100 characters.")
    .optional()
    .or(z.literal("")),
  tags: z.array(z.string()).default([]),
  category_id: z.string().uuid("Invalid category ID.").nullable(),

  // ── Pricing ───────────────────────────────────────────────────────────
  price: z.string().optional().or(z.literal("")),
  compare_at_price: z.string().optional().or(z.literal("")),
  cost_per_item: z.string().optional().or(z.literal("")),
  is_tax_inclusive: z.boolean().default(false),
  tax_rate_percent: z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a valid tax rate (0–100%).")
    .refine((v) => Number(v) <= 100, "Tax rate must be 100% or less.")
    .optional()
    .or(z.literal("")),

  // ── Unit price ────────────────────────────────────────────────────────
  unit_price_total_amount: z.string().optional().or(z.literal("")),
  unit_price_total_amount_unit: z
    .enum(["g", "kg", "oz", "lb", "mg", "ml", "L", "item"])
    .default("g"),
  unit_price_base_measure: z.string().optional().or(z.literal("")),
  unit_price_base_measure_unit: z
    .enum([
      "mg",
      "g",
      "kg",
      "oz",
      "lb",
      "mg",
      "ml",
      "L",
      "m2",
      "m3",
      "cm",
      "mm",
      "m",
      "item",
    ])
    .default("g"),

  // ── Inventory ─────────────────────────────────────────────────────────
  track_quantity: z.boolean().default(true),
  quantity: z.string().optional().or(z.literal("")),
  continue_selling_when_out_of_stock: z.boolean().default(false),
  sku: z.string().optional().or(z.literal("")),
  barcode: z
    .string()
    .trim()
    .regex(/^[0-9]{8,14}$/, "Barcode must be 8–14 digits.")
    .optional()
    .or(z.literal("")),

  // ── Shipping ──────────────────────────────────────────────────────────
  requires_shipping: z.boolean().default(true),
  weight: z.string().optional().or(z.literal("")),
  weight_unit: z.enum(["g", "kg", "oz", "lb"]).default("g"),
  packed_length: z.string().optional().or(z.literal("")),
  packed_width: z.string().optional().or(z.literal("")),
  packed_height: z.string().optional().or(z.literal("")),
  dimension_unit: z.enum(["cm", "in"]).default("cm"),
  hs_code: z.string().trim().max(20).optional().or(z.literal("")),
  country_of_origin: z
    .string()
    .trim()
    .length(2, "Country code must be 2 letters (ISO 3166-1 alpha-2).")
    .optional()
    .or(z.literal("")),

  // ── SEO ───────────────────────────────────────────────────────────────
  seo_title: z.string().trim().max(70).optional().or(z.literal("")),
  seo_description: z.string().trim().max(320).optional().or(z.literal("")),
  published_scope: z.enum(["web", "global"]).default("web"),

  // ── Status ────────────────────────────────────────────────────────────
  status: z.enum(["draft", "active", "archived"] as const),

  // ── Options / Variants ────────────────────────────────────────────────
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(50),
        values: z.array(z.string().trim().min(1).max(50)),
      }),
    )
    .max(3, "Maximum 3 product options.")
    .default([]),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

/**
 * Cross-field validation: compare-at price must not be below the selling
 * price unless explicitly allowed. Returns a map of field → error message.
 */
export function validatePriceRelationship(
  values: Pick<ProductFormValues, "price" | "compare_at_price">,
) {
  const errors: Record<string, string> = {};

  const price = values.price ? rupeesToPaise(values.price) : null;
  const compareAt = values.compare_at_price
    ? rupeesToPaise(values.compare_at_price)
    : null;

  if (price && compareAt && compareAt < price) {
    errors.compare_at_price =
      "Compare-at price cannot be lower than the selling price.";
  }

  return errors;
}

/**
 * Compute profit and margin from price and cost (in paise).
 * Returns null when price is empty or zero (avoid misleading 0% margin).
 */
export function computeProfitMargin(
  pricePaise: Paise | null,
  costPaise: Paise | null,
): { profit: Paise | null; margin: number | null } {
  if (!pricePaise || pricePaise <= 0) {
    return { profit: null, margin: null };
  }
  const cost = costPaise ?? 0;
  const profit = (pricePaise - cost) as Paise;
  const margin = (profit / pricePaise) * 100;
  return { profit, margin };
}

/**
 * Convert a unit-price measurement into a normalized minor-unit value.
 * Returns paise per base unit, or null when inputs are incomplete.
 */
export function computeUnitPricePaise({
  price,
  totalAmount,
  baseMeasure,
}: {
  price: string | null;
  totalAmount: string | null;
  baseMeasure: string | null;
}): Paise | null {
  if (!price) return null;
  const pricePaise = rupeesToPaise(price);
  if (pricePaise <= 0) return null;

  const amount = totalAmount ? Number(totalAmount) : 0;
  const measure = baseMeasure ? Number(baseMeasure) : 0;
  if (!amount || !measure) return null;

  // Normalize both to a common base (mg for weight, ml for volume, etc.)
  // For simplicity we treat all units as comparable scalars here; the
  // caller should ensure consistent unit families.
  const unitPrice = pricePaise / (amount / measure);
  if (!Number.isFinite(unitPrice)) return null;
  return rupeesToPaise(String((unitPrice / 100).toFixed(2))) as Paise;
}

/**
 * Parse a display money string into integer paise. Returns null for empty.
 * Throws MoneyError for invalid formats (handled by zod at submit time).
 */
export function parseMoney(value: string | undefined | null): Paise | null {
  if (!value || value.trim() === "") return null;
  return rupeesToPaise(value);
}

/**
 * Format integer paise back to a two-decimal string suitable for form inputs.
 */
export function formatMoneyInput(amount: Paise | null | undefined): string {
  if (!amount) return "";
  return paiseToInputValue(amount);
}

/**
 * Normalize a weight value from the selected unit into grams.
 */
export function normalizeWeightToGrams(
  value: string | null,
  unit: WeightUnit,
): number | null {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;

  switch (unit) {
    case "g":
      return amount;
    case "kg":
      return amount * 1000;
    case "oz":
      return amount * 28.3495;
    case "lb":
      return amount * 453.592;
    default:
      return amount;
  }
}

/**
 * Normalize shipping dimensions to centimeters.
 */
export function normalizeDimensionToCm(
  value: string | null,
  unit: DimensionUnit,
): number | null {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return unit === "in" ? amount * 2.54 : amount;
}
