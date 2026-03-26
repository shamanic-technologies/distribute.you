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

import { WORKFLOW_DEFINITIONS } from "../src/workflows.js";
import { URLS } from "../src/urls.js";
import { BRAND } from "../src/brand.js";
import { DISTRIBUTION_FEATURES } from "../src/features.js";

function generateRootReadme(): string {
  const workflowTable = WORKFLOW_DEFINITIONS
    .map((w) => `| ${w.label} | ${w.description} | ${w.featureSlug} |`)
    .join("\n");

  const featureList = DISTRIBUTION_FEATURES
    .map((f) => `- **${f.title}** — ${f.description} _(${f.status === "live" ? "Live" : "Coming soon"})_`)
    .join("\n");

  return `# ${BRAND.name}

**${BRAND.tagline}**

> ${BRAND.hero}

[${URLS.landing.replace("https://", "")}](${URLS.landing}) | [Dashboard](${URLS.dashboard})

## What is ${BRAND.name}?

${BRAND.name} is the Stripe for Distribution. Create an account, give us your URL — we automate your entire distribution layer with AI workflows ranked by real performance data.

## Distribution Features

${featureList}

## Available Workflows

| Workflow | What it does | Feature |
|----------|--------------|---------|
${workflowTable}

## Quick Start

1. Create an account at [${URLS.dashboard.replace("https://", "")}](${URLS.dashboard})
2. Add your URL
3. Enable the distribution features you need
4. We handle the rest — the best-performing AI workflow runs automatically

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
