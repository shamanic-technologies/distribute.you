import { SITE, breadcrumb, docPage } from "../v2-shell";

const DESCRIPTION =
  "Revenue made easy. Our AI agent finds your buyers, writes to them and books your meetings. Open source, free for one user, at the API price with 0% markup.";

/** `/about`: what we sell, who runs it and how it is paid for. */
export function renderAboutPage(): string {
  return docPage({
    title: "About distribute.you: done-for-you revenue automation that shows you the cost",
    description: DESCRIPTION,
    path: "/about",
    eyebrow: "About",
    h1: "We run the acquisition,<br>and we show you the cost.",
    lead: "distribute.you does done-for-you revenue automation. You give our AI agent a website and a budget cap. The agent picks the buyers, writes the emails, sends them from our own domains, answers every interested reply until a meeting is booked, and shows you what each one cost.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About distribute.you",
        url: `${SITE}/about`,
        description: DESCRIPTION,
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "About", path: "/about" },
      ]),
    ],
    sections: [
      {
        id: "sell",
        h2: "What we sell",
        tint: true,
        html: `<p>We sell revenue: booked meetings, signups and buyers who want to talk. You get it two ways. Our AI agent runs it for you at the API price. Our <a href="/gtm-agency">GTM agency</a> runs your whole go-to-market for you, from $1K a month plus 10% of your budget.</p>
<p>Under the hood the engine tests your offers, your email templates, the AI models writing them and your audiences against each other and ranks them by return, so the budget moves toward the combination that pays. You keep the ones that work.</p>
<p>The AI agent talks to you on WhatsApp, like an agency would. The dashboard is optional. If you never want to log in, send us your website and we set the whole thing up at the same price. Interested replies land in the inbox you already read.</p>
<p>The agent is open source under the MIT license, at <a href="https://github.com/distribute-you/gtm-factory">github.com/distribute-you/gtm-factory</a>. Run it on your own server with your own API keys, and your data stays in your own database.</p>`,
      },
      {
        id: "behalf",
        h2: "We send on your behalf, from our own domains",
        html: `<p>Every email goes out from a domain and a mailbox we own and warm. Your own domain never touches cold outreach, so whatever happens to sender reputation happens to ours. There is no DNS record to add and no warmup to babysit.</p>
<p>Replies arrive with us first. We read them, qualify them, answer the interested ones until a meeting is on your calendar, and forward what is worth your time. You still see everything: who we contacted, who replied, and what they said, including the people who said no.</p>
<p>For a small or sensitive market we can test the demand before we name you, then hand over the prospects who leaned in. You get to find out whether the need is real without spending your brand on the answer.</p>`,
      },
      {
        id: "pay",
        h2: "How you pay",
        tint: true,
        html: `<p>The AI agent is free for one user, and $9 per user each month for a team. Each action is billed at the vendor's API price with 0% markup, read live on the <a href="/catalog">catalog</a>. You start with a $10 top-up, and automatic reload keeps the balance going. You choose how much goes to your outreach, and you can pause or cancel anytime.</p>
<p>The <a href="/gtm-agency">GTM agency</a> is from $1K a month plus 10% of the budget you put into your campaigns. Book a call and we take it from there.</p>
<p>Published market rates for the alternatives are the reason this is worth reading twice. An outsourced agency runs $1,500 to $5,000 a month plus $80 to $200 per qualified reply. An in-house SDR runs $4,000 to $7,000 a month plus $50 to $120, and takes three to six months to ramp. A booked meeting bought on the open market runs about $700.</p>`,
      },
      {
        id: "guarantee",
        h2: "What we guarantee, and what we do not",
        html: `<p>We do not guarantee results. Nobody who is honest about outbound can. What we guarantee is the measurement: the real cost of every outcome stays visible, the full picture stays visible including the replies that went badly, your spend stays under a cap you set, and you can pause at any moment.</p>
<p>We publish our own numbers rather than describing them. The engaged leads the fleet produced and their median cost are on the <a href="/">homepage</a>, read live from every client account. The same figures come out of the API, which is documented on the <a href="/developers">developer resources page</a> along with the MCP server and the CLI.</p>`,
      },
      {
        id: "who",
        h2: "Who we are",
        tint: true,
        html: `<p>distribute.you is operated by Blooming Generation (SIREN 882102775), registered at 285 rue de l'&Eacute;glise, 46140 Douelle, France. We are a small team and the people who answer support are the people who build the product.</p>
<p>One address reaches us: <a href="mailto:support@distribute.you">support@distribute.you</a>. More ways to get in touch, and what to put in the first message, are on the <a href="/contact">contact page</a>.</p>`,
      },
    ],
  });
}
