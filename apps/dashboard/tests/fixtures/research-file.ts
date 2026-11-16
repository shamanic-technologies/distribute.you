import type { ResearchFile, ResearchStudy } from "../../src/lib/research/research";

/**
 * A small HAND-WRITTEN Research file by Engine (RESEARCH-BY-ENGINE-1113; its Engines and measures sliced from the
 * prod read of 2026-11-16): one study per verdict, so the conclusions/studies readers are tested on their rules. The
 * real file is served live by features-service, which guards its own content.
 */
const study = (id: string, kind: "conclusion" | "signal" | "noise" | null): ResearchStudy => ({
  id,
  engine: "email_sent",
  measure: "email_sent/start/conversation",
  topic: "template",
  goal: "roi",
  question: `Which template wins (${id})?`,
  status: kind ? "measured" : "not_enough_data",
  headline: `Template A leads (${id})`,
  winner: "A",
  crowned: kind === "conclusion",
  ...(kind ? { verdict: { kind, reason: `A beats B (${id})` } } : {}),
  result: kind ? { display: "$12", unit: "per positive reply", sample: "10 positive replies · 900 people emailed" } : null,
  charts: kind
    ? [
        {
          kind: "bars",
          title: "Cost per positive reply",
          lowerIsBetter: true,
          points: [
            { label: "A", value: 12, display: "$12", note: "10 positive replies · 900 people emailed", thin: false },
            { label: "B", value: 30, display: "$30", note: "4 positive replies · 700 people emailed", thin: false },
          ],
        },
      ]
    : [],
  conclusion: [],
});

export const RESEARCH_FILE_FIXTURE = {
  generatedAt: "2026-10-18T17:00:00.000Z",
  computedAt: "2026-10-18T17:00:00.000Z",
  allOrgs: true,
  costBasis: "user",
  window: { from: "2026-04", to: "2026-10" },
  readOn: "2026-10-18",
  maturation: {
    rule: "run_start",
    days: 21,
    cutoff: "2026-09-27",
    windowEnd: "2026-10-18",
    rules: { reply: { durationDays: 21, outcomesRequired: 1, cutoff: "2026-09-27" }, visit: { durationDays: 21, outcomesRequired: 10, cutoff: "2026-09-27" } },
    note: "A bar is read on the people we started writing to at least 21 days before the read.",
  },
  engines: [
    {
      outcome: "email_sent",
      name: "Email sent",
      measures: [
        {
          id: "email_sent/start/conversation",
          engine: "email_sent",
          startsFrom: null,
          counts: { key: "conversation", name: "Positive reply" },
          description: "Positive reply, from nothing",
        },
      ],
    },
    {
      outcome: "website_visit",
      name: "Website visit",
      measures: [
        {
          id: "website_visit/start/website_visit",
          engine: "website_visit",
          startsFrom: null,
          counts: { key: "website_visit", name: "Website visit" },
          description: "Website visit, from nothing",
        },
      ],
    },
  ],
  outcomes: [],
  studies: [study("s-conclusion", "conclusion"), study("s-signal", "signal"), study("s-noise", "noise"), study("s-none", null)],
  notCarried: [],
} as unknown as ResearchFile;
