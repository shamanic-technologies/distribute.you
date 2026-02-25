#!/usr/bin/env tsx
/**
 * Generates README.md at the repo root from the shared content SSoT.
 * Run: pnpm generate:readme
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../../");

// Import from source directly (not dist) so we can run without building
import { WORKFLOW_DEFINITIONS } from "../src/workflows.js";
import { LANDING_PRICING, BYOK_COST_ESTIMATES } from "../src/pricing.js";
import { URLS } from "../src/urls.js";
import { BRAND } from "../src/brand.js";

function generateRootReadme(): string {
  const workflowTable = WORKFLOW_DEFINITIONS
    .map((w) => `| ${w.label} | ${w.description} | ${w.category} | ${w.channel} |`)
    .join("\n");

  return `# ${BRAND.name}

**${BRAND.tagline}**

> ${BRAND.hero}

[${URLS.landing.replace("https://", "")}](${URLS.landing}) | [Dashboard](${URLS.dashboard})

## What is ${BRAND.name}?

${BRAND.name} provides Done-For-You (DFY) automation tools via the Model Context Protocol (MCP).

**DFY means:** You provide a URL + budget. We handle everything else - lead finding, content generation, outreach, optimization, and reporting.

**BYOK means:** Bring Your Own Keys. You use your own API keys (OpenAI, Anthropic, Apollo, etc.), so you only pay for what you use. No hidden markups.

## Pricing

**Free · BYOK** — ${LANDING_PRICING.free.display}. Generous quota per workflow.

## Available Workflows

| Workflow | What it does | Category | Channel |
|----------|--------------|----------|---------|
${workflowTable}

## Quick Start

\`\`\`bash
# Add MCP Factory to your MCP config
{
  "mcpServers": {
    "mcpfactory": {
      "command": "npx",
      "args": ["@mcpfactory/mcp-service"],
      "env": {
        "MCPFACTORY_API_KEY": "your-api-key"
      }
    }
  }
}
\`\`\`

## Usage Example

In Claude, Cursor, or any MCP-compatible client:

> "Launch a cold email campaign for acme.com, $10/day budget, 5 days trial, daily report to ceo@acme.com"

That's it. We handle:
1. Scraping & analyzing your URL
2. Identifying ideal customer profile
3. Finding relevant leads
4. Generating personalized emails
5. Sending with proper deliverability
6. A/B testing & optimization
7. Daily reports with dashboard link

## Common Features

### Budget Control
\`\`\`
"budget": {
  "max_daily_usd": 10,
  "max_weekly_usd": 50,
  "max_monthly_usd": 150
}
\`\`\`

### Scheduling
\`\`\`
"schedule": {
  "frequency": "daily",
  "trial_days": 5,
  "pause_on_weekend": true
}
\`\`\`

### Reporting
\`\`\`
"reporting": {
  "frequency": "daily",
  "channels": ["email", "whatsapp"],
  "email": "you@company.com"
}
\`\`\`

### Results via MCP
\`\`\`
Tool: get_campaign_results
→ Returns stats, costs, dashboard URL, next run time
\`\`\`

## Transparency

Each workflow includes a \`get_stats\` tool showing:
- Your usage & estimated BYOK costs (${BYOK_COST_ESTIMATES.totalPerEmail})
- Community benchmarks (delivery rates, open rates, reply rates)
- Average cost per action

## Open Source

This project is 100% open source. ${BRAND.license} License.

## Monorepo Structure

\`\`\`
mcpfactory/
├── apps/
│   ├── api-service/    # Backend API
│   ├── dashboard/      # ${URLS.dashboard.replace("https://", "")}
│   ├── docs/           # Documentation
│   ├── landing/        # ${URLS.landing.replace("https://", "")}
│   └── mcp-service/    # MCP server endpoint
└── shared/
    ├── types/
    ├── auth/
    └── content/         # SSoT for all content (this generates README.md)
\`\`\`

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

${BRAND.license}
`;
}

const readme = generateRootReadme();
writeFileSync(resolve(ROOT, "README.md"), readme);
console.log("Generated README.md");
