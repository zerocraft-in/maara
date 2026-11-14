/**
 * Money utilities.
 *
 * All monetary values in Maara Merch are integer paise (1 rupee = 100 paise).
 * Floating point is never used to store or accumulate currency. These helpers
 * exist so that conversion and formatting happen in exactly one place.
 */

export type Paise = number & { readonly __brand: "Paise" };

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>();

function currencyFormatter(locale: string, currency: string) {
  const key = `${locale}:${currency}`;
  let formatter = CURRENCY_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    CURRENCY_FORMATTERS.set(key, formatter);
  }
  return formatter;
}

function decimalFormatter(locale: string) {
  const key = `${locale}:decimal`;
  let formatter = CURRENCY_FORMATTERS.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    CURRENCY_FORMATTERS.set(key, formatter);
  }
  return formatter;
}

/** Assert that a number is a safe integer and brand it as paise. */
export function paise(value: number): Paise {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError("Amount must be a whole number of paise");
  }
  return value as Paise;
}

/**
 * Convert a user-entered rupee amount to integer paise.
 * Accepts "1,234.50", "₹1,234", "1234", "-12.3". Rejects more than two
 * decimal places instead of silently rounding.
 */
export function rupeesToPaise(value: string | number): Paise {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new MoneyError("Amount is not valid");
    return rupeesToPaise(value.toFixed(2));
  }

  const trimmed = value.trim();
  if (!trimmed) throw new MoneyError("Amount is required");

  const cleaned = trimmed.replace(/[₹,\s_]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new MoneyError(
      "Enter a valid amount with at most two decimal places",
    );
  }

  const negative = cleaned.startsWith("-");
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const [whole, fraction = ""] = unsigned.split(".");
  const paiseValue = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(paiseValue)) {
    throw new MoneyError("Amount is too large");
  }

  return (negative ? -paiseValue : paiseValue) as Paise;
}

export function addPaise(...amounts: Paise[]): Paise {
  let total = 0;
  for (const amount of amounts) {
    total += amount;
    if (!Number.isSafeInteger(total)) throw new MoneyError("Total overflow");
  }
  return total as Paise;
}

export function subtractPaise(amount: Paise, ...deductions: Paise[]): Paise {
  let total: number = amount;
  for (const deduction of deductions) {
    total -= deduction;
  }
  if (!Number.isSafeInteger(total)) throw new MoneyError("Total overflow");
  return total as Paise;
}

/** Multiply a unit price by an integer quantity (no fractional quantities). */
export function multiplyPaise(amount: Paise, quantity: number): Paise {
  if (!Number.isSafeInteger(quantity)) {
    throw new MoneyError("Quantity must be a whole number");
  }
  const total = amount * quantity;
  if (!Number.isSafeInteger(total)) throw new MoneyError("Total overflow");
  return total as Paise;
}

/**
 * Apply a rate expressed in basis points (10000 = 100%).
 * Rounds half away from zero so totals are deterministic and symmetric.
 */
export function applyBasisPoints(amount: Paise, basisPoints: number): Paise {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new MoneyError("Rate must be a non-negative whole number");
  }
  const scaled = Math.abs(amount) * basisPoints;
  if (!Number.isSafeInteger(scaled)) throw new MoneyError("Amount is too large");
  const rounded = Math.round(scaled / 10000);
  return (amount < 0 ? -rounded : rounded) as Paise;
}

export type LineAmounts = {
  gross: Paise;
  discount: Paise;
  total: Paise;
};

/** Compute a line total from unit price, quantity and a discount in bps. */
export function lineAmounts(
  unitPrice: Paise,
  quantity: number,
  discountBasisPoints = 0,
): LineAmounts {
  const gross = multiplyPaise(unitPrice, quantity);
  const discount = applyBasisPoints(gross, discountBasisPoints);
  return { gross, discount, total: subtractPaise(gross, discount) };
}

/** Sum paise values (convenience for report and invoice totals). */
export function sumPaise(amounts: readonly Paise[]): Paise {
  return addPaise(...amounts);
}

export type FormatPaiseOptions = {
  locale?: string;
  currency?: string;
  /** When false, the currency symbol is omitted (useful in inputs). */
  showSymbol?: boolean;
};

/**
 * Format integer paise for display. Defaults to Indian numbering and INR.
 * This is the only place currency formatting should happen.
 */
export function formatPaise(
  amount: Paise,
  {
    locale = "en-IN",
    currency = "INR",
    showSymbol = true,
  }: FormatPaiseOptions = {},
): string {
  const rupees = amount / 100;
  if (!Number.isFinite(rupees)) throw new MoneyError("Amount is not valid");

  if (showSymbol) {
    return currencyFormatter(locale, currency).format(rupees);
  }

  return decimalFormatter(locale).format(rupees);
}

/** Convert paise back to a plain two-decimal string for form inputs. */
export function paiseToInputValue(amount: Paise): string {
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const rupees = Math.trunc(absolute / 100);
  const remainder = absolute % 100;
  return `${negative ? "-" : ""}${rupees}.${String(remainder).padStart(2, "0")}`;
}
