/**
 * The outcome catalogue for the feature-stats surface — ONE list, read by the
 * Economics cards, the Cost-details selector and the Workflow table, so the
 * three pages cannot drift into three vocabularies for one outcome.
 *
 * Alias-free (type-only import) so it carries real unit tests.
 */
import type { CrossOrgObjective } from "./api";

export type FeatureStatsObjective = {
  key: CrossOrgObjective;
  label: string;
  noun: string;
};

/**
 * The maximization objectives, cross-org. `key` is the canonical camelCase the
 * features-service trend + per-workflow endpoints accept; `noun` is the outcome.
 */
export const OBJECTIVES: FeatureStatsObjective[] = [
  { key: "websiteVisit", label: "Cost per click (CPC)", noun: "click" },
  { key: "positiveReply", label: "Cost per positive reply", noun: "positive reply" },
  { key: "signup", label: "Cost per signup", noun: "signup" },
  { key: "formSubmission", label: "Cost per form submission", noun: "form submission" },
  { key: "meetingBooked", label: "Cost per meeting", noun: "meeting" },
  // `purchase` stays the trend/workflow query key (features-service still
  // accepts it); only the display label was renamed to "website purchase".
  { key: "purchase", label: "Cost per website purchase", noun: "website purchase" },
];

/**
 * A display-only outcome (summary table row) with no moving-average trend of
 * its own — only a lifetime all-time avg. `Sales` is the combined goal (paying
 * client won via visit→paid OR reply→paid, valued at CLTV); the features-service
 * trend/per-workflow endpoints do NOT accept it as an `objective`, so it appears
 * as an all-time figure only, not a ticker/selector.
 */
export type DisplayObjective = { key: string; label: string; noun: string };

export const SALES_OBJECTIVE: DisplayObjective = {
  key: "sales",
  label: "Cost per sale (CLTV)",
  noun: "sale",
};
