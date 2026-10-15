#!/usr/bin/env node
/**
 * Third capture pass: bring a clone's CROSS-ORIGIN assets onto our own host.
 *
 *   node scripts/localise-clone.mjs https://gojiberry.ai/ gojiberry
 *
 * The other two passes take only same-origin responses, which is right for a site that
 * serves its own assets and useless for one that does not. A Framer page keeps every
 * image, font and bundle on `framerusercontent.com`, so `clone-site.mjs` and
 * `capture-live.mjs` together capture TWO files and the "clone" is a shell that renders
 * entirely out of somebody else's CDN.
 *
 * So this pass mirrors those assets under `__external/<host>/…` and rewrites the
 * references to point at them. That is a deliberate exception to the leave-the-bytes-alone
 * rule, and the ONLY one: it changes references, never content. The catalogue records
 * which hosts were rapatriated (`localisedHosts`) so a clone never quietly claims to be
 * more local than it is.
 *
 * What is mirrored is decided by what the page ASKS FOR and what comes back: a
 * cross-origin response carrying an asset content-type. Analytics, tag managers, pixels
 * and embedded players are left pointing at their origin — they are not the page, and
 * rewriting a tracker's endpoint would only break it in a confusing way.
 */

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { diskPathFor, extensionForContentType, splitQuery } from "./clone-site.mjs";

/** Where a mirrored third-party asset lands, relative to the clone root. */
export const EXTERNAL_DIR = "__external";

const PASSES = [
  { width: 1440, height: 900, deviceScaleFactor: 1 },
  { width: 1440, height: 900, deviceScaleFactor: 2 },
  { width: 390, height: 844, deviceScaleFactor: 1 },
  { width: 390, height: 844, deviceScaleFactor: 3 },
];

/** Content types that are part of what the page RENDERS. */
const ASSET_CONTENT_TYPES = [
  "image/",
  "font/",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/font",
];

/**
 * Hosts never mirrored, whatever they serve.
 *
 * Every one of these is a tracker, a tag manager or an embedded third-party widget. They
 * are not the page: rewriting their endpoint onto our host would not make the clone more
 * local, it would make a beacon 404 in a way that reads as a broken capture. An embedded
 * player (Vimeo, YouTube) is left alone for the same reason — it is an iframe onto
 * somebody else's application, not an asset.
 */
const NEVER_MIRROR = [
  "google-analytics.com",
  "googletagmanager.com",
  "google.com",
  "googleadservices.com",
  "doubleclick.net",
  "facebook.net",
  "facebook.com",
  "licdn.com",
  "linkedin.com",
  "cloudflareinsights.com",
  "challenges.cloudflare.com",
  "vimeo.com",
  "youtube.com",
  "ytimg.com",
  "hotjar.com",
  "segment.com",
  "posthog.com",
  "intercom.io",
  "hs-scripts.com",
  "events.framer.com",
];

export function shouldMirrorHost(host, contentType) {
  // A response can carry no host at all (a `data:` or `blob:` url the page created), and
  // an empty host is CATASTROPHIC downstream: the rewrite would replace every `https://`
  // in the clone with the external prefix, breaking the analytics tags that were
  // deliberately left alone, their own canonical, and even `xmlns="http://www.w3.org/..."`.
  if (!host || !host.includes(".")) return false;
  if (NEVER_MIRROR.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) return false;
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return ASSET_CONTENT_TYPES.some((prefix) => type.startsWith(prefix));
}

/** `https://cdn.example.com/a/b.png` -> `/__external/cdn.example.com/a/b.png`. */
export function externalPathFor(host, relative) {
  return `/${EXTERNAL_DIR}/${host}/${relative}`;
}

