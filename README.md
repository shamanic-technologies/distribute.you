# distribute.you

**Revenue made easy.**

> Our AI agent finds your buyers, writes to them and books your meetings. Free, at the API price with 0% markup.

[distribute.you](https://distribute.you) | [Dashboard](https://dashboard.distribute.you)

## What is distribute.you?

distribute.you is done-for-you revenue automation. Give us your URL. We find your buyers, contact them by cold email and book your meetings.

Every campaign is a sales funnel campaign. You set its caps: a max budget, a max volume per period, or both. You pay as you go, at the vendor's API price with 0% markup, listed on [distribute.you/catalog](https://distribute.you/catalog). One user is free, and a team is $9 per user each month.

## Distribution Features

- **Sales Cold Email**: Find prospects, write personalized cold emails, send and track replies. Automatically. _(Live)_

## Quick Start

1. Create an account at [dashboard.distribute.you](https://dashboard.distribute.you)
2. Add your URL
3. Set your caps (max budget and/or max volume per period)
4. We run the campaign and A/B test templates, models and audiences on it

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
