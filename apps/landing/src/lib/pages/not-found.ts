import { docPage } from "../v2-shell";

/** The 404 body. Not indexed, no CTA box: it already points everywhere worth going. */
export function renderNotFoundPage(): string {
  return docPage({
    title: "Page not found | distribute.you",
    description: "The address you asked for does not exist on distribute.you.",
    path: "/404",
    eyebrow: "404",
    h1: "That page is not here.",
    lead: "The address you asked for does not exist on distribute.you. Nothing is broken on your side. Below is every part of the site worth trying next.",
    jsonLd: [],
    noindex: true,
    noCta: true,
    sections: [
      {
        id: "instead",
        h2: "Where to go instead",
        tint: true,
        html: `<ul>
<li><a href="/">Home</a>: what we do, what it costs, and the fleet's live figures.</li>
<li><a href="/compare">Comparisons</a>: distribute.you beside every tool a founder shortlists.</li>
<li><a href="/about">About</a>: how the agency and the billing work.</li>
<li><a href="/contact">Contact</a>: one address, read by the team.</li>
<li><a href="/blog">Blog</a>: playbooks and field notes.</li>
</ul>`,
      },
      {
        id: "machine",
        h2: "Looking for a machine-readable map",
        html: `<ul>
<li><a href="/sitemap.xml">/sitemap.xml</a>: every indexable URL on this domain.</li>
<li><a href="/llms.txt">/llms.txt</a>: what this site is, when to use it, and the developer surfaces.</li>
<li><a href="/.well-known/mcp.json">/.well-known/mcp.json</a>: the MCP server descriptor.</li>
<li><a href="/developers">/developers</a>: every developer surface distribute.you publishes, on one page.</li>
<li><a href="https://docs.distribute.you/">docs.distribute.you</a>: the developer documentation.</li>
<li><a href="https://api.distribute.you/openapi.json">api.distribute.you/openapi.json</a>: the public OpenAPI document.</li>
</ul>
<p>Every page on this domain is also served as markdown. Send <code>Accept: text/markdown</code> and you get the content without the markup.</p>`,
      },
    ],
  });
}
