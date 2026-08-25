import { BillingSubscriptionStatusType } from "@buildworth/shared";

/**
 * Maps raw Stripe subscription status string to internal BillingSubscriptionStatus enum.
 * Explicitly maps unknown statuses to UNKNOWN (which fail closed to commercial FREE tier).
 */
export function mapStripeSubscriptionStatus(stripeStatus: string): BillingSubscriptionStatusType {
  switch (stripeStatus) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    case "paused":
      return "PAUSED";
    case "incomplete":
      return "INCOMPLETE";
    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";
    default:
      // Explicit unknown provider status
      return "UNKNOWN";
  }
}
