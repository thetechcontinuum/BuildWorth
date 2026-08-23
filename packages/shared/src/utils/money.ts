import { CurrencyCode, Money, MoneyRange } from "../types/money.js";

/**
 * Creates a Money object with integer minor units.
 */
export function createMoney(amountMinor: number, currency: CurrencyCode = "USD"): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Amount must be an integer minor unit (cents), got: ${amountMinor}`);
  }
  return { amountMinor, currency };
}

/**
 * Formats minor units into human readable currency string (e.g. 150000 -> "$1,500")
 */
export function formatMoney(money: Money): string {
  const major = money.amountMinor / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: major % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * Formats a range of money (e.g. $5,000 - $12,000)
 */
export function formatMoneyRange(range: MoneyRange): string {
  const minFormatted = formatMoney({ amountMinor: range.minMinor, currency: range.currency });
  const maxFormatted = formatMoney({ amountMinor: range.maxMinor, currency: range.currency });
  return `${minFormatted} – ${maxFormatted}`;
}

/**
 * Converts float major currency (e.g. 49.99) into integer cents (4999)
 */
export function toMinorUnits(majorAmount: number): number {
  return Math.round(majorAmount * 100);
}

/**
 * Converts integer cents (4999) to major currency float (49.99)
 */
export function toMajorUnits(minorUnits: number): number {
  return minorUnits / 100;
}
