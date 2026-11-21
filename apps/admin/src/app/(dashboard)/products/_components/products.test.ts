import { describe, expect, it } from "vitest";

import {
  formatMoney,
  statusBadgeVariant,
  getInventoryStatus,
} from "@/app/(dashboard)/products/types";
import type { VariantRow } from "@/app/(dashboard)/products/types";
import { validatePriceRelationship } from "@/app/(dashboard)/products/lib/product-schema";

describe("formatMoney", () => {
  it("formats paise to rupees with two decimals", () => {
    expect(formatMoney(100)).toBe("₹1.00");
    expect(formatMoney(1999)).toBe("₹19.99");
    expect(formatMoney(0)).toBe("₹0.00");
    expect(formatMoney(123456)).toBe("₹1,234.56");
  });
});

describe("statusBadgeVariant", () => {
  it("returns success for active", () => {
    expect(statusBadgeVariant("active")).toBe("success");
  });

  it("returns warning for draft", () => {
    expect(statusBadgeVariant("draft")).toBe("warning");
  });

  it("returns default for archived", () => {
    expect(statusBadgeVariant("archived")).toBe("default");
    expect(statusBadgeVariant("unknown")).toBe("default");
  });
});

describe("getInventoryStatus", () => {
  it("returns not_tracked when variant does not track quantity", () => {
    const result = getInventoryStatus({
      track_quantity: false,
      quantity: 0,
    } as VariantRow);
    expect(result.status).toBe("not_tracked");
    expect(result.label).toBe("Not tracked");
  });

  it("returns out_of_stock when quantity <= 0", () => {
    const result = getInventoryStatus({
      track_quantity: true,
      quantity: 0,
    } as VariantRow);
    expect(result.status).toBe("out_of_stock");
    expect(result.label).toBe("Out of stock");
  });

  it("returns low_stock when quantity at or below reorder point", () => {
    const result = getInventoryStatus({
      track_quantity: true,
      quantity: 5,
      reorder_point: 10,
    } as VariantRow);
    expect(result.status).toBe("low_stock");
    expect(result.label).toBe("Low stock (5)");
  });

  it("returns in_stock when quantity above reorder point", () => {
    const result = getInventoryStatus({
      track_quantity: true,
      quantity: 20,
      reorder_point: 10,
    } as VariantRow);
    expect(result.status).toBe("in_stock");
    expect(result.label).toBe("In stock (20)");
  });
});

describe("validatePriceRelationship", () => {
  it("returns no errors when compare-at is above price", () => {
    const errors = validatePriceRelationship({
      price: "10.00",
      compare_at_price: "15.00",
    });
    expect(errors).toEqual({});
  });

  it("returns error when compare-at is below price", () => {
    const errors = validatePriceRelationship({
      price: "15.00",
      compare_at_price: "10.00",
    });
    expect(errors.compare_at_price).toBe(
      "Compare-at price cannot be lower than the selling price.",
    );
  });

  it("returns no errors when price is empty", () => {
    const errors = validatePriceRelationship({
      price: "",
      compare_at_price: "10.00",
    });
    expect(errors).toEqual({});
  });
});
