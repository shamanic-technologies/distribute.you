export interface FeatureProvider {
  name: string;
  domain: string;
}

export const FEATURE_PROVIDERS: Record<string, FeatureProvider[]> = {
  "sales-outreach": [
    { name: "Apollo", domain: "apollo.io" },
    { name: "Anthropic", domain: "anthropic.com" },
    { name: "Resend", domain: "resend.com" },
  ],
  "journalist-outreach": [
    { name: "Muck Rack", domain: "muckrack.com" },
    { name: "Anthropic", domain: "anthropic.com" },
    { name: "Resend", domain: "resend.com" },
  ],
  "vc-outreach": [
    { name: "Crunchbase", domain: "crunchbase.com" },
    { name: "Anthropic", domain: "anthropic.com" },
    { name: "Resend", domain: "resend.com" },
  ],
  "hiring-outreach": [
    { name: "LinkedIn", domain: "linkedin.com" },
    { name: "Anthropic", domain: "anthropic.com" },
    { name: "Resend", domain: "resend.com" },
  ],
  "accelerators-outreach": [
    { name: "Y Combinator", domain: "ycombinator.com" },
    { name: "Anthropic", domain: "anthropic.com" },
    { name: "Resend", domain: "resend.com" },
  ],
  "pr-expert-quote-outreach": [
    { name: "Featured", domain: "featured.com" },
    { name: "Anthropic", domain: "anthropic.com" },
    { name: "Resend", domain: "resend.com" },
  ],
  "outlet-discovery": [
    { name: "Firecrawl", domain: "firecrawl.dev" },
    { name: "Anthropic", domain: "anthropic.com" },
  ],
  "press-kit-generation": [
    { name: "Anthropic", domain: "anthropic.com" },
    { name: "Vercel", domain: "vercel.com" },
  ],
  "ai-visibility-scoring": [
    { name: "OpenAI", domain: "openai.com" },
    { name: "Anthropic", domain: "anthropic.com" },
    { name: "Perplexity", domain: "perplexity.ai" },
    { name: "Google", domain: "google.com" },
  ],
  "influencer-outreach": [
    { name: "TikTok", domain: "tiktok.com" },
    { name: "Instagram", domain: "instagram.com" },
    { name: "Anthropic", domain: "anthropic.com" },
  ],
  "linkedin-outreach": [
    { name: "LinkedIn", domain: "linkedin.com" },
    { name: "Anthropic", domain: "anthropic.com" },
  ],
};
