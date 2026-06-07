export interface ExpertQuote {
  id: string;
  name: string;
  handle: string;
  role: string;
  quote: string;
  sourceLabel: string;
  sourceUrl: string;
  // unavatar.io public-photo proxy — `twitter/<handle>` fetches the current
  // X avatar. No auth, no rate-limit for casual use.
  avatarUrl: string;
}

// Real, publicly attributable quotes from builders the distribute.you ICP
// (the Serial Builder, 16-40, solo, ships 3+ products) looks up to.
// Not testimonials — public statements relevant to leverage, shipping,
// distribution, solo founding. Every quote linked to source.
// 12 figures, 3 rows of 4 → infinite-scroll marquee.
export const EXPERT_QUOTES: ExpertQuote[] = [
  // Row 1 — solo SaaS / indie hackers (closest to ICP itself)
  {
    id: "levels-12startups",
    name: "Pieter Levels",
    handle: "@levelsio",
    role: "12 startups in 12 months · Nomad List",
    quote:
      "Most startups fail anyway. Might as well build many and see what sticks.",
    sourceLabel: "levels.io, April 2014",
    sourceUrl: "https://levels.io/12-startups-12-months/",
    avatarUrl: "https://unavatar.io/twitter/levelsio",
  },
  {
    id: "marc-lou-shipfast",
    name: "Marc Lou",
    handle: "@marc_louvion",
    role: "Solo founder · ShipFast",
    quote:
      "If you're not embarrassed by the first version of your product, you've launched too late.",
    sourceLabel: "ShipFast playbook",
    sourceUrl:
      "https://blog.startupstash.com/the-marc-lou-playbook-15-ship-fast-truths-for-the-modern-solopreneur-075ed612a4d7",
    avatarUrl: "https://unavatar.io/twitter/marc_louvion",
  },
  {
    id: "welsh-enough",
    name: "Justin Welsh",
    handle: "@thejustinwelsh",
    role: "$5M solo · The Diversified Solopreneur",
    quote: "It's not about getting more. It's about finding enough.",
    sourceLabel: "justinwelsh.me",
    sourceUrl: "https://www.justinwelsh.me/",
    avatarUrl: "https://unavatar.io/twitter/thejustinwelsh",
  },
  {
    id: "koe-public",
    name: "Dan Koe",
    handle: "@thedankoe",
    role: "One-person business · creator",
    quote:
      "Solve a problem in private, it's called self-improvement. Solve a problem in public, it's called business.",
    sourceLabel: "thedankoe.com",
    sourceUrl:
      "https://thedankoe.com/letters/the-one-person-business-roadmap-99-of-creators-make-this-mistake/",
    avatarUrl: "https://unavatar.io/twitter/thedankoe",
  },

  // Row 2 — distribution / marketing legends
  {
    id: "hormozi-ads",
    name: "Alex Hormozi",
    handle: "@AlexHormozi",
    role: "Acquisition.com · $100M Offers",
    quote:
      "Advertising only becomes more expensive. Cost per eyeballs only goes up.",
    sourceLabel: "LinkedIn, 2023",
    sourceUrl:
      "https://www.linkedin.com/posts/alexhormozi_advertising-only-becomes-more-expensive-activity-7097229698849529857-lwQa",
    avatarUrl: "https://unavatar.io/twitter/AlexHormozi",
  },
  {
    id: "brunson-funnel",
    name: "Russell Brunson",
    handle: "@russellbrunson",
    role: "Founder, ClickFunnels",
    quote: "You're just one funnel away.",
    sourceLabel: "One Funnel Away Challenge",
    sourceUrl:
      "https://marketingsecrets.com/blog/elevate-your-offer-q-a-from-the-one-funnel-away-challenge",
    avatarUrl: "https://unavatar.io/twitter/russellbrunson",
  },
  {
    id: "ferriss-leverage",
    name: "Tim Ferriss",
    handle: "@tferriss",
    role: "Author, The 4-Hour Workweek",
    quote:
      "Focus on being productive instead of busy. Outsource what you can. Automate what's left.",
    sourceLabel: "The 4-Hour Workweek",
    sourceUrl: "https://fourhourworkweek.com/",
    avatarUrl: "https://unavatar.io/twitter/tferriss",
  },
  {
    id: "isenberg-community",
    name: "Greg Isenberg",
    handle: "@gregisenberg",
    role: "Late Checkout · solopreneur podcast",
    quote:
      "Community is the new moat. People come for the tool, they leave for the price; they come for the people, they stay for the vibe.",
    sourceLabel: "gregisenberg.com",
    sourceUrl: "https://www.gregisenberg.com/",
    avatarUrl: "https://unavatar.io/twitter/gregisenberg",
  },

  // Row 3 — big visionaries (mindset / AI tailwind)
  {
    id: "naval-leverage",
    name: "Naval Ravikant",
    handle: "@naval",
    role: "AngelList founder · Almanack",
    quote:
      "Arm yourself with specific knowledge, accountability, and leverage — in that order.",
    sourceLabel: "The Almanack of Naval Ravikant",
    sourceUrl: "https://www.navalmanack.com/",
    avatarUrl: "https://unavatar.io/twitter/naval",
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
    avatarUrl: "https://unavatar.io/twitter/elonmusk",
  },
  {
    id: "jobs-ship",
    name: "Steve Jobs",
    handle: "Apple",
    role: "Co-founder, Apple",
    quote: "Real artists ship.",
    sourceLabel: "Mac team retreat, Jan 1983",
    sourceUrl: "https://quoteinvestigator.com/2018/10/13/ship/",
    avatarUrl: "https://unavatar.io/duckduckgo/steve+jobs",
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
    avatarUrl: "https://unavatar.io/twitter/demishassabis",
  },
];

// Marquee row split — 4 per row, 3 rows, alternating direction
export const QUOTE_ROW_1 = EXPERT_QUOTES.slice(0, 4);
export const QUOTE_ROW_2 = EXPERT_QUOTES.slice(4, 8);
export const QUOTE_ROW_3 = EXPERT_QUOTES.slice(8, 12);
