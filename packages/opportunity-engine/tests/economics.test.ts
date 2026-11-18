import { describe, it, expect } from "vitest";
import { calculateEconomics, deriveOpportunityEconomics } from "../src/economics.js";

describe("Economic Modeling", () => {
  it("calculates realistic financial ranges for medium complexity tools", () => {
    const eco = calculateEconomics("MEDIUM", "DEV_TOOL");
    expect(eco.estimatedMvpCost.minMinor).toBe(600000);
    expect(eco.estimatedMvpCost.maxMinor).toBe(1200000);
    expect(eco.grossMarginPercent).toBe(85);
    expect(eco.breakEvenCustomerCount.min).toBeGreaterThan(0);
  });

  it("derives distinct cost and timeline estimates across different problem archetypes", () => {
    const cliTool = deriveOpportunityEconomics({
      title: "Slow incremental compilation in Rust for large codebases",
      problemStatement: "Developers face slow Rust compiler rebuilds across workspace crates",
      vertical: "Software Engineering & DevOps",
    });

    const aiRouter = deriveOpportunityEconomics({
      title: "High token costs for Qwen4-Max versus cheaper open-weight alternatives",
      problemStatement: "Teams overspend on LLM token cost without dynamic routing and prompt caching",
      vertical: "Software Engineering & DevOps",
    });

    const finopsCi = deriveOpportunityEconomics({
      title: "Terraform state lock acquisition timeout during parallel CI/CD applies",
      problemStatement: "Infrastructure teams suffer Terraform CI/CD pipeline stalls and cloud cost spikes",
      vertical: "DevOps & Compliance",
    });

    const dbTelemetry = deriveOpportunityEconomics({
      title: "PostgreSQL connection pool exhaustion under serverless workloads",
      problemStatement: "Database connection pools saturate during traffic spikes causing memory leak errors",
      vertical: "Data Engineering & FinOps",
    });

    const k8sObservability = deriveOpportunityEconomics({
      title: "Kubernetes CPU limits cause misdiagnosed OOMKill and Datadog bill spikes",
      problemStatement: "OpenTelemetry high cardinality and Kubernetes pod eviction drive observability overages",
      vertical: "Data Engineering & FinOps",
    });

    const enterpriseSecurity = deriveOpportunityEconomics({
      title: "Microsoft Defender silently uploading unreleased proprietary binaries",
      problemStatement: "Security and SOC2 compliance teams need automated firewall and audit controls",
      vertical: "DevOps & Compliance",
    });

    // CLI / Compiler tier should be cheapest & fastest (2-4 wks, $2.5k-$6.5k)
    expect(cliTool.estimatedMvpCost.minMinor).toBeLessThan(aiRouter.estimatedMvpCost.minMinor);
    expect(cliTool.estimatedTimeToMvpWeeks.max).toBeLessThanOrEqual(4);

    // AI routing tier ($4.5k-$10k, 3-6 wks) < DB Telemetry < Kubernetes < Enterprise Security
    expect(aiRouter.estimatedMvpCost.minMinor).toBeLessThan(dbTelemetry.estimatedMvpCost.minMinor);
    expect(finopsCi.estimatedMvpCost.minMinor).toBeLessThan(dbTelemetry.estimatedMvpCost.minMinor);
    expect(dbTelemetry.estimatedMvpCost.minMinor).toBeLessThan(k8sObservability.estimatedMvpCost.minMinor);
    expect(k8sObservability.estimatedMvpCost.minMinor).toBeLessThan(enterpriseSecurity.estimatedMvpCost.minMinor);

    // Enterprise security tier should be highest ($13.5k+ min, 7+ wks min)
    expect(enterpriseSecurity.estimatedMvpCost.minMinor).toBeGreaterThanOrEqual(1350000);
    expect(enterpriseSecurity.estimatedTimeToMvpWeeks.min).toBeGreaterThanOrEqual(7);
  });
});
