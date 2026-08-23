import { CompleteOpportunityBlueprint } from "./synthesizer.js";
import { formatMoneyRange } from "@buildworth/shared";

/**
 * Generates an investor-grade markdown venture dossier from an opportunity blueprint.
 */
export function generateVentureDossierMarkdown(opp: CompleteOpportunityBlueprint): string {
  return `# VENTURE BLUEPRINT: ${opp.title.toUpperCase()}

**Confidential Market Intelligence Dossier | BuildWorth Opportunity Radar**
**Date Generated:** ${new Date().toISOString().split("T")[0]}
**Opportunity Score:** ${opp.scorecard.opportunityScore}/100 | **Evidence Confidence:** ${opp.scorecard.evidenceConfidenceScore}% ${opp.scorecard.isHypothesisOnly ? "(HYPOTHESIS)" : "(VALIDATED)"}

---

## 1. Executive Summary & Problem Thesis
- **One-Sentence Thesis:** ${opp.oneSentenceSummary}
- **Problem Statement:** ${opp.problemStatement}
- **Pain Severity & Frequency:** ${opp.painSeverity} severity occurring on a ${opp.painFrequency} basis.
- **Existing Workaround:** ${opp.existingWorkflow}
- **Buying Trigger:** ${opp.buyingTrigger}

---

## 2. Target Customer & Buyer Profile
- **Target Customer Segments:** ${opp.targetCustomerSegments.join(", ")}
- **Economic Buyer:** ${opp.economicBuyer}
- **End User:** ${opp.endUser}
- **Market Accessibility:** ${opp.buyerAccessibility}

---

## 3. Proposed Product & Narrow MVP Scope
- **Proposed Solution:** ${opp.proposedProduct}
- **Jobs To Be Done:**
${opp.jobsToBeDone.map((j) => `  - ${j}`).join("\n")}
- **Narrow MVP Scope:**
${opp.narrowMvpScope.map((s) => `  - ${s}`).join("\n")}

---

## 4. Financial Modeling & Unit Economics
- **Estimated MVP Development Cost:** ${formatMoneyRange(opp.economics.estimatedMvpCost)}
- **Estimated Time to MVP:** ${opp.economics.estimatedTimeToMvpWeeks.min} – ${opp.economics.estimatedTimeToMvpWeeks.max} Weeks
- **Monthly Operating Cost:** ${formatMoneyRange(opp.economics.estimatedMonthlyOperatingCost)}
- **Plausible Monthly Pricing:** ${formatMoneyRange(opp.economics.plausibleMonthlyPriceRange)} / month
- **Customer Hours Saved Monthly:** ${opp.economics.estimatedCustomerHoursSavedMonthly} hours
- **Estimated Monthly Value Created:** $${(opp.economics.estimatedCustomerValueCreatedMonthlyCents / 100).toLocaleString()}
- **Gross Margin:** ${opp.economics.grossMarginPercent}%
- **Break-Even Customers:** ${opp.economics.breakEvenCustomerCount.min} – ${opp.economics.breakEvenCustomerCount.max} paying customers

---

## 5. Competitive Landscape & Defensibility
- **Direct Competitors:** ${opp.existingCompetitors.join(", ")}
- **Indirect Competitors / Substitutes:** ${opp.indirectCompetitors.join(", ")}
- **Competitor Flaws & Gaps:** ${opp.competitorWeaknesses.join("; ")}
- **Defensibility Moats:** ${opp.defensibilityPossibilities.join("; ")}

---

## 6. Adversarial Critic & Risk Analysis
- **Critic Verification Status:** ${opp.criticReport.isApproved ? "PASSED AUDIT" : "FLAGGED FOR REVIEW"}
- **Identified Major Risks:**
${opp.majorRisks.map((r) => `  - ${r}`).join("\n")}
- **Key Assumptions Requiring Validation:**
${opp.majorAssumptions.map((a) => `  - ${a}`).join("\n")}

---

## 7. Recommended Immediate Validation Experiment
- **Next Step:** ${opp.recommendedNextExperiment}
`;
}
