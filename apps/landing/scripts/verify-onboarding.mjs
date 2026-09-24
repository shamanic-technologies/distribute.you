#!/usr/bin/env node
/**
 * Prove a clone's ONBOARDING renders like the origin's, and that its CTAs reach it.
 *
 *   node scripts/verify-onboarding.mjs gojiberry 3000 distribute:secret
 *   node scripts/verify-onboarding.mjs gojiberry 443 distribute:secret --prod
 *
 * Two checks per clone, both in a real browser:
 *
 *  1. THE CLICK. Load the clone's landing, click the first link whose target is one of
 *     the captured steps, and require that the browser lands on a lab host (never the
 *     origin) with a page that has text on it. That is the acceptance test: a CTA that
 *     leaves for the competitor's own site, or lands on a 404, fails here.
 *  2. EACH STEP. Render the step on the clone and on the origin, list what failed to load
 *     on the clone and NOT on the origin (the gap — everything else is the origin's own
 *     noise: a beacon, an API a static copy cannot answer), and screenshot both. Look at
 *     the screenshots; the numbers only say bytes arrived.
 *
 * Reads the steps from `src/lib/clone-onboarding.json`, the list the capture used.
 */

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import { labHostFor } from "./capture-onboarding.mjs";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const [slug, port = "3000", credentials = "distribute:clonelab"] = args.filter((a) => !a.startsWith("--"));
if (!slug) {
  console.error("usage: node scripts/verify-onboarding.mjs <slug> [port] [user:pass] [--prod]");
  process.exit(1);
}

const entry = JSON.parse(readFileSync(path.join(process.cwd(), "src/lib/clone-onboarding.json"), "utf8"))[slug];
if (!entry) throw new Error(`no onboarding entry for ${slug}`);

const out = path.join(process.env.SHOTS_DIR ?? "/tmp/clone-shots", "onboarding");
mkdirSync(out, { recursive: true });

const hostFor = (origin) => {
  if (origin === entry.origin) return labHostFor(slug);
  const site = entry.sites.find((candidate) => candidate.origin === origin);
  if (!site) throw new Error(`${origin} is neither ${slug}'s landing nor one of its sites`);
  return labHostFor(slug, site.label);
};
const cloneUrlFor = (url) => {
  const parsed = new URL(url);
  const host = hostFor(parsed.origin);
  return prod ? `https://${host}${parsed.pathname}${parsed.search}` : `http://${host}:${port}${parsed.pathname}${parsed.search}`;
};
const labHosts = [labHostFor(slug), ...entry.sites.map((site) => labHostFor(slug, site.label))];

const browser = await chromium.launch({
  args: prod ? [] : [`--host-resolver-rules=${labHosts.map((h) => `MAP ${h} 127.0.0.1`).join(",")}`],
});
const auth = { authorization: `Basic ${Buffer.from(credentials).toString("base64")}` };

async function contextFor(withAuth) {
  // Explicit header, not httpCredentials: a crossorigin preload never answers a challenge.
  // Sent only to lab hosts, so the origin pass stays an ordinary anonymous visit.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // A redirect hop is followed without consulting the route below, so it gets no header;
    // the challenge answer covers it.
    httpCredentials: withAuth ? { username: credentials.split(":")[0], password: credentials.split(":").slice(1).join(":") } : undefined,
  });
  if (withAuth) {
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!labHosts.includes(url.hostname)) return route.continue();
      const headers = { ...route.request().headers(), ...auth };
      // Locally the dev server speaks http on a port, while a rewritten reference names
      // https://lab-…: fetch it from the dev server instead, so a cross-site CTA can be
      // clicked through without TLS on localhost. Redirects are handed back, not followed.
      // Every lab request, not only https ones: a redirect the route answers is followed by
      // the browser WITHOUT consulting this handler, and it names https://lab-…; fulfilling
      // the 3xx ourselves makes the browser issue the next hop as a fresh, routable request.
      if (!prod) {
        const response = await route.fetch({
          url: `http://127.0.0.1:${port}${url.pathname}${url.search}`,
          headers: { ...headers, host: url.hostname },
          maxRedirects: 0,
        });
        // A redirect names https://lab-…; locally that is the http dev server on a port.
        const location = response.headers().location;
        if (location && labHosts.includes(new URL(location, url).hostname)) {
          const next = new URL(location, url);
          return route.fulfill({
            response,
            headers: { ...response.headers(), location: `http://${next.hostname}:${port}${next.pathname}${next.search}` },
          });
        }
        return route.fulfill({ response });
      }
      return route.continue({ headers });
    });
  }
  return context;
}

