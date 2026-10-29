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
    description: "We read your site, your offer and your voice, then build your sales funnel campaign.",
  },
  {
    number: 2,
    title: "We find your buyers",
    description: "We find the prospects who match your ideal customer and write each one a personal cold email.",
  },
  {
    number: 3,
    title: "Set your caps",
    description: "Pick a max budget or a max volume per period. You pay as you go at the vendor's API price, 0% markup. Replies land in your Unibox: answer them yourself or let the AI book the meeting.",
  },
];
