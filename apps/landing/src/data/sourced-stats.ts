export interface SourcedStat {
  id: string;
  value: string;
  label: string;
  sourceLabel: string;
  sourceUrl: string;
}

// Industry-cited stats. All values + sources are externally verifiable.
// No internal product claims here — those belong on /pricing.
export const COLD_EMAIL_PAIN_STATS: SourcedStat[] = [
  {
    id: "average-reply-rate",
    value: "3.43%",
    label:
      "average cold email reply rate across B2B campaigns in 2025",
    sourceLabel: "TheDigitalBloom Cold Outbound Benchmarks, 2025",
    sourceUrl:
      "https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/",
  },
  {
    id: "warmup-weeks",
    value: "3–5 weeks",
    label:
      "to warm up a cold mailbox to 40 emails per day before real outreach can start",
    sourceLabel: "Lemlist Warmup Guide, 2025",
    sourceUrl: "https://www.lemlist.com/blog/warm-up-email-account",
  },
  {
    id: "personalization-lift",
    value: "2–3×",
    label:
      "more replies when emails are individually personalized — yet only 5% of senders do it",
    sourceLabel: "TheDigitalBloom Cold Outbound Benchmarks, 2025",
    sourceUrl:
      "https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/",
  },
  {
    id: "top-quartile-rate",
    value: "15–25%",
    label:
      "reply rate achieved by top-quartile campaigns through tight ICP targeting and follow-up sequencing",
    sourceLabel: "TheDigitalBloom Cold Outbound Benchmarks, 2025",
    sourceUrl:
      "https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/",
  },
];
