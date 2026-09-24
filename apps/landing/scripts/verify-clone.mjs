#!/usr/bin/env node
/**
 * Prove a clone renders like its origin.
 *
 *   pnpm --filter @distribute/landing dev            # in another shell, with CLONE_BASIC_AUTH set
 *   node scripts/verify-clone.mjs explee 3000 distribute:secret
 *
 * A capture that "looks complete" is not evidence: an asset the page fetches at runtime
 * is invisible to the markup, and a clone missing four stylesheets still renders
 * something. So this loads BOTH pages in a real browser, lists what each one failed to
 * fetch, and reports what failed on the CLONE and not on the ORIGIN — that difference is
 * the gap, and everything else is the origin's own noise (an analytics beacon, a POST to
 * an API a static mirror cannot answer).
 *
 * It also screenshots both to /tmp/clone-shots. Look at them: the numbers say every byte
 * arrived, and only the picture says the page is right.
 */

import { mkdirSync } from "node:fs";

import { chromium } from "@playwright/test";

import { CLONE_HOST_PREFIX, CLONE_HOST_SUFFIX } from "./clone-hosts.mjs";

const [, , slug, port = "3000", credentials = "distribute:clonelab", originUrl] = process.argv;
if (!slug) {
  console.error("usage: node scripts/verify-clone.mjs <slug> [port] [user:pass] [originUrl]");
  process.exit(1);
}

const cloneHost = `${CLONE_HOST_PREFIX}${slug}${CLONE_HOST_SUFFIX}`;
const out = "/tmp/clone-shots";
mkdirSync(out, { recursive: true });

async function visit(browser, url, file, credentialsPair) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // An explicit header rather than `httpCredentials`: the latter answers a 401
    // CHALLENGE, and a crossorigin preload is sent without credentials and never gets the
    // chance to retry — which reads as four stylesheets missing from a complete clone.
    extraHTTPHeaders: credentialsPair
      ? { authorization: `Basic ${Buffer.from(credentialsPair).toString("base64")}` }
      : undefined,
  });
  const page = await context.newPage();

  const failures = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });

  // Same reason as capture-live.mjs: a page holding a request open never fires `load`.
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().length);
  await page.screenshot({ path: `${out}/${file}.png` });
  await page.screenshot({ path: `${out}/${file}-full.png`, fullPage: true });
  await context.close();

  // The scheme differs between the two sides (the clone is http on a local port, the
  // origin is https), so it has to go or nothing ever matches and every shared failure
  // reads as a gap in the clone.
  const host = new URL(url).host;
  return {
    text,
    failures: new Set(failures.map((f) => f.replace(/^https?:\/\//, "").replace(host, "HOST"))),
  };
}

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${cloneHost} 127.0.0.1`],
});
const clone = await visit(browser, `http://${cloneHost}:${port}/`, `${slug}-clone`, credentials);
const origin = originUrl ? await visit(browser, originUrl, `${slug}-origin`, undefined) : null;
await browser.close();

if (origin === null) {
  console.log(`[verify:${slug}] clone text ${clone.text} chars, ${clone.failures.size} failed requests`);
  console.log(`[verify:${slug}] pass the origin URL as the 4th argument to compare against it`);
} else {
  const gaps = [...clone.failures].filter((f) => !origin.failures.has(f) && f.startsWith("HOST/"));
  console.log(`[verify:${slug}] text ${clone.text} vs ${origin.text} — ${gaps.length} same-origin gaps`);
  for (const gap of gaps.slice(0, 20)) console.log(`  ${gap.slice(0, 140)}`);
}
console.log(`[verify:${slug}] screenshots in ${out}`);