async function render(url, file, withAuth, clicks = []) {
  const context = await contextFor(withAuth);
  const page = await context.newPage();
  const failures = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(8000);
  for (const label of clicks) {
    await page.getByText(label, { exact: true }).first().click({ timeout: 15000 });
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(8000);
  }
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().length);
  await page.screenshot({ path: path.join(out, `${file}.png`) });
  const finalUrl = page.url();
  await context.close();
  return { status: response?.status() ?? 0, text, finalUrl, failures };
}

// 1. The click, from the clone's own landing.
{
  const context = await contextFor(true);
  const page = await context.newPage();
  await page.goto(cloneUrlFor(`${entry.origin}/`), { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const stepTargets = entry.steps.map((step) => {
    const parsed = new URL(step.lands ?? step.url);
    return { host: hostFor(parsed.origin), pathname: parsed.pathname };
  });
  const href = await page.evaluate((targets) => {
    // Steps are listed signup-first, so the first step a link reaches is the primary CTA.
    const anchors = [...document.querySelectorAll("a[href]")];
    for (const t of targets) {
      for (const anchor of anchors) {
        const url = new URL(anchor.href, location.href);
        if (t.host === url.hostname && t.pathname === url.pathname) return anchor.href;
      }
    }
    return null;
  }, stepTargets);
  if (href === null) {
    console.log(`[onboarding:${slug}] CLICK: no anchor on the landing leads to a captured step (see the wall)`);
  } else {
    const anchor = page.locator(`a[href="${new URL(href).pathname}"], a[href="${href}"]`).first();
    const popup = context.waitForEvent("page", { timeout: 8000 }).catch(() => null);
    await anchor.click({ timeout: 10000 }).catch(() => page.goto(href));
    const opened = (await popup) ?? page;
    await opened.waitForLoadState("domcontentloaded").catch(() => {});
    await opened.waitForTimeout(6000);
    const landed = new URL(opened.url());
    const text = await opened.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim().length);
    await opened.screenshot({ path: path.join(out, `${slug}-click.png`) });
    const ok = labHosts.includes(landed.hostname) && text > 50;
    console.log(`[onboarding:${slug}] CLICK ${ok ? "OK" : "FAIL"}: ${href} -> ${opened.url()} (${text} chars)`);
  }
  await context.close();
}

// 2. Each step, clone beside origin.
for (const [index, step] of entry.steps.entries()) {
  const tag = `${slug}-${index + 1}`;
  // A click step is checked twice on the clone: the stored page it lands on, and the
  // clicks themselves replayed from the clone's own start page (the server-action path).
  const clone = await render(cloneUrlFor(step.lands ?? step.url), `${tag}-clone`, true);
  if (step.click) {
    const replay = await render(cloneUrlFor(step.url), `${tag}-clone-clicked`, true, step.click);
    const landed = new URL(replay.finalUrl);
    const ok = labHosts.includes(landed.hostname) && landed.pathname === new URL(step.lands).pathname && replay.text > 50;
    console.log(`[onboarding:${slug}] CLICKS ${ok ? "OK" : "FAIL"} ${step.click.join(" > ")} -> ${replay.finalUrl} (${replay.text} chars)`);
  }
  const origin = await render(step.url, `${tag}-origin`, false, step.click ?? []);
  const originHosts = new Set([new URL(entry.origin).host, ...entry.sites.map((s) => new URL(s.origin).host)]);
  const normalise = (u) => {
    const parsed = new URL(u);
    return `${labHosts.includes(parsed.hostname) || originHosts.has(parsed.host) ? "OWN" : parsed.host}${parsed.pathname}`;
  };
  const originFailures = new Set(origin.failures.map(normalise));
  const gaps = [...new Set(clone.failures.map(normalise))].filter((f) => f.startsWith("OWN") && !originFailures.has(f));
  console.log(
    `[onboarding:${slug}] ${step.mode} ${step.url}\n    clone ${clone.status} ${clone.text} chars at ${clone.finalUrl}\n    origin ${origin.status} ${origin.text} chars — ${gaps.length} same-origin gap(s)`,
  );
  for (const gap of gaps.slice(0, 12)) console.log(`      ${gap.slice(0, 140)}`);
}
await browser.close();
console.log(`[onboarding:${slug}] screenshots in ${out}`);
