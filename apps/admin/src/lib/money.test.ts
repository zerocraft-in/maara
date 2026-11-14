import { describe, expect, it } from "vitest";

import {
  addPaise,
  applyBasisPoints,
  formatPaise,
  lineAmounts,
  MoneyError,
  multiplyPaise,
  paise,
  paiseToInputValue,
  rupeesToPaise,
  subtractPaise,
  sumPaise,
} from "@/lib/money";

describe("rupeesToPaise", () => {
  it("converts whole rupees", () => {
    expect(rupeesToPaise("499")).toBe(49_900);
    expect(rupeesToPaise(499)).toBe(49_900);
  });

  it("converts decimals without floating point drift", () => {
    expect(rupeesToPaise("0.10")).toBe(10);
    expect(rupeesToPaise("19.99")).toBe(1_999);
    expect(rupeesToPaise("1234.5")).toBe(123_450);
    expect(rupeesToPaise("1234.05")).toBe(123_405);
  });

  it("accepts Indian grouping and the rupee symbol", () => {
    expect(rupeesToPaise("₹1,23,456.78")).toBe(12_345_678);
  });

  it("handles negatives", () => {
    expect(rupeesToPaise("-12.30")).toBe(-1_230);
    expect(rupeesToPaise(-12.3)).toBe(-1_230);
  });

  it("rejects more than two decimal places", () => {
    expect(() => rupeesToPaise("12.345")).toThrow(MoneyError);
    expect(() => rupeesToPaise("12.345")).toThrow(/two decimal/);
  });

  it("rejects empty and malformed input", () => {
    expect(() => rupeesToPaise("")).toThrow(MoneyError);
    expect(() => rupeesToPaise("abc")).toThrow(MoneyError);
    expect(() => rupeesToPaise("1.2.3")).toThrow(MoneyError);
    expect(() => rupeesToPaise("--4")).toThrow(MoneyError);
  });
});

describe("formatPaise", () => {
  it("formats with Indian grouping and the rupee symbol", () => {
    expect(formatPaise(paise(12_345_678))).toBe("₹1,23,456.78");
    expect(formatPaise(paise(1_000))).toBe("₹10.00");
    expect(formatPaise(paise(0))).toBe("₹0.00");
  });

  it("formats negatives", () => {
    expect(formatPaise(paise(-123_450))).toBe("-₹1,234.50");
  });

  it("can omit the currency symbol", () => {
    expect(formatPaise(paise(123_450), { showSymbol: false })).toBe(
      "1,234.50",
    );
  });
});

describe("paiseToInputValue", () => {
  it("round-trips through rupeesToPaise", () => {
    for (const amount of [0, 10, 1_999, 123_405, -1_230]) {
      const typed = paiseToInputValue(paise(amount));
      expect(rupeesToPaise(typed)).toBe(amount);
    }
  });

  it("always shows two decimal places", () => {
    expect(paiseToInputValue(paise(500))).toBe("5.00");
    expect(paiseToInputValue(paise(5))).toBe("0.05");
  });
});

describe("integer arithmetic", () => {
  it("adds and subtracts exactly", () => {
    expect(addPaise(paise(10), paise(20), paise(30))).toBe(60);
    expect(subtractPaise(paise(100), paise(1), paise(99))).toBe(0);
  });

  it("multiplies by whole quantities only", () => {
    expect(multiplyPaise(paise(1_999), 3)).toBe(5_997);
    expect(() => multiplyPaise(paise(1_999), 1.5)).toThrow(MoneyError);
  });

  it("sums a list", () => {
    expect(sumPaise([paise(100), paise(250), paise(1)])).toBe(351);
  });
});

describe("applyBasisPoints", () => {
  it("applies percentages expressed in basis points", () => {
    expect(applyBasisPoints(paise(10_000), 1800)).toBe(1_800); // 18%
    expect(applyBasisPoints(paise(10_000), 10000)).toBe(10_000);
    expect(applyBasisPoints(paise(10_000), 0)).toBe(0);
  });

  it("rounds half away from zero", () => {
    expect(applyBasisPoints(paise(5), 1000)).toBe(1); // 0.5 -> 1
    expect(applyBasisPoints(paise(-5), 1000)).toBe(-1);
    expect(applyBasisPoints(paise(4), 1000)).toBe(0);
  });

  it("rejects negative and fractional rates", () => {
    expect(() => applyBasisPoints(paise(100), -1)).toThrow(MoneyError);
    expect(() => applyBasisPoints(paise(100), 12.5)).toThrow(MoneyError);
  });
});

describe("lineAmounts", () => {
  it("computes gross, discount and total", () => {
    const amounts = lineAmounts(paise(1_999), 3, 500); // 5% off
    expect(amounts.gross).toBe(5_997);
    expect(amounts.discount).toBe(300); // 299.85 -> 300
    expect(amounts.total).toBe(5_697);
  });

  it("handles no discount", () => {
    expect(lineAmounts(paise(500), 2)).toEqual({
      gross: 1_000,
      discount: 0,
      total: 1_000,
    });
  });
});
