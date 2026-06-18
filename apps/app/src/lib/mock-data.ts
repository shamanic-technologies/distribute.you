/* ───────────────────────────────────────────────
   Mock data — UI-only sandbox: no backend, no API.
   Channel-agnostic: the platform finds leads and drives outcomes
   (signups / meetings / purchases) regardless of channel.
   Edit freely while iterating.
   ─────────────────────────────────────────────── */

/* ───────────────────────────────────────────────
   Probabilistic pipeline. Only two things are MEASURED for sure:
   website visits and positive replies. Everything downstream
   (signup / purchase / meeting) is inferred with a probability
   until manually confirmed, and decays to 0 once it goes stale.
   ─────────────────────────────────────────────── */

export type Funnel = "website" | "meeting";

// Lifecycle stages.
//  website funnel:  visited → signed-up → purchased
//  meeting funnel:  replied → meeting-booked
export type Stage = "visited" | "signed-up" | "purchased" | "replied" | "meeting-booked";

export const STAGE_META: Record<Stage, { label: string; tone: "accent" | "amber" | "purple" | "green" }> = {
  visited: { label: "Visited website", tone: "accent" },
  "signed-up": { label: "Signed up", tone: "green" },
  purchased: { label: "Purchased", tone: "green" },
  replied: { label: "Positive reply", tone: "amber" },
  "meeting-booked": { label: "Meeting booked", tone: "purple" },
};

export interface PipeEvent {
  ts: string;      // human label, finest granularity (e.g. "Jun 7 · 14:02")
  label: string;
  tone?: "accent" | "amber" | "purple" | "green" | "muted";
}

export interface PipeLead {
  id: number;
  company: string;
  initials: string;
  contact: string;
  funnel: Funnel;
  stage: Stage;
  value: number;   // pipeline revenue once confirmed
  prob: number;    // 0..1 probability the entry stage converts to the terminal stage
  daysAgo: number; // days since the measured signal (visit / reply) or the signup
  events: PipeEvent[]; // newest first
}

/** Aggregate headline counts shown in the sidebar + KPI strip. */
export const OUTCOME_TOTALS = { signups: 312, meetings: 84, purchases: 67, pipelineRevenue: 343325 };

const ev = (ts: string, label: string, tone?: PipeEvent["tone"]): PipeEvent => ({ ts, label, tone });

