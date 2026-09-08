import { SITE, breadcrumb, docPage } from "../v2-shell";

const DESCRIPTION =
  "Everything distribute.you publishes for a program to read: the REST API and its OpenAPI document, the MCP server, the CLI, the documentation, and the machine-readable files on this domain.";

/**
 * `/developers`: every developer surface, at an address that does not move. Every
 * value a reader pastes (the header, the key prefix, the package name, the tool list)
 * is checked against the deployed thing by `developer-discoverability.test.ts`.
 */
export function renderDevelopersPage(): string {
  return docPage({
    title: "distribute.you developer resources: API, MCP server, CLI",
    description: DESCRIPTION,
    path: "/developers",
    eyebrow: "Developers",
    h1: "distribute.you<br>developer resources.",
    lead: "Everything distribute.you publishes for a program to read, at an address that does not move: the REST API and its OpenAPI document, the MCP server, the command line client, and the documentation. Every link on this page is a live URL you can request right now.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@graph": [
          breadcrumb(
            [
              { name: "Home", path: "/" },
              { name: "Developer resources", path: "/developers" },
            ],
            false,
          ),
          {
            "@type": "WebPage",
            name: "distribute.you developer resources",
            url: `${SITE}/developers`,
            description: DESCRIPTION,
            inLanguage: "en",
            isPartOf: { "@type": "WebSite", name: "distribute.you", url: SITE },
          },
          {
            "@type": "WebAPI",
            name: "distribute.you API",
            url: "https://api.distribute.you",
            description:
              "REST API for brands, campaigns, audiences, leads, workflows, runs and billing on distribute.you.",
            documentation: "https://docs.distribute.you/",
            termsOfService: `${SITE}/terms`,
            provider: { "@type": "Organization", name: "distribute.you", url: SITE },
          },
          {
            "@type": "APIReference",
            name: "distribute.you OpenAPI document",
            url: "https://api.distribute.you/openapi.json",
            description:
              "OpenAPI 3.0 description of every distribute.you API operation, served by the API itself.",
            programmingModel: "REST",
            inLanguage: "en",
          },
          {
            "@type": "SoftwareApplication",
            name: "distribute.you MCP server",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Any",
            url: "https://mcp.distribute.you/mcp",
            description:
              "Model Context Protocol server for distribute.you over Streamable HTTP, so an agent can read brands, campaigns and campaign stats on a customer's behalf.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
          {
            "@type": "SoftwareApplication",
            name: "distribute.you CLI",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Any",
            url: "https://www.npmjs.com/package/@distribute.you/cli",
            description:
              "Command line client for the distribute.you API. Prints JSON on stdout and exits non-zero on failure, so it can be driven from a shell or a CI job.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
        ],
      },
    ],
    sections: [
      {
        id: "api",
        h2: "The distribute.you API",
        tint: true,
        html: `<p>The API is the surface everything else is built on. The dashboard, the CLI and the MCP server are all clients of it, so there is nothing they can do that you cannot.</p>
<ul>
<li><a href="https://api.distribute.you">api.distribute.you</a>: the base URL. Every path below is relative to it.</li>
<li><a href="https://api.distribute.you/openapi.json">api.distribute.you/openapi.json</a>: the OpenAPI 3.0 document, served by the API itself rather than kept in a file that drifts. Every operation carries an <code>operationId</code> and a typed response.</li>
<li><a href="https://api.distribute.you/docs">api.distribute.you/docs</a>: the same document as a browsable explorer.</li>
</ul>
<p>Responses carry <code>RateLimit</code>, <code>RateLimit-Policy</code>, <code>RateLimit-Remaining</code> and <code>RateLimit-Reset</code>, and a throttled request answers <code>429</code> with <code>Retry-After</code>. Read those headers rather than guessing at a rate.</p>`,
      },
      {
        id: "auth",
        h2: "Authentication",
        html: `<p>One scheme: an API key sent as a bearer token. The key begins <code>distrib.usr_</code> and carries your organisation and user identity, so there is no second header to set and no org id to pass.</p>
<div class="code-block">curl https://api.distribute.you/v1/brands \\
  -H "Authorization: Bearer distrib.usr_..."</div>
<p>Create a key at <a href="https://dashboard.distribute.you/api-keys">dashboard.distribute.you/api-keys</a>, or from the API itself with <code>POST /v1/api-keys</code>. A key has no expiry, so revoking it in the dashboard is how you end its access.</p>
<p>Two endpoints need no key at all, because the numbers behind them are published: <a href="https://api.distribute.you/v1/costs/platform-prices">/v1/costs/platform-prices</a> is the live unit-cost catalogue we buy at, and <a href="https://api.distribute.you/v1/public/channels">/v1/public/channels</a> is every acquisition channel that can be sold through, with the sales funnels each one supports.</p>`,
      },
      {
        id: "mcp",
        h2: "The distribute.you MCP server",
        tint: true,
        html: `<p>If you are wiring an agent rather than writing a client, connect the Model Context Protocol server instead of the REST API. It is the supported programmatic surface for acting on a customer's behalf.</p>
<ul>
<li><a href="https://mcp.distribute.you/mcp">mcp.distribute.you/mcp</a>: the server endpoint, Streamable HTTP transport, OAuth 2.0.</li>
<li><a href="/.well-known/mcp.json">/.well-known/mcp.json</a>: the descriptor, so a client can find the server from the hostname alone.</li>
<li><a href="https://docs.distribute.you/mcp">docs.distribute.you/mcp</a>: what each tool takes and returns.</li>
</ul>
<p>Six tools today: <code>distribute_status</code> for who the caller is acting as, <code>distribute_list_brands</code>, <code>distribute_list_campaigns</code>, <code>distribute_campaign_stats</code> for outcomes and cost, <code>distribute_list_workflows</code>, and <code>distribute_suggest_icp</code> to draft an ideal customer profile from a website.</p>`,
      },
      {
        id: "cli",
        h2: "The distribute.you CLI",
        html: `<p>From a shell or a CI job the CLI is the shortest path. It authenticates once with an API key, then reads and changes brands, campaigns, leads, audiences, workflows, runs and billing.</p>
<div class="code-block">npx @distribute.you/cli --help</div>
<p>It prints JSON on stdout, JSON on stderr when it fails, and exits non-zero, so it can be driven without parsing prose. <code>distribute ops</code> lists every operation the API has, read from the API itself rather than from a list that can go stale. The package is on npm as <a href="https://www.npmjs.com/package/@distribute.you/cli">@distribute.you/cli</a>.</p>`,
      },
      {
        id: "docs",
        h2: "Documentation",
        tint: true,
        html: `<ul>
<li><a href="https://docs.distribute.you/">docs.distribute.you</a>: the developer documentation.</li>
<li><a href="https://docs.distribute.you/openapi">docs.distribute.you/openapi</a>: the machine-readable entry points, gathered on one page.</li>
<li><a href="https://github.com/shamanic-technologies">github.com/shamanic-technologies</a>: the source.</li>
</ul>`,
      },
      {
        id: "agents",
        h2: "If you are an agent, not a person",
        html: `<p>Start with <a href="/llms.txt">/llms.txt</a>. It says what distribute.you is, when to reach for it, when not to, and lists every surface on this page in a form you do not have to parse out of HTML.</p>
<ul>
<li><a href="/llms.txt">/llms.txt</a>: what this site is and how to call it.</li>
<li><a href="/sitemap.xml">/sitemap.xml</a>: every indexable URL on this domain.</li>
<li><a href="/robots.txt">/robots.txt</a>: the crawler policy. AI training and AI search crawlers are welcome.</li>
</ul>
<p>Every statically served page on this domain also answers as markdown. Send <code>Accept: text/markdown</code> and you get the content without the markup; responses carry <code>Vary: Accept</code>, and a request that accepts neither HTML nor markdown gets a <code>406</code> rather than a document it said it could not read.</p>
<div class="code-block">curl -H "Accept: text/markdown" https://distribute.you/developers</div>`,
      },
      {
        id: "build",
        h2: "What people build on this",
        tint: true,
        html: `<p>The common one is reporting: pull campaign outcomes and their cost into whatever your team already looks at, so the acquisition numbers sit beside the rest of the business instead of in another tab. The figures on the <a href="/">homepage</a> come from the same endpoints.</p>
<p>The other is starting campaigns from somewhere else. If you already know a customer's website, a brand and a campaign can be created without anyone opening the dashboard. How the budget is charged is on the <a href="/#pricing">pricing section</a> of the homepage, and the agency model behind it is on the <a href="/about">about page</a>.</p>
<p>If something here is missing or wrong, write to <a href="mailto:support@distribute.you">support@distribute.you</a>. The people who answer are the people who build it.</p>`,
      },
    ],
  });
}
