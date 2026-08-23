import { z } from "zod";

export const CurrencyCodeSchema = z.enum(["USD", "EUR", "GBP", "CAD", "AUD"]);

export const MoneySchema = z.object({
  amountMinor: z.number().int({ message: "Amount must be integer cents/minor units" }),
  currency: CurrencyCodeSchema.default("USD"),
});

export const MoneyRangeSchema = z
  .object({
    minMinor: z.number().int().nonnegative(),
    maxMinor: z.number().int().nonnegative(),
    currency: CurrencyCodeSchema.default("USD"),
  })
  .refine((data) => data.maxMinor >= data.minMinor, {
    message: "maxMinor must be greater than or equal to minMinor",
    path: ["maxMinor"],
  });
