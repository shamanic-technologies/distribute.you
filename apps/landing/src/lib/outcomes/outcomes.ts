// The four public outcome detail pages (/outcomes/<slug>). `objective` is the
// canonical camelCase the features-service public cost-per-outcome endpoints
// accept. `measuredByUs`: website visits (clicks) + positive replies are
// OBSERVED by distribute from our own sending inboxes; meetings + signups are
// client-reported (they happen on the client's side), so they vary more.

export type OutcomeObjective =
  | "websiteVisit"
  | "positiveReply"
  | "meetingBooked"
  | "signup";

export interface OutcomeDef {
  slug: string;
  objective: OutcomeObjective;
  sym: string;
  label: string;
  noun: string;
  nounPlural: string;
  measuredByUs: boolean;
  tagline: string;
  howItWorks: string;
  howWeTrack: string;
}

export const OUTCOMES: OutcomeDef[] = [
  {
    slug: "website-visits",
    objective: "websiteVisit",
    sym: "WEB",
    label: "Website visits",
    noun: "website visit",
    nounPlural: "website visits",
    measuredByUs: true,
    tagline: "What a real click costs, averaged across every brand we run.",
    howItWorks:
      "A website visit is a prospect clicking the link in one of our emails and landing on your site. It is the top of the funnel and the cheapest outcome to buy, so a small daily budget already buys a steady stream of them.",
    howWeTrack:
      "We measure this ourselves. The link in every email we send is tracked, so a website visit is a real click we recorded from our own sending inboxes, not a number reported back to us.",
  },
  {
    slug: "positive-replies",
    objective: "positiveReply",
    sym: "POS",
    label: "Positive reply for a sales meeting",
    noun: "positive reply",
    nounPlural: "positive replies",
    measuredByUs: true,
    tagline: "What a qualified, meeting-ready reply costs.",
    howItWorks:
      "A positive reply is a prospect answering with real interest, ready to talk about a sales meeting. It sits deeper in the funnel than a click, so it costs more, but each one is a live conversation you can turn into a deal.",
    howWeTrack:
      "We measure this ourselves. Replies land in our inboxes first. We read and qualify every one, and only count it as positive when the prospect shows real buying interest.",
  },
  {
    slug: "meetings-booked",
    objective: "meetingBooked",
    sym: "MEE",
    label: "Meeting booked",
    noun: "meeting",
    nounPlural: "meetings",
    measuredByUs: false,
    tagline: "What a booked sales meeting costs.",
    howItWorks:
      "A booked meeting is a prospect on your calendar, ready for a sales call. It is the outcome closest to revenue, and it depends on your offer and your sales follow-up as much as on the outreach.",
    howWeTrack:
      "This one is reported by you. A meeting is booked in your calendar and your CRM, not in our inbox, so the number comes from your funnel. Expect it to move more from one brand to the next than the outcomes we measure directly.",
  },
  {
    slug: "signups",
    objective: "signup",
    sym: "SIG",
    label: "Signup",
    noun: "signup",
    nounPlural: "signups",
    measuredByUs: false,
    tagline: "What a new signup or trial costs.",
    howItWorks:
      "A signup is a prospect we contacted starting a trial or creating an account. It is a self-serve outcome that fits product-led offers, where the prospect can act without a sales call.",
    howWeTrack:
      "This one is reported by you. Signups happen inside your product, so we rely on the conversion you report. Expect more variation here than on the outcomes we track from our own inboxes.",
  },
];

export function getOutcome(slug: string): OutcomeDef | undefined {
  return OUTCOMES.find((o) => o.slug === slug);
}