async function capture(browser, url, outRoot, pass, mirroredHosts) {
  const origin = new URL(url).origin;
  const context = await browser.newContext({
    viewport: { width: pass.width, height: pass.height },
    deviceScaleFactor: pass.deviceScaleFactor,
  });
  const page = await context.newPage();
  const written = new Set();

  page.on("response", async (response) => {
    const responseUrl = new URL(response.url());
    if (responseUrl.origin === origin) return;
    if (response.status() >= 300) return;

    const contentType = response.headers()["content-type"];
    if (!shouldMirrorHost(responseUrl.host, contentType)) return;

    const [purePath, search] = splitQuery(responseUrl.pathname + responseUrl.search);
    const relative = diskPathFor(purePath, search, extensionForContentType(contentType));
    const key = `${responseUrl.host}/${relative}`;
    if (written.has(key)) return;

    let body;
    try {
      body = await response.body();
    } catch {
      try {
        const refetched = await context.request.get(response.url());
        if (!refetched.ok()) return;
        body = await refetched.body();
      } catch {
        return;
      }
    }

    written.add(key);
    mirroredHosts.add(responseUrl.host);
    const target = path.join(outRoot, EXTERNAL_DIR, responseUrl.host, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  });

  await page.goto(url, { waitUntil: "load", timeout: 90000 });
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
  return written.size;
}

const REWRITABLE = new Set([".html", ".css", ".js", ".mjs", ".json", ".txt"]);

async function* textFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* textFiles(full);
      continue;
    }
    if (REWRITABLE.has(path.extname(entry.name).toLowerCase())) yield full;
  }
}

/**
 * Point every reference to a mirrored host at our copy.
 *
 * Only the ORIGIN is replaced, never a path — so a reference keeps its exact shape and a
 * bundle that assembles a url by concatenating an origin with a path still resolves. Both
 * schemes are handled because a captured page carries either.
 */
/**
 * Drop the Subresource Integrity pin from a tag that now loads a RAPATRIATED asset.
 *
 * A Webflow page pins its stylesheet and bundles with `integrity="sha384-…"`. Rewriting the
 * `url(https://cdn…)` references INSIDE that stylesheet changes its bytes, the hash no longer
 * matches, and the browser refuses the file: the clone renders as unstyled text (11x and
 * warmly, 2026-10-15). The pin protected a cross-origin fetch; the file is now served by our
 * own host, so the attribute is a reference detail of the move, like the URL itself. Only
 * tags pointing at `/__external/` lose it; an origin-served asset keeps its pin.
 */
export function dropLocalisedIntegrity(text) {
  return text.replace(/<(link|script)\b[^>]*>/gi, (tag) =>
    new RegExp(`(?:src|href)=["']/${EXTERNAL_DIR}/`).test(tag) ? tag.replace(/\s+integrity=(["'])[^"']*\1/i, "") : tag,
  );
}

export function rewriteReferences(text, hosts) {
  let out = text;
  // Longest first, so a host that is a prefix of another cannot claim its references; and
  // a blank entry is refused rather than replacing every scheme in the file.
  const ordered = [...hosts].filter((host) => host && host.includes(".")).sort((a, b) => b.length - a.length);
  for (const host of ordered) {
    for (const scheme of ["https://", "http://"]) {
      out = out.split(`${scheme}${host}`).join(`/${EXTERNAL_DIR}/${host}`);
    }
  }
  return out;
}

// Guarded, like scripts/clone-site.mjs, so the unit tests can import the pure helpers
// above without the CLI running (and calling process.exit) on import.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , startUrl, slug] = process.argv;
  if (!startUrl || !slug) {
    console.error("usage: node scripts/localise-clone.mjs <url> <slug>");
    process.exit(1);
  }
  
  const outRoot = path.join(process.cwd(), "clones", slug);
  await stat(outRoot); // fail loud when the clone has not been captured yet
  
  const browser = await chromium.launch();
  const mirroredHosts = new Set();
  let total = 0;
  for (const pass of PASSES) {
    total += await capture(browser, startUrl, outRoot, pass, mirroredHosts);
  }
  await browser.close();
  
  const hosts = [...mirroredHosts].sort();
  let rewritten = 0;
  for await (const file of textFiles(outRoot)) {
    const before = await readFile(file, "utf8");
    const rewrittenRefs = rewriteReferences(before, hosts);
    const after = file.endsWith(".html") ? dropLocalisedIntegrity(rewrittenRefs) : rewrittenRefs;
    if (after !== before) {
      await writeFile(file, after);
      rewritten += 1;
    }
  }
  
  console.log(`[localise:${slug}] ${total} assets mirrored from ${hosts.length} hosts`);
  for (const host of hosts) console.log(`    ${host}`);
  console.log(`[localise:${slug}] ${rewritten} files rewritten`);
  console.log(`[localise:${slug}] record these in clone-catalogue.ts: localisedHosts: ${JSON.stringify(hosts)}`);
}
