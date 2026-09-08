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

  // The SVG's own width/height decide the raster size. The blog card and the
  // article page both crop the cover to 16:9 (object-cover), so a hero that is
  // not 16:9 loses its edges; 1600x900 is the shape that survives both.
  const size = svg.match(/<svg[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"/);
  if (!size) throw new Error("[landing/blog] hero.svg must declare integer width and height on the root element");
  const width = Number(size[1]);
  const height = Number(size[2]);
  if (Math.abs(width / height - 16 / 9) > 0.01) {
    throw new Error(`[landing/blog] hero.svg is ${width}x${height}, not 16:9; the blog card crops anything else`);
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}svg{display:block}</style></head><body>${svg}</body></html>`,
    );
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width, height }, type: "png" });
  } finally {
    await browser.close();
  }
  console.log(`[landing/blog] wrote ${outPath}`);
}

main().catch((err) => {
  console.error("[landing/blog] Failed:", err);
  process.exit(1);
});
