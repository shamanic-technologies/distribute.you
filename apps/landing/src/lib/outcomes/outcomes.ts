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
  // The landing exposes ONLY the two OBSERVED outcomes (website visits +
  // positive replies) — the ones distribute measures from its own sending
  // inboxes. The projected outcomes (meetings, signups) are client-reported and
  // no longer rendered here. The "meetingBooked" / "signup" objectives stay in
  // the union above for the legacy __TICKER_CPM__ scalar (static-html.ts); re-add
  // an entry here to expose a page again.
];

export function getOutcome(slug: string): OutcomeDef | undefined {
  return OUTCOMES.find((o) => o.slug === slug);
}
