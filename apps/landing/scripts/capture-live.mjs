#!/usr/bin/env node
/**
 * Second capture pass: record what a REAL BROWSER fetches from a competitor landing.
 *
 *   node scripts/capture-live.mjs https://explee.com/ explee
 *
 * `clone-site.mjs` reads the markup and walks the references it can see. That misses two
 * whole classes of asset, and both are visible on screen:
 *
 *  - a CSS/JS chunk whose URL the bundle ASSEMBLES at runtime from a chunk map, so the
 *    path exists as `{"0mwfz":"3.hp8_b"}` in a manifest and as no string anywhere;
 *  - anything loaded lazily — testimonial avatars, below-the-fold imagery — which is
 *    requested only once the element approaches the viewport.
 *
 * So this pass loads the page, scrolls the whole height to trigger the lazy work, and
 * writes every same-origin response to the same paths `clone-site.mjs` uses. It ADDS to
 * a capture; it never removes. Run the static pass first (it reaches pages and assets a
 * single visit does not request), then this one.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { diskPathFor, extensionForContentType, splitQuery } from "./clone-site.mjs";

/**
 * Four passes, because an image optimizer keys its output on BOTH the layout width and
 * the device pixel ratio: `/_next/image?url=…&w=256` and `&w=512` are two different
 * files, and a capture taken only at 2x leaves every 1x variant missing on the screen of
 * whoever opens the clone on an ordinary monitor.
 */
const PASSES = [
  { width: 1440, height: 900, deviceScaleFactor: 1, label: "desktop 1x" },
  { width: 1440, height: 900, deviceScaleFactor: 2, label: "desktop 2x" },
  { width: 390, height: 844, deviceScaleFactor: 1, label: "mobile 1x" },
  { width: 390, height: 844, deviceScaleFactor: 3, label: "mobile 3x" },
];

async function capture(browser, url, outRoot, pass) {
  const origin = new URL(url).origin;
  const context = await browser.newContext({
    viewport: { width: pass.width, height: pass.height },
    deviceScaleFactor: pass.deviceScaleFactor,
  });
  const page = await context.newPage();

  const saved = new Set();
  const failed = [];

  page.on("response", async (response) => {
    const responseUrl = new URL(response.url());
    if (responseUrl.origin !== origin) return;
    if (response.status() >= 300) return;

    const [purePath, search] = splitQuery(responseUrl.pathname + responseUrl.search);
    const relative = diskPathFor(
      purePath,
      search,
      extensionForContentType(response.headers()["content-type"]),
    );
    if (saved.has(relative)) return;

    let body;
    try {
      body = await response.body();
    } catch {
      // A response the browser served from its own cache hands back no body. Refetching
      // it is not optional: on the second pass that is most of the page, and treating it
      // as "already written" is how four stylesheets went missing from a clone that
      // looked complete.
      try {
        const refetched = await context.request.get(response.url());
        if (!refetched.ok()) {
          failed.push(`${relative} — refetch HTTP ${refetched.status()}`);
          return;
        }
        body = await refetched.body();
      } catch (err) {
        failed.push(`${relative} — ${err.message}`);
        return;
      }
    }

    saved.add(relative);
    const target = path.join(outRoot, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  });

  // `load` waits on EVERY subresource, and a page holding one long-lived request open
  // (explee, 2026-09-24) never fires it. Take the document, then give `load` a bounded
  // chance; the scroll below is what actually triggers the lazy assets we are here for.
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {
    console.warn(`[capture] ${pass.label}: load never fired within 30s, capturing what arrived`);
  });

  // Walk the page so anything gated on the viewport actually loads. A single jump to the
  // bottom skips whatever an intersection observer only fires on the way past.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(3000);

  await context.close();
  return { saved: saved.size, failed };
}

const [, , startUrl, slug] = process.argv;
if (!startUrl || !slug) {
  console.error("usage: node scripts/capture-live.mjs <url> <slug>");
  process.exit(1);
}

const outRoot = path.join(process.cwd(), "clones", slug);
const browser = await chromium.launch();
let total = 0;
let unsaved = 0;
for (const pass of PASSES) {
  const result = await capture(browser, startUrl, outRoot, pass);
  total += result.saved;
  unsaved += result.failed.length;
  console.log(`[capture:${slug}] ${pass.label} — ${result.saved} written, ${result.failed.length} unsaved`);
  for (const line of result.failed.slice(0, 5)) console.log(`    ${line}`);
}
await browser.close();
console.log(`[capture:${slug}] ${total} responses across ${PASSES.length} passes, ${unsaved} unsaved`);
