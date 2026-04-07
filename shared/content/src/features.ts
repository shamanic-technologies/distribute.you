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
    title: "Sales Outreach",
    description: "Find prospects, write personalized cold emails, send and track replies. Automatically.",
    metric: "Reply Rate",
    status: "live",
    color: "cyan",
  },
  {
    id: "journalist-outreach",
    title: "Journalist Outreach",
    description: "Pitch journalists who cover your space. Get press without a PR agency.",
    metric: "Reply Rate",
    status: "live",
    color: "emerald",
  },
  {
    id: "hiring-outreach",
    title: "Hiring Outreach",
    description: "Reach candidates that match your needs. Cold outreach for recruiting.",
    metric: "Reply Rate",
    status: "live",
    color: "violet",
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
    description: "We analyze your site, your brand, and your voice.",
  },
  {
    number: 2,
    title: "Pick your channels",
    description: "Sales, journalists, hiring — toggle what you need.",
  },
  {
    number: 3,
    title: "Set a budget",
    description: "We handle the rest. You get notified when someone replies.",
  },
];
