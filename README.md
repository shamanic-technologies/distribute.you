# distribute

**The Stripe of Distribution**

> Your distribution, on autopilot.

[distribute.you](https://distribute.you) | [Dashboard](https://dashboard.distribute.you)

## What is distribute?

distribute is the Stripe of Distribution. Create an account, give us your URL — we automate your entire distribution layer with AI workflows ranked by real performance data.

## Distribution Features

- **Sales Outreach** — Find prospects, write personalized cold emails, send and track replies. Automatically. _(Live)_
- **Journalist Outreach** — Pitch journalists who cover your space. Get press without a PR agency. _(Live)_
- **VC Outreach** — Reach investors who back your stage and sector. Run a structured raise from your inbox. _(Live)_
- **Hiring Outreach** — Reach candidates that match your needs. Cold outreach for recruiting. _(Live)_
- **Accelerators Outreach** — Apply to YC, Techstars, and 200+ accelerators. We track deadlines and pitch on your behalf. _(Live)_
- **PR Expert Quotes** — Get quoted in articles. Respond to HARO-style requests with on-brand quotes, auto-sent. _(Live)_
- **Outlet Discovery** — Find media outlets and publications worth pitching for your brand and space. _(Live)_
- **Press Kit Generation** — Generate a press kit page with assets, bio, screenshots, and contact in one click. _(Live)_
- **AI Visibility Scoring** — Audit how your brand appears in answers from ChatGPT, Claude, Perplexity, and Gemini. Track mention rate, ranking, and share-of-voice against competitors. _(Live)_
- **Influencer Outreach** — Reach creators in your niche. Match by audience size, engagement, and topical fit. _(Coming soon)_
- **LinkedIn Outreach** — Sales outreach on LinkedIn — connection request, message, follow-up. Tracked like email. _(Coming soon)_

## Available Workflows

| Workflow | What it does | Feature |
|----------|--------------|---------|
| Sales Cold Email Outreach | Find leads, generate personalized cold emails, send & optimize. | sales-email-cold-outreach |
| Journalists Cold Email Outreach | Pitch journalists and media contacts for press coverage. | journalists-email-cold-outreach |
| Press Kit Generation | Generate and manage press kits for media outreach. | press-kit-email-generation |
| Webinars | Welcome emails, heat-up sequences, reminders, and post-webinar thank you emails. | webinars |
| Welcome Email | Automated welcome email for new signups and contacts. | welcome-email |
| Media Outlet Discovery | Find relevant media outlets and publications for your brand. | outlets-database-discovery |
| Journalist Discovery | Find relevant journalists and media contacts for your brand. | journalists-database-discovery |

## Quick Start

1. Create an account at [dashboard.distribute.you](https://dashboard.distribute.you)
2. Add your URL
3. Enable the distribution features you need
4. We handle the rest — the best-performing AI workflow runs automatically

## Monorepo Structure

```
distribute/
├── apps/
│   ├── dashboard/      # dashboard.distribute.you
│   ├── docs/           # Documentation
│   └── landing/        # distribute.you
└── shared/
    ├── types/
    ├── auth/
    └── content/         # SSoT for all content (this generates README.md)
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT
