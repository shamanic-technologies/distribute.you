export interface ExpertQuote {
  id: string;
  name: string;
  handle: string;
  role: string;
  quote: string;
  sourceLabel: string;
  sourceUrl: string;
  accent: "amber" | "violet" | "blue" | "emerald" | "pink" | "cyan" | "rose";
}

// Real, publicly attributable quotes from builders/thinkers we look up to.
// Not testimonials — public statements relevant to distribution, shipping, persistence.
export const EXPERT_QUOTES: ExpertQuote[] = [
  {
    id: "hormozi-ads",
    name: "Alex Hormozi",
    handle: "@AlexHormozi",
    role: "Acquisition.com",
    quote:
      "Advertising only becomes more expensive. Cost per eyeballs only goes up.",
    sourceLabel: "LinkedIn, 2023",
    sourceUrl:
      "https://www.linkedin.com/posts/alexhormozi_advertising-only-becomes-more-expensive-activity-7097229698849529857-lwQa",
    accent: "amber",
  },
  {
    id: "brunson-funnel",
    name: "Russell Brunson",
    handle: "@russellbrunson",
    role: "Founder, ClickFunnels",
    quote:
      "You're just one funnel away.",
    sourceLabel: "One Funnel Away Challenge",
    sourceUrl:
      "https://marketingsecrets.com/blog/elevate-your-offer-q-a-from-the-one-funnel-away-challenge",
    accent: "violet",
  },
  {
    id: "musk-important",
    name: "Elon Musk",
    handle: "@elonmusk",
    role: "CEO, Tesla & SpaceX",
    quote:
      "If something is important enough, even if the odds are against you, you should still do it.",
    sourceLabel: "Interview, 2013",
    sourceUrl:
      "https://quotefancy.com/quote/1338753/Elon-Musk-If-something-is-important-enough-you-should-try-even-if-the-probable-outcome-is",
    accent: "blue",
  },
  {
    id: "jobs-ship",
    name: "Steve Jobs",
    handle: "@apple",
    role: "Co-founder, Apple",
    quote: "Real artists ship.",
    sourceLabel: "Mac team retreat, Jan 1983",
    sourceUrl: "https://quoteinvestigator.com/2018/10/13/ship/",
    accent: "rose",
  },
  {
    id: "hassabis-foothills",
    name: "Demis Hassabis",
    handle: "@demishassabis",
    role: "CEO, Google DeepMind",
    quote:
      "We're at the foothills of the singularity. Agents are starting to work, coding is starting to work properly.",
    sourceLabel: "Google I/O, 2026",
    sourceUrl:
      "https://www.semafor.com/article/05/20/2026/google-exec-demis-hassabis-predicts-were-at-the-foothills-of-the-singularity",
    accent: "emerald",
  },
  {
    id: "sinek-why",
    name: "Simon Sinek",
    handle: "@simonsinek",
    role: "Author, Start With Why",
    quote:
      "People don't buy what you do; they buy why you do it.",
    sourceLabel: "TED Talk, 2009",
    sourceUrl:
      "https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action",
    accent: "cyan",
  },
  {
    id: "robbins-action",
    name: "Tony Robbins",
    handle: "@TonyRobbins",
    role: "Author, Awaken the Giant Within",
    quote:
      "The path to success is to take massive, determined action.",
    sourceLabel: "Awaken the Giant Within",
    sourceUrl: "https://www.tonyrobbins.com/blog/how-to-make-a-massive-action-plan-map",
    accent: "pink",
  },
];