export const PIPELINE: PipeLead[] = [
  // ── Website funnel ──
  {
    id: 1, company: "Eventilla", initials: "EV", contact: "Pekka Huttunen", funnel: "website",
    stage: "purchased", value: 1400, prob: 1, daysAgo: 1,
    events: [
      ev("Jun 7 · 16:40", "Purchased — Pro annual", "green"),
      ev("Jun 6 · 09:14", "Signed up", "green"),
      ev("Jun 5 · 11:22", "Viewed pricing page", "muted"),
      ev("Jun 5 · 11:19", "Visited website", "accent"),
    ],
  },
  {
    id: 2, company: "McCorkell", initials: "MC", contact: "Scott McCorkell", funnel: "website",
    stage: "signed-up", value: 1400, prob: 0.34, daysAgo: 2,
    events: [
      ev("Jun 6 · 10:02", "Signed up", "green"),
      ev("Jun 6 · 09:58", "Viewed pricing page", "muted"),
      ev("Jun 6 · 09:51", "Visited website", "accent"),
    ],
  },
  {
    id: 3, company: "Promptbase", initials: "PB", contact: "Jake Williams", funnel: "website",
    stage: "visited", value: 120, prob: 0.41, daysAgo: 3,
    events: [
      ev("Jun 5 · 18:30", "Viewed docs", "muted"),
      ev("Jun 5 · 18:24", "Visited website", "accent"),
    ],
  },
  {
    id: 4, company: "Supaforms", initials: "SF", contact: "Tom Bakker", funnel: "website",
    stage: "visited", value: 120, prob: 0.22, daysAgo: 6,
    events: [
      ev("Jun 2 · 08:11", "Visited website", "accent"),
    ],
  },
  {
    id: 5, company: "GlobalQuark", initials: "GQ", contact: "Alfredo Godoy", funnel: "website",
    stage: "purchased", value: 1400, prob: 1, daysAgo: 2,
    events: [
      ev("Jun 6 · 13:05", "Purchased — Team plan", "green"),
      ev("Jun 4 · 15:40", "Signed up", "green"),
      ev("Jun 4 · 15:31", "Visited website", "accent"),
    ],
  },
  {
    id: 6, company: "Cohortly", initials: "CO", contact: "Diego Lima", funnel: "website",
    stage: "signed-up", value: 1400, prob: 0.28, daysAgo: 5,
    events: [
      ev("Jun 3 · 12:00", "Signed up", "green"),
      ev("Jun 3 · 11:52", "Visited website", "accent"),
    ],
  },
  {
    id: 7, company: "Loopify", initials: "LO", contact: "Marcus Chen", funnel: "website",
    stage: "visited", value: 120, prob: 0, daysAgo: 19, // stale: visited > 14d, no signup
    events: [
      ev("May 25 · 07:44", "Visited website", "accent"),
    ],
  },
  {
    id: 8, company: "Typeframe", initials: "TF", contact: "Maria Santos", funnel: "website",
    stage: "signed-up", value: 1400, prob: 0, daysAgo: 190, // stale: signed-up > 6mo, no purchase
    events: [
      ev("Dec 4 · 10:20", "Signed up", "green"),
      ev("Dec 4 · 10:12", "Visited website", "accent"),
    ],
  },
  // ── Meeting funnel ──
  {
    id: 9, company: "ColorID", initials: "CI", contact: "Gary Smith", funnel: "meeting",
    stage: "meeting-booked", value: 480, prob: 1, daysAgo: 1,
    events: [
      ev("Jun 7 · 14:20", "Meeting booked — Jun 11, 3pm", "purple"),
      ev("Jun 7 · 09:03", "Positive reply received", "amber"),
      ev("Jun 6 · 16:00", "Email opened", "muted"),
      ev("Jun 5 · 08:30", "Email sent", "muted"),
    ],
  },
  {
    id: 10, company: "Builders of Auth.", initials: "BA", contact: "Adam McChesney", funnel: "meeting",
    stage: "replied", value: 480, prob: 0.47, daysAgo: 2,
    events: [
      ev("Jun 6 · 11:48", "Positive reply received", "amber"),
      ev("Jun 5 · 19:10", "Email opened", "muted"),
      ev("Jun 4 · 08:30", "Email sent", "muted"),
    ],
  },
  {
    id: 11, company: "Stackr", initials: "ST", contact: "Nina Roth", funnel: "meeting",
    stage: "replied", value: 480, prob: 0.31, daysAgo: 8,
    events: [
      ev("May 31 · 10:05", "Positive reply received", "amber"),
      ev("May 30 · 14:22", "Email opened", "muted"),
      ev("May 29 · 08:30", "Email sent", "muted"),
    ],
  },
  {
    id: 12, company: "Notionize", initials: "NO", contact: "Sarah Park", funnel: "meeting",
    stage: "replied", value: 480, prob: 0, daysAgo: 38, // stale: reply > 1mo, no meeting
    events: [
      ev("May 1 · 09:15", "Positive reply received", "amber"),
      ev("Apr 30 · 13:00", "Email opened", "muted"),
      ev("Apr 29 · 08:30", "Email sent", "muted"),
    ],
  },
];

/* ───────────────────────────────────────────────
   Mock campaigns
   ─────────────────────────────────────────────── */
export interface MockCampaign {
  id: number;
  name: string;
  status: "live" | "paused";
  budgetPerDay: number;
  leadIds: number[]; // which pipeline leads belong to this campaign
}

export const MOCK_CAMPAIGNS: MockCampaign[] = [
  { id: 1, name: "SaaS founders — North America",  status: "live",   budgetPerDay: 58, leadIds: [1, 2, 3, 4, 9, 10] },
  { id: 2, name: "AI / ML teams — expansion",      status: "live",   budgetPerDay: 29, leadIds: [5, 6, 11] },
  { id: 3, name: "Early-stage CTOs — pipeline",    status: "paused", budgetPerDay: 0,  leadIds: [7, 8, 12] },
];
