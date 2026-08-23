import React from "react";
import { PricingClient } from "@/components/PricingClient";

export const metadata = {
  title: "Pricing & Membership Plans — BuildWorth",
  description: "Subscription tiers for indie hackers, founders, and venture studios.",
};

export default function PricingPage() {
  return <PricingClient />;
}
