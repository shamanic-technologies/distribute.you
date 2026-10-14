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

import { URLS } from "../src/urls.js";
import { BRAND } from "../src/brand.js";
import { DISTRIBUTION_FEATURES } from "../src/features.js";

function generateRootReadme(): string {
  const featureList = DISTRIBUTION_FEATURES
    .map((f) => `- **${f.title}**: ${f.description} _(${f.status === "live" ? "Live" : "Coming soon"})_`)
    .join("\n");

  return `# ${BRAND.name}

**${BRAND.tagline}**

> ${BRAND.hero}

[${URLS.landing.replace("https://", "")}](${URLS.landing}) | [Dashboard](${URLS.dashboard})

## What is ${BRAND.name}?

${BRAND.name} is done-for-you revenue automation. Give us your URL. We find your buyers, contact them by cold email and book your meetings.

Every campaign is a sales funnel campaign. You set its caps: a max budget, a max volume per period, or both. You pay as you go at the public prices on [${URLS.landing.replace("https://", "")}/catalog](${URLS.landing}/catalog).

## Distribution Features

${featureList}

## Quick Start

1. Create an account at [${URLS.dashboard.replace("https://", "")}](${URLS.dashboard})
2. Add your URL
3. Set your caps (max budget and/or max volume per period)
4. We run the campaign and A/B test templates, models and audiences on it

## Monorepo Structure

\`\`\`
distribute/
├── apps/
│   ├── dashboard/      # ${URLS.dashboard.replace("https://", "")}
│   ├── docs/           # Documentation
│   └── landing/        # ${URLS.landing.replace("https://", "")}
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
