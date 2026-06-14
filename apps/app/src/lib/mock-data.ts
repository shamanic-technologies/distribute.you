/* ───────────────────────────────────────────────
   Mock data — ported 1:1 from the "Distribute dashboard 2" maquette.
   UI-only sandbox: no backend, no API. Edit freely while iterating.
   ─────────────────────────────────────────────── */

export type LeadStatus = "sent" | "opened" | "replied" | "bounced";

export interface Lead {
  id: number;
  company: string;
  initials: string;
  contact: string;
  role: string;
  status: LeadStatus;
  date: string;
  cost: string;
  preview: string | null;
  emailSent: string;
  reply?: string;
}

export const LEADS: Lead[] = [
  {
    id: 1, company: "Eventilla", initials: "EV", contact: "Pekka Huttunen", role: "CEO", status: "replied", date: "Jun 7", cost: "$0.036",
    preview: "Thanks for reaching out, I'd love to chat...",
    emailSent: `Hi Pekka,\n\nI noticed Eventilla is growing fast in the events space. I wanted to share how prompthub.ai has helped SaaS teams like yours cut AI prompt iteration time by 60%.\n\nWe've helped 3 other event-tech founders go from 0 to their first 50 paying customers in under 6 weeks through automated outreach.\n\nWould you be open to a quick 15-minute call this week?`,
    reply: `Hi,\n\nThanks for reaching out, I'd love to chat about this. We've been looking for exactly something like this for our AI-assisted event planning feature.\n\nWhen are you free this week?`,
  },
  {
    id: 2, company: "ColorID", initials: "CI", contact: "Gary Smith", role: "Founder", status: "opened", date: "Jun 7", cost: "$0.036", preview: null,
    emailSent: `Hi Gary,\n\nI came across ColorID and was impressed by your approach to design tooling. Founders building in the AI space are seeing strong results with automated outreach right now.\n\npromhub.ai helps teams like yours get qualified leads in Gmail at $1.42 per reply on average. No subscription, no setup.\n\nWorth a quick look?`,
  },
  {
    id: 3, company: "McCorkell", initials: "MC", contact: "Scott McCorkell", role: "Co-founder", status: "replied", date: "Jun 6", cost: "$0.036",
    preview: "Interesting timing, we've been looking at...",
    emailSent: `Hi Scott,\n\nI noticed McCorkell is hiring for growth roles, which usually means outbound is becoming a priority. prompthub.ai automates the whole stack: lead enrichment, personalized emails, and qualified-reply forwarding to Gmail.\n\n$25 gets you started, no subscription. Would love to show you what it looks like for a SaaS like yours.`,
    reply: `Interesting timing, we've been looking at tools in this space. Currently evaluating 2-3 options. Can you send over a quick breakdown of how the pricing works in practice?`,
  },
  {
    id: 4, company: "Builders of Authority", initials: "BA", contact: "Adam McChesney", role: "CEO", status: "opened", date: "Jun 6", cost: "$0.036", preview: null,
    emailSent: `Hi Adam,\n\nBuilders of Authority caught my eye — the community angle for B2B authority building is smart. AI-assisted outreach is the natural complement to what you're doing.\n\npromhub.ai: drop your URL, set a budget, get qualified leads in Gmail. $1.42 avg per reply.\n\nOpen to a demo?`,
  },
  {
    id: 5, company: "GlobalQuark", initials: "GQ", contact: "Alfredo Godoy", role: "Founder", status: "sent", date: "Jun 6", cost: "$0.036", preview: null,
    emailSent: `Hi Alfredo,\n\nI came across GlobalQuark while researching AI infrastructure tooling. Your positioning is solid — and outbound is still one of the fastest ways to get your first 50 customers.\n\nWe run automated cold outreach for solo founders: personalized emails, qualified replies forwarded to Gmail, $25 to start.\n\nWorth 15 minutes?`,
  },
  {
    id: 6, company: "Promptbase", initials: "PB", contact: "Jake Williams", role: "CTO", status: "sent", date: "Jun 5", cost: "$0.036", preview: null,
    emailSent: `Hi Jake,\n\nNoticed Promptbase is growing its marketplace — that kind of traction usually means you're thinking about how to accelerate acquisition.\n\npromhub.ai does the whole outbound stack automatically: finds your ICP, writes personalized emails, forwards positive replies to Gmail. Pay per send.\n\nOpen to a quick look?`,
  },
  {
    id: 7, company: "Typeframe", initials: "TF", contact: "Maria Santos", role: "Founder", status: "opened", date: "Jun 5", cost: "$0.036", preview: null,
    emailSent: `Hi Maria,\n\nTypeframe's positioning in the video creation space is smart — the demand is clearly there. I wanted to reach out because founders in creative-tool SaaS are seeing strong results with automated outreach right now.\n\n$1.42 average per qualified reply, no subscription. Want to see how it works?`,
  },
  {
    id: 8, company: "Loopify", initials: "LO", contact: "Marcus Chen", role: "CEO", status: "bounced", date: "Jun 4", cost: "$0.000", preview: null,
    emailSent: "",
  },
  {
    id: 9, company: "Notionize", initials: "NO", contact: "Sarah Park", role: "Founder", status: "replied", date: "Jun 3", cost: "$0.036",
    preview: "We've been looking for exactly this...",
    emailSent: `Hi Sarah,\n\nI noticed Notionize is gaining traction in the productivity space. Founders at your stage usually need more distribution, not more product.\n\npromhub.ai automates cold outreach end to end: finds leads, writes emails, sends, forwards qualified replies to Gmail. $25 to start.\n\nIs outbound on your radar?`,
    reply: `Hi,\n\nYes actually — we've been looking for exactly this. We tried setting up Apollo + Instantly ourselves and it took 3 weeks to get any results. If this is genuinely plug-and-play I'd love to see it.\n\nSending you a calendar link.`,
  },
  {
    id: 10, company: "Supaforms", initials: "SF", contact: "Tom Bakker", role: "CEO", status: "sent", date: "Jun 3", cost: "$0.036", preview: null,
    emailSent: `Hi Tom,\n\nSupaforms caught my attention — the no-code form market is competitive but you have a clear positioning edge. Getting your ICP in front of the right people faster could be the difference.\n\nWe handle the full outbound stack automatically. Drop your URL, set a budget, get replies in Gmail. $1.42 avg per reply.\n\nWorth exploring?`,
  },
];

