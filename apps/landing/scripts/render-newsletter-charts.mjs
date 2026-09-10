#!/usr/bin/env node

/**
 * Renders a chosen subset of a blog article's inline SVG charts to PNG, for a
 * newsletter. Mail clients (Gmail above all) strip inline SVG, so a chart a
 * newsletter carries has to be a raster hosted on our own domain. The SVGs are
 * the same ones the article renders, so the newsletter and the page state the
 * same figures by construction.
 *
 * Rendered through Chromium (like render-blog-hero.mjs) at 2x so the text stays
 * crisp on a retina phone; Inter is loaded from Google Fonts for the render only.
 *
 * Invocation (from apps/landing):
 *   node scripts/render-newsletter-charts.mjs <slug> <index>[,<index>...]
 * Indexes are 1-based positions of <svg> elements in content/blog/<slug>/article.html.
 * Output: public/blog/<slug>/newsletter/chart-<index>.png
 */

import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const WIDTH = 560; // the newsletter's content column, CSS px
const SCALE = 2;

async function main() {
  const [slug, list] = process.argv.slice(2);
  if (!slug || !list) {
    console.error("usage: node scripts/render-newsletter-charts.mjs <slug> <index>[,<index>...]");
    process.exit(2);
  }
  const html = readFileSync(join(ROOT, "content", "blog", slug, "article.html"), "utf8");
  const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
  const outDir = join(ROOT, "public", "blog", slug, "newsletter");
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const raw of list.split(",")) {
      const index = Number(raw);
      const svg = svgs[index - 1];
      if (!svg) throw new Error(`[landing/newsletter] no svg #${index} in ${slug} (article has ${svgs.length})`);
      const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
      if (!vb) throw new Error(`[landing/newsletter] svg #${index} has no viewBox`);
      const height = Math.round((WIDTH * Number(vb[2])) / Number(vb[1]));
      const page = await browser.newPage({ viewport: { width: WIDTH, height }, deviceScaleFactor: SCALE });
      await page.setContent(
        `<!doctype html><html><head><meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>html,body{margin:0;padding:0;background:#fff}svg{display:block;width:${WIDTH}px;height:${height}px;font-family:Inter,system-ui,sans-serif}</style>
        </head><body>${svg}</body></html>`,
        { waitUntil: "networkidle" },
      );
      await page.evaluate(() => document.fonts.ready);
      const outPath = join(outDir, `chart-${index}.png`);
      await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: WIDTH, height }, type: "png" });
      await page.close();
      console.log(`[landing/newsletter] wrote ${outPath} (${WIDTH}x${height} @${SCALE}x)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[landing/newsletter] Failed:", err);
  process.exit(1);
});
