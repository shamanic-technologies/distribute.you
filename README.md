# MCP Factory

**The DFY, BYOK MCP Platform**

> From URL to Revenue

[mcpfactory.org](https://mcpfactory.org) | [Dashboard](https://dashboard.mcpfactory.org)

## What is MCP Factory?

MCP Factory provides Done-For-You (DFY) automation tools via the Model Context Protocol (MCP).

**DFY means:** You provide a URL + budget. We handle everything else - lead finding, content generation, outreach, optimization, and reporting.

**BYOK means:** Bring Your Own Keys. You use your own API keys (OpenAI, Anthropic, Apollo, etc.), so you only pay for what you use. No hidden markups.

## Pricing

**Free · BYOK** — $0 — you only pay your API costs. Generous quota per workflow.

## Available Workflows

| Workflow | What it does | Category | Channel |
|----------|--------------|----------|---------|
| Sales Cold Email Outreach | Find leads, generate personalized cold emails, send & optimize. | sales | email |
| PR & Media Email Outreach | Pitch journalists and media contacts for press coverage. | pr | email |

## Quick Start

```bash
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
```

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
```
"budget": {
  "max_daily_usd": 10,
  "max_weekly_usd": 50,
  "max_monthly_usd": 150
}
```

### Scheduling
```
"schedule": {
  "frequency": "daily",
  "trial_days": 5,
  "pause_on_weekend": true
}
```

### Reporting
```
"reporting": {
  "frequency": "daily",
  "channels": ["email", "whatsapp"],
  "email": "you@company.com"
}
```

### Results via MCP
```
Tool: get_campaign_results
→ Returns stats, costs, dashboard URL, next run time
```

## Transparency

Each workflow includes a `get_stats` tool showing:
- Your usage & estimated BYOK costs (~$0.02/email)
- Community benchmarks (delivery rates, open rates, reply rates)
- Average cost per action

## Open Source

This project is 100% open source. MIT License.

## Monorepo Structure

```
mcpfactory/
├── apps/
│   ├── dashboard/      # dashboard.mcpfactory.org
│   ├── docs/           # Documentation
│   └── landing/        # mcpfactory.org
└── shared/
    ├── types/
    ├── auth/
    └── content/         # SSoT for all content (this generates README.md)
```

### Extracted Services

- [api-service](https://github.com/shamanic-technologies/api-service) — Backend API
- [mcp](https://github.com/shamanic-technologies/mcp) — MCP server endpoint

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
