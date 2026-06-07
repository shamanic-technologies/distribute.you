// Horizontal-overflow audit for public marketing pages.
//
// Loads each public route at mobile widths and reports any element whose right
// edge spills past the viewport — the cause of "space on the right / horizontal
// scroll on mobile". Element-level detection still fires even when an
// `overflow-x: clip` guard hides the body scrollbar, so this verifies offenders
// are fixed AT SOURCE, not merely masked.
//
// Mirrors the dev-diagnostic convention of seo-snapshot.sh / measure-ttfb.sh.
//
// Usage:
//   node apps/landing/scripts/overflow-audit.mjs [BASE_URL] [--app=landing|sales|docs]
//   BASE_URL defaults to http://localhost:3000
//   Exits 1 if any route has body-level horizontal overflow.
//
// Requires Playwright (already a devDependency of apps/dashboard / apps/admin).
// Run from a workspace that has it, e.g.:
//   pnpm --filter @distribute/dashboard exec node apps/landing/scripts/overflow-audit.mjs https://<preview-url>

import { pathToFileURL } from "node:url";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// Playwright is a devDependency of apps/dashboard / apps/admin (not of landing),
// so a bare `import("playwright")` from this script's dir fails under pnpm's
// isolated node_modules. Resolve it from the pnpm store. (CJS module → chromium
// lives on the default export under ESM interop.)
async function loadChromium() {
  const pick = (mod) => mod.chromium ?? mod.default?.chromium;
  try {
    const got = pick(await import("playwright"));
    if (got) return got;
  } catch {
    /* fall through to pnpm-store lookup */
  }
  const here = path.dirname(new URL(import.meta.url).pathname);
  const root = path.resolve(here, "../../.."); // repo root
  const storeRoot = path.join(root, "node_modules/.pnpm");
  if (existsSync(storeRoot)) {
    const dir = readdirSync(storeRoot).find((d) => d.startsWith("playwright@"));
    if (dir) {
      const entry = path.join(storeRoot, dir, "node_modules/playwright/index.js");
      if (existsSync(entry)) {
        const got = pick(await import(pathToFileURL(entry).href));
        if (got) return got;
      }
    }
  }
  console.error(
    "[overflow-audit] Playwright not found. It's a devDep of apps/dashboard — run `pnpm install` or run this from there.",
  );
  process.exit(2);
}
const chromium = await loadChromium();

const BASE_URL = process.argv.find((a) => a.startsWith("http")) || "http://localhost:3000";
const appArg = (process.argv.find((a) => a.startsWith("--app=")) || "--app=landing").split("=")[1];

// Public routes per app. Dynamic segments use one representative slug.
const ROUTES = {
  landing: [
    "/",
    "/pricing",
    "/performance",
    "/performance/brands",
    "/performance/models",
    "/performance/prompts",
    "/benchmarks",
    "/blog",
    "/investors",
    "/terms",
  ],
  sales: ["/"],
  docs: [
    "/",
    "/quickstart",
    "/authentication",
    "/mcp",
    "/mcp/tools",
    "/integrations",
    "/api",
    "/api/campaigns",
  ],
};

const WIDTHS = [360, 390, 414];
const routes = ROUTES[appArg] || ROUTES.landing;

// Collect every element whose right edge exceeds the viewport, then split into:
//  - "contained": has an ancestor with overflow-x clip/hidden/auto/scroll
//    (marquee track, table-in-overflow-x-auto, carousel) → intentional, fine.
//  - "escaping": NO clipping ancestor up to <body> → a REAL spill that only the
//    html{overflow-x:clip} guard saves. These are the ones to fix AT SOURCE.
// "primary" = deepest escaping offenders (no escaping child) — the actual cause.
function scanScript() {
  const vw = document.documentElement.clientWidth;
  const docScroll = document.documentElement.scrollWidth;
  const clips = (el) => {
    const o = getComputedStyle(el).overflowX;
    return o === "hidden" || o === "clip" || o === "auto" || o === "scroll";
  };
  const hasClippingAncestor = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      if (clips(p)) return true;
      p = p.parentElement;
    }
    return false;
  };
  const all = Array.from(document.querySelectorAll("body *"));
  const escaping = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > vw + 1 && !hasClippingAncestor(el)) escaping.push(el);
  }
  const escSet = new Set(escaping);
  const describe = (el) => {
    const r = el.getBoundingClientRect();
    const cls = (el.getAttribute("class") || "").trim().slice(0, 90);
    return { tag: el.tagName.toLowerCase(), cls, right: Math.round(r.right), width: Math.round(r.width) };
  };
  const primary = escaping
    .filter((el) => !Array.from(el.children).some((c) => escSet.has(c)))
    .map(describe);
  return {
    vw,
    docScroll,
    bodyOverflow: docScroll > vw + 1,
    count: escaping.length,
    primary,
  };
}

const browser = await chromium.launch();
let failures = 0;
const report = [];

for (const route of routes) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 2 });
    const url = BASE_URL.replace(/\/$/, "") + route;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(400);
      const res = await page.evaluate(scanScript);
      const tag = res.bodyOverflow ? "FAIL" : res.count > 0 ? "warn" : "ok";
      if (res.bodyOverflow) failures++;
      report.push({ route, width, ...res, tag });
      const head = `[${tag}] ${route} @${width}px  scrollWidth=${res.docScroll} vw=${res.vw} escaping=${res.count}`;
      console.log(head);
      // Dedupe primary offenders by tag+class for a compact list.
      const seen = new Set();
      for (const p of res.primary) {
        const key = `${p.tag}.${p.cls}`;
        if (seen.has(key)) continue;
        seen.add(key);
        console.log(`        ↳ <${p.tag} class="${p.cls}"> right=${p.right} w=${p.width}`);
      }
    } catch (err) {
      console.error(`[error] ${route} @${width}px: ${err.message}`);
      failures++;
    } finally {
      await page.close();
    }
  }
}

await browser.close();

const failed = report.filter((r) => r.bodyOverflow);
console.log(`\n=== ${appArg}: ${report.length} checks, ${failed.length} with body overflow ===`);
if (failures > 0) process.exit(1);