export interface ChartPoint {
  label: string;
  sent: number;
  opened: number;
  replied: number;
}

export const CHART_DATA: ChartPoint[] = [
  { label: "Jun 1", sent: 30, opened: 11, replied: 0 },
  { label: "Jun 2", sent: 35, opened: 13, replied: 1 },
  { label: "Jun 3", sent: 38, opened: 15, replied: 2 },
  { label: "Jun 4", sent: 32, opened: 12, replied: 0 },
  { label: "Jun 5", sent: 36, opened: 14, replied: 1 },
  { label: "Jun 6", sent: 42, opened: 16, replied: 1 },
  { label: "Jun 7", sent: 34, opened: 12, replied: 0 },
];

export interface BudgetPlan {
  daily: number;
  emails: number;
  visits: number;
  meetings: number;
  closes: number;
  revenue: number;
}

export const BUDGET_PLANS: Record<string, BudgetPlan> = {
  starter:     { daily: 29,  emails: 806,  visits: 55,  meetings: 11, closes: 5,  revenue: 12507 },
  recommended: { daily: 58,  emails: 1611, visits: 111, meetings: 22, closes: 10, revenue: 24999 },
  growth:      { daily: 115, emails: 3194, visits: 220, meetings: 44, closes: 20, revenue: 49999 },
};

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
  { id: 1, name: "SaaS founders — cold outreach", status: "live",   budgetPerDay: 58, leadIds: [1, 2, 3, 4, 9, 10] },
  { id: 2, name: "AI teams — LinkedIn scrape",    status: "live",   budgetPerDay: 29, leadIds: [5, 6, 11] },
  { id: 3, name: "Startup CTOs — newsletter",     status: "paused", budgetPerDay: 0,  leadIds: [7, 8, 12] },
];

export interface SequenceStep {
  day: string;
  tag: string;
  subject: string;
  body: string;
}

/** Day-0/4/9 cold email sequence shown on the Campaign tab. */
export const EMAIL_SEQUENCE: SequenceStep[] = [
  {
    day: "Day 0", tag: "Initial outreach",
    subject: "Quick question about {company}",
    body: "Hi {first_name}, I noticed {company} is focused on AI-assisted workflows. I wanted to share how prompthub.ai has helped teams like yours cut prompt iteration time by 60% — we've helped 3 other SaaS companies in your space go from 0 to 50 paying customers in under 6 weeks. Would you be open to a quick 15-minute call this week?",
  },
  {
    day: "Day 4", tag: "Follow-up",
    subject: "Re: prompt iteration at {company}",
    body: "Hi {first_name}, just wanted to follow up. A lot of teams building with LLMs are losing time to inconsistent prompts across engineers — prompthub.ai solves that with a shared, versioned library. Happy to send you a 2-minute walkthrough if it'd be useful.",
  },
  {
    day: "Day 9", tag: "Final touch",
    subject: "Last reach — worth 15 min?",
    body: "Hi {first_name}, I know timing isn't always right. If building a shared prompt library is on {company}'s roadmap, I'd love to show you prompthub.ai in 15 minutes. No pressure either way — just wanted to make sure this landed.",
  },
];
