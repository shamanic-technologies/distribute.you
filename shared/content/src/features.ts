export interface DistributionFeature {
  id: string;
  title: string;
  description: string;
  metric: string;
  status: "live" | "coming-soon";
}

export const DISTRIBUTION_FEATURES: DistributionFeature[] = [
  {
    id: "welcome-emails",
    title: "Welcome Emails",
    description: "Personalized welcome emails that match your brand. Zero configuration needed.",
    metric: "Open Rate",
    status: "live",
  },
  {
    id: "cold-outreach",
    title: "Cold Outreach",
    description: "Find leads, generate personalized emails, send and optimize automatically.",
    metric: "Reply Rate",
    status: "live",
  },
  {
    id: "webinar-lifecycle",
    title: "Webinar Lifecycle",
    description: "Registration confirmations, reminders, follow-ups. The full flow, automated.",
    metric: "Attendance Rate",
    status: "coming-soon",
  },
  {
    id: "lifecycle-campaigns",
    title: "Lifecycle Campaigns",
    description: "Onboarding sequences, re-engagement, and win-back flows that run on autopilot.",
    metric: "Conversion Rate",
    status: "coming-soon",
  },
  {
    id: "downsell-retention",
    title: "Downsell & Retention",
    description: "Smart follow-ups when users disengage. Reduce churn without lifting a finger.",
    metric: "Retention Rate",
    status: "coming-soon",
  },
  {
    id: "social-distribution",
    title: "Social Distribution",
    description: "Your content, repurposed and distributed across every social channel.",
    metric: "Engagement Rate",
    status: "coming-soon",
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
    description: "We analyze your site, brand, tone of voice, and visual identity.",
  },
  {
    number: 2,
    title: "Enable features",
    description: "Welcome emails, outreach, webinar flows — toggle what you need.",
  },
  {
    number: 3,
    title: "We handle the rest",
    description: "The best-performing AI workflow runs automatically. You just watch the metrics.",
  },
];
