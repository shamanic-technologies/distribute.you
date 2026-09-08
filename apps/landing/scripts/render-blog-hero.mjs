#!/usr/bin/env node

/**
 * Renders content/blog/<slug>/hero.svg to public/blog/<slug>/hero.png at
 * 1200x630 (the og:image size), through Chromium so the fonts and the text
 * layout are what a browser draws, not what an SVG rasteriser guesses.
 *
 * The SVG is the source of truth and is committed beside the article; the PNG
 * is committed too, because the standalone Next build serves public/ as-is
 * and nothing rasterises at request time.
 *
 * Invocation (from apps/landing, where @playwright/test is a devDependency):
 *   node scripts/render-blog-hero.mjs <slug>
 */

import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: node scripts/render-blog-hero.mjs <slug>");
    process.exit(2);
  }
  const svg = readFileSync(join(ROOT, "content", "blog", slug, "hero.svg"), "utf8");
  const outDir = join(ROOT, "public", "blog", slug);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "hero.png");

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style></head><body>${svg}</body></html>`,
    );
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1200, height: 630 }, type: "png" });
  } finally {
    await browser.close();
  }
  console.log(`[landing/blog] wrote ${outPath}`);
}

main().catch((err) => {
  console.error("[landing/blog] Failed:", err);
  process.exit(1);
});
