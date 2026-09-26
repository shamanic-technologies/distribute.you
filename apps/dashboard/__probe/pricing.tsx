import "./fetchstub";
import { createRoot } from "react-dom/client";
import { Onboarding } from "@/components/onboarding/onboarding";
const B = "75d7e3e8-6926-4f85-a557-976895400666";
const outcomes = (new URLSearchParams(location.search).get("o") ?? "meeting_booked").split(",");
const state = {
  version: 8, flowKey: "signup", step: "pricing", url: "docdinners.com", noWebsiteMode: false, brandName: "", brandContext: "",
  outcome: "sales_meetings", rates: { ltv: 2500, v2s: 5, s2c: 10, v2m: 3, r2m: 30, m2c: 25, v2p: 1, r2p: 5, v2f: 5, f2p: 10 },
  rateText: { ltv: "2500", v2s: "5", s2c: "10", v2m: "3", r2m: "30", m2c: "25", v2p: "1", r2p: "5", v2f: "5", f2p: "10" },
  services: ["Physician dinner events"], clickDestinationUrl: "", profile: {}, selectedBudget: null, customBudget: "", checkoutBudgetUsd: null,
  audiencePrompt: "Practice owners", audienceCandidates: null, selectedAudienceIds: [], workflowProjection: null, salesInputs: [],
  launchFeatureInputs: null, brandId: B, orgId: "b645207b-d8e9-40b0-9391-072b777cd9a9", servicesEdited: false, ratesEdited: false,
  startOutcomes: outcomes,
};
sessionStorage.setItem("distribute:onboarding-checkout-launch", JSON.stringify({
  version: 1, brandId: B, orgId: state.orgId, brandUrl: "https://docdinners.com", hostname: "docdinners.com", outcome: "sales_meetings",
  budgetUsd: 50, workflowSlug: "x", checkoutAmountCents: 2000, topupAmountCents: 5000, topupThresholdCents: 500, selectedAudienceIds: [],
  campaigns: [], onboardingState: state, createdAt: new Date().toISOString() }));
history.replaceState(null, "", location.pathname + "?launch_checkout=cancelled&o=" + outcomes.join(","));
createRoot(document.getElementById("root")!).render(<Onboarding />);
