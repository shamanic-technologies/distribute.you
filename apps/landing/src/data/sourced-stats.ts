export interface SourcedStat {
  id: string;
  value: string;
  label: string;
  sourceLabel: string;
  sourceUrl: string;
  provider: string;
  providerDomain: string;
}

// Industry-cited stats. All values + sources are externally verifiable.
// No internal product claims here — those belong on /pricing.
export const COLD_EMAIL_PAIN_STATS: SourcedStat[] = [
  {
    id: "warmup-weeks",
    value: "3–5 weeks",
    label:
      "to warm up a cold mailbox to 40 emails per day before real outreach can start",
    sourceLabel: "Lemlist Warmup Guide, 2025",
    sourceUrl: "https://www.lemlist.com/blog/warm-up-email-account",
    provider: "Lemlist",
    providerDomain: "lemlist.com",
  },
  {
    id: "follow-up-lift",
    value: "8.3% vs 4.1%",
    label:
      "reply rate with 3–5 follow-ups vs none — sequencing doubles your hit rate",
    sourceLabel: "Saleshandy Cold Email Statistics (100M+ emails)",
    sourceUrl: "https://www.saleshandy.com/blog/cold-email-statistics/",
    provider: "Saleshandy",
    providerDomain: "saleshandy.com",
  },
  {
    id: "genai-referral",
    value: "+1,200%",
    label:
      "GenAI referral traffic to US retail YoY — buyers ask ChatGPT before Google",
    sourceLabel: "Adobe Analytics, March 2025",
    sourceUrl:
      "https://blog.adobe.com/en/publish/2025/03/17/adobe-analytics-traffic-to-us-retail-websites-from-generative-ai-sources-jumps-1200-percent",
    provider: "Adobe",
    providerDomain: "adobe.com",
  },
  {
    id: "google-decline",
    value: "−25%",
    label:
      "projected drop in traditional search volume by 2026 as users shift to AI answer engines",
    sourceLabel: "Gartner Research, Feb 2024",
    sourceUrl:
      "https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026-due-to-ai-chatbots-and-other-virtual-agents",
    provider: "Gartner",
    providerDomain: "gartner.com",
  },
];
