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
    id: "vc-outreach",
    title: "VC Outreach",
    description: "Reach investors who back your stage and sector. Run a structured raise from your inbox.",
    metric: "Reply Rate",
    status: "live",
    color: "violet",
  },
  {
    id: "hiring-outreach",
    title: "Hiring Outreach",
    description: "Reach candidates that match your needs. Cold outreach for recruiting.",
    metric: "Reply Rate",
    status: "live",
    color: "blue",
  },
  {
    id: "accelerators-outreach",
    title: "Accelerators Outreach",
    description: "Apply to YC, Techstars, and 200+ accelerators. We track deadlines and pitch on your behalf.",
    metric: "Reply Rate",
    status: "live",
    color: "pink",
  },
  {
    id: "pr-expert-quote-outreach",
    title: "PR Expert Quotes",
    description: "Get quoted in articles. Respond to HARO-style requests with on-brand quotes, auto-sent.",
    metric: "Quotes Published",
    status: "live",
    color: "amber",
  },
  {
    id: "outlet-discovery",
    title: "Outlet Discovery",
    description: "Find media outlets and publications worth pitching for your brand and space.",
    metric: "Outlets Found",
    status: "live",
    color: "blue",
  },
  {
    id: "press-kit-generation",
    title: "Press Kit Generation",
    description: "Generate a press kit page with assets, bio, screenshots, and contact in one click.",
    metric: "Press Kit Sections",
    status: "live",
    color: "emerald",
  },
  {
    id: "ai-visibility-scoring",
    title: "AI Visibility Scoring",
    description:
      "Audit how your brand appears in answers from ChatGPT, Claude, Perplexity, and Gemini. Track mention rate, ranking, and share-of-voice against competitors.",
    metric: "Mention Rate",
    status: "live",
    color: "amber",
  },
  {
    id: "influencer-outreach",
    title: "Influencer Outreach",
    description: "Reach creators in your niche. Match by audience size, engagement, and topical fit.",
    metric: "Reply Rate",
    status: "coming-soon",
    color: "pink",
  },
  {
    id: "linkedin-outreach",
    title: "LinkedIn Outreach",
    description: "Sales outreach on LinkedIn — connection request, message, follow-up. Tracked like email.",
    metric: "Reply Rate",
    status: "coming-soon",
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
    description: "We analyze your site, your brand, your voice — and pick the best workflow per channel.",
  },
  {
    number: 2,
    title: "Pick your channels",
    description: "Sales, PR, VC, hiring, accelerators — toggle what you need. Each one runs on its own budget.",
  },
  {
    number: 3,
    title: "Set a daily budget",
    description: "First 50 emails free. Top up when you want. We send, qualify, and forward replies to your Gmail.",
  },
];
