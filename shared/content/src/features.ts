export type FeatureColor = "emerald" | "cyan" | "blue" | "violet" | "pink" | "amber";

export interface DistributionFeature {
  id: string;
  title: string;
  description: string;
  metric: string;
  status: "live" | "coming-soon";
  color: FeatureColor;
}

export const DISTRIBUTION_FEATURES: DistributionFeature[] = [
  {
    id: "sales-outreach",
    title: "Sales Cold Email",
    description: "Find prospects, write personalized cold emails, send and track replies. Automatically.",
    metric: "Reply Rate",
    status: "live",
    color: "cyan",
  },
];

export interface DistributionStep {
  number: number;
  title: string;
  description: string;
}

export const DISTRIBUTION_STEPS: DistributionStep[] = [
  {
    number: 1,
    title: "Add your URL",
    description: "We analyze your site, your brand, your voice — and build your cold email campaign.",
  },
  {
    number: 2,
    title: "We find your buyers",
    description: "We pull the prospects that match your ideal customer and write a personalized cold email for each.",
  },
  {
    number: 3,
    title: "Set a daily budget",
    description: "First 50 emails free. Top up when you want. We send, qualify, and forward replies to your Gmail.",
  },
];
