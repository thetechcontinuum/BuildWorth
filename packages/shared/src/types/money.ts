export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

export interface Money {
  /** Amount in integer minor units (e.g. cents: $100.50 -> 10050) */
  amountMinor: number;
  currency: CurrencyCode;
}

export interface MoneyRange {
  minMinor: number;
  maxMinor: number;
  currency: CurrencyCode;
}
