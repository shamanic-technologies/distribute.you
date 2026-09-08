import { SITE, breadcrumb, docPage } from "../v2-shell";

const DESCRIPTION =
  "One address reaches the people who build distribute.you. Support, starting a campaign, press and brand assets, and the registered company details.";

/** `/contact`: where to write and what to put in the first message. */
export function renderContactPage(): string {
  return docPage({
    title: "Contact distribute.you: support, sales and press",
    description: DESCRIPTION,
    path: "/contact",
    eyebrow: "Contact",
    h1: "Write to us.<br>A person reads it.",
    lead: "There is one address, and the people answering it are the people building the product. We do not run a phone queue and we are not going to pretend otherwise.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contact distribute.you",
        url: `${SITE}/contact`,
        description: DESCRIPTION,
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Contact", path: "/contact" },
      ]),
    ],
    sections: [
      {
        id: "where",
        h2: "Where to write",
        tint: true,
        html: `<p><strong>Everything:</strong> <a href="mailto:support@distribute.you">support@distribute.you</a>. Support, billing, a question about a campaign that is already running, a security report, a partnership, or a request to delete your data. It all lands in the same place and it all gets read.</p>
<p><strong>Building on the API:</strong> the base URL, the OpenAPI document, how a key authenticates, the MCP server and the CLI are all on the <a href="/developers">developer resources page</a>. Write to the same address if something there is missing or wrong.</p>
<p><strong>Press and brand assets:</strong> the logo, the mark, the colours and the usage rules are on the <a href="/brand">brand page</a>, so you can take what you need without waiting on a reply. For anything the page does not cover, write to the same address with "press" in the subject line.</p>
<p><strong>Starting a campaign:</strong> you do not need us for that. Drop your website at <a href="https://dashboard.distribute.you/sign-up">dashboard.distribute.you/sign-up</a> and set a daily budget. If you would rather not touch the software at all, send us the website by email and we set the campaign up for you at the same price.</p>`,
      },
      {
        id: "first-message",
        h2: "What to put in the first message",
        html: `<p>If you are asking about a live campaign, the brand name or the website is enough for us to find it. If something looks wrong with a number, tell us which page you were on and what you expected instead, because most of what we show is computed from your own spend and it is faster to check the exact figure you are looking at.</p>
<p>If you are asking whether this fits your business, the useful things to say are what you sell, roughly who buys it, and what a customer is worth to you over their lifetime. That last number is what decides whether the arithmetic works, and we would rather tell you it does not than take a budget that cannot pay you back.</p>`,
      },
      {
        id: "company",
        h2: "The company behind it",
        tint: true,
        html: `<p>distribute.you is operated by Blooming Generation (SIREN 882102775), registered at 285 rue de l'&Eacute;glise, 46140 Douelle, France. What we do and how the billing works are set out on the <a href="/about">about page</a>. The legal detail is in the <a href="/terms">terms of service</a> and the <a href="/privacy">privacy policy</a>.</p>`,
      },
    ],
  });
}
