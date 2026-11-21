import type { ProductOptionInput, VariantInput } from "./product-schema";

/**
 * Generate the full cartesian product of option values.
 *
 * Options:
 *   Size: S, M, L
 *   Color: Black, White
 *
 * Generated variants:
 *   S / Black, S / White, M / Black, M / White, L / Black, L / White
 *
 * Duplicate option values are prevented (deduped while preserving order).
 * Returns an empty array when there are no options.
 */
export function generateVariants(options: ProductOptionInput[]): string[][] {
  if (options.length === 0) return [];

  // Dedupe values within each option while preserving order.
  const valueLists = options.map((opt) => {
    const seen = new Set<string>();
    return opt.values.filter((v) => {
      const trimmed = v.trim();
      if (!trimmed || seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    });
  });

  // If any option has no values, no variants can be generated.
  if (valueLists.some((list) => list.length === 0)) return [];

  const combinations: string[][] = [[]];
  for (const list of valueLists) {
    const next: string[][] = [];
    for (const combo of combinations) {
      for (const value of list) {
        next.push([...combo, value]);
      }
    }
    combinations.splice(0, combinations.length, ...next);
  }

  return combinations;
}

/**
 * Compute the maximum number of variants from options.
 * Used for UI limits (Shopify caps at 100).
 */
export function maxVariantCount(options: ProductOptionInput[]): number {
  if (options.length === 0) return 0;
  return options.reduce(
    (acc, opt) => acc * opt.values.filter((v) => v.trim().length > 0).length,
    1,
  );
}

/**
 * Build VariantInput records from generated combinations, applying
 * per-variant defaults inherited from the product-level defaults.
 */
export function buildVariantInputs(
  combinations: string[][],
  defaults: Partial<VariantInput> & {
    price: string;
    cost_per_item: string;
    quantity: string;
  },
): VariantInput[] {
  return combinations.map((combo, index) => ({
    id: undefined,
    option1: combo[0] ?? null,
    option2: combo[1] ?? null,
    option3: combo[2] ?? null,
    sku: defaults.sku ?? `VAR-${index + 1}`,
    barcode: null,
    price: defaults.price,
    compare_at_price: null,
    cost_per_item: defaults.cost_per_item,
    track_quantity: defaults.track_quantity ?? true,
    quantity: defaults.quantity,
    continue_selling_when_out_of_stock:
      defaults.continue_selling_when_out_of_stock ?? false,
    weight: null,
    weight_unit: defaults.weight_unit ?? "g",
    requires_shipping: defaults.requires_shipping ?? true,
    is_active: true,
  }));
}

/**
 * Validate that a list of variant inputs has no duplicate SKUs and that
 * all required fields are present. Returns field-indexed errors.
 */
export function validateVariants(
  variants: VariantInput[],
): Record<number, Record<string, string>> {
  const errors: Record<number, Record<string, string>> = {};
  const seenSkus = new Set<string>();

  variants.forEach((variant, index) => {
    const fieldErrors: Record<string, string> = {};

    if (!variant.sku || variant.sku.trim().length < 2) {
      fieldErrors.sku = "SKU must be at least 2 characters.";
    } else if (!/^[A-Za-z0-9-]+$/.test(variant.sku)) {
      fieldErrors.sku = "SKU must be alphanumeric or hyphen.";
    } else {
      const upper = variant.sku.toUpperCase();
      if (seenSkus.has(upper)) {
        fieldErrors.sku = "Duplicate SKU.";
      } else {
        seenSkus.add(upper);
      }
    }

    if (variant.barcode && !/^[0-9]{8,14}$/.test(variant.barcode)) {
      fieldErrors.barcode = "Barcode must be 8–14 digits.";
    }

    const price = Number(variant.price);
    if (!variant.price || !Number.isFinite(price) || price < 0) {
      fieldErrors.price = "Enter a valid price.";
    }

    const cost = Number(variant.cost_per_item);
    if (!variant.cost_per_item || !Number.isFinite(cost) || cost < 0) {
      fieldErrors.cost_per_item = "Enter a valid cost.";
    }

    const qty = Number(variant.quantity);
    if (
      variant.track_quantity &&
      (!Number.isInteger(qty) || qty < 0)
    ) {
      fieldErrors.quantity = "Quantity must be a whole number ≥ 0.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      errors[index] = fieldErrors;
    }
  });

  return errors;
}
