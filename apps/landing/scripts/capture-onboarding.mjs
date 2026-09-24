#!/usr/bin/env node
/**
 * Fourth capture pass: the competitor's ONBOARDING, as far as it goes without an account.
 *
 *   node scripts/capture-onboarding.mjs gojiberry
 *
 * The other passes photograph the landing. This one follows where the landing's signup
 * CTAs lead — sign-up and sign-in pages, plan pickers, pricing — so the part of a
 * competitor most relevant to our own onboarding can be studied beside ours. The steps
 * live in `src/lib/clone-onboarding.json`, one list per clone, and so does the WALL: the
 * step at which going further needs an account. This script never types into a form and
 * never submits one; it loads each step's URL and records what came back.
 *
 * Three things a landing capture never has to deal with:
 *
 *  - SITES. Onboarding often lives on another host (`app.gojiberry.ai`, `auth.explee.com`)
 *    whose own root-absolute references would collide with the landing's. Each such
 *    origin is a SITE of the clone, stored under `__sites/<label>/` and served at the
 *    root of its own host (`lab-<slug>-<label>.distribute.you`) — the same reason the
 *    landing is served at a root rather than under a prefix.
 *  - REDIRECTS. `/subscribe?plan=…` answers a 307 to sign-in; a mirror of bodies alone
 *    would 404 there. Each hop the origin answered is recorded in `__redirects.json` at
 *    the root it belongs to, and the route replays it.
 *  - SNAPSHOTS. A widget rendered by a third-party auth provider (Clerk) calls that
 *    provider's API from the page, and the API refuses any Origin but its own, so the
 *    bytes render an empty card. For those steps (`"mode": "snapshot"`) what is stored is
 *    the DOM the browser rendered on the origin, scripts removed and injected styles
 *    inlined: faithful to look at, inert to click. Recorded per step, never inferred.
 *
 * Afterwards, every reference to a site ORIGIN anywhere in the clone is pointed at its lab
 * host, and inside a site every reference to the landing origin is pointed back at the
 * landing's lab host — so a CTA stays inside the clone instead of leaving for the origin.
 * Only references to the clone's own origins are touched, never content.
 */

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { CLONE_HOST_PREFIX, CLONE_HOST_SUFFIX } from "./clone-hosts.mjs";
import { diskPathFor, extensionForContentType, splitQuery } from "./clone-site.mjs";

export const SITES_DIR = "__sites";
export const REDIRECTS_FILE = "__redirects.json";
export const ACTIONS_FILE = "__actions.json";

const PASSES = [
  { width: 1440, height: 900, deviceScaleFactor: 1, label: "desktop 1x" },
  { width: 1440, height: 900, deviceScaleFactor: 2, label: "desktop 2x" },
  { width: 390, height: 844, deviceScaleFactor: 3, label: "mobile 3x" },
];

/** `lab-<slug>` for the landing, `lab-<slug>-<label>` for a site. One level, so Universal SSL covers it. */
export function labHostFor(slug, label = null) {
  return `${CLONE_HOST_PREFIX}${label ? `${slug}-${label}` : slug}${CLONE_HOST_SUFFIX}`;
}

/** The directory, relative to the clone root, a given origin's files belong in. Null = not ours. */
export function rootFor(entry, origin) {
  if (origin === entry.origin) return "";
  const site = entry.sites.find((candidate) => candidate.origin === origin);
  return site ? path.join(SITES_DIR, site.label) : null;
}

/**
 * Point references to the clone's own origins at their lab hosts.
 *
 * `inSite` is the label of the site the text belongs to, or null for the landing. Every
 * site origin is rewritten everywhere (a landing CTA to `app.gojiberry.ai` must land on
 * our copy of it); the landing origin is rewritten only inside a site (a site's logo
 * linking home), because on the landing itself those references are already same-origin
 * and rewriting them would touch its canonical, its JSON-LD and nothing a click reaches.
 * Only a match followed by a boundary counts, so `https://app.x.ai` never claims
 * `https://app.x.ai.evil.com`.
 */
export function rewriteOrigins(text, slug, entry, inSite) {
  const targets = entry.sites.map((site) => [site.origin, `https://${labHostFor(slug, site.label)}`]);
  if (inSite !== null) targets.push([entry.origin, `https://${labHostFor(slug)}`]);
  targets.sort((a, b) => b[0].length - a[0].length);

  let out = text;
  for (const [from, to] of targets) {
    const host = from.replace(/^https:\/\//, "");
    const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`https?:\\/\\/${escaped}(?![\\w.-])`, "g");
    out = out.replace(pattern, to);
    // JSON-escaped form, which a bundle or an inline RSC payload carries.
    const escapedPattern = new RegExp(`https?:\\\\/\\\\/${escaped}(?![\\w.-])`, "g");
    out = out.replace(escapedPattern, to.replace(/\//g, "\\/"));
  }
  return out;
}

/** A redirect's Location, made absolute and pointed at our copy when it targets our own origins. */
function rewriteLocation(location, requestUrl, slug, entry) {
  const absolute = new URL(location, requestUrl).toString();
  return rewriteOrigins(absolute, slug, entry, "any");
}

async function writeFileDeep(target, body) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

/**
 * The DOM the browser rendered, made to stand on its own: every injected stylesheet
 * (CSS-in-JS writes its rules through the CSSOM, so the <style> tag is empty in the
 * markup) is written back into its tag, and every script is removed so nothing boots,
 * calls the provider and tears the rendered card down again.
 */
async function snapshotOf(page) {
  return page.evaluate(() => {
    for (const style of document.querySelectorAll("style")) {
      try {
        const rules = style.sheet ? [...style.sheet.cssRules].map((rule) => rule.cssText).join("\n") : "";
        if (rules.length > style.textContent.length) style.textContent = rules;
      } catch {
        // a sheet the page cannot read keeps its text
      }
    }
    for (const node of document.querySelectorAll('script, link[rel="modulepreload"], link[as="script"]')) {
      node.remove();
    }
    return `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;
  });
}

async function captureStep(browser, slug, entry, step, pass, cloneRoot, redirects, actions) {
  const context = await browser.newContext({
    viewport: { width: pass.width, height: pass.height },
    deviceScaleFactor: pass.deviceScaleFactor,
  });
  const page = await context.newPage();
  const pending = [];
  let written = 0;
  const startRoot = rootFor(entry, new URL(step.url).origin);
  const snapshotPaths = new Set(
    entry.steps
      .filter((candidate) => candidate.mode === "snapshot")
      .map((candidate) => {
        const target = new URL(candidate.lands ?? candidate.url);
        return `${rootFor(entry, target.origin)}|${target.pathname.replace(/\/+$/, "") || "/"}`;
      }),
  );

  page.on("response", (response) => {
    pending.push(
      (async () => {
        const url = new URL(response.url());
        const root = rootFor(entry, url.origin);
        if (root === null) return;
        const status = response.status();

        // A Next server action (explee's "Sign in"): recorded by action id so the route can
        // replay the answer, its redirect pointed at our copy of wherever it sent the user.
        const actionId = response.request().headers()["next-action"];
        if (actionId && response.request().method() === "POST") {
          const headers = {};
          for (const [name, value] of Object.entries(response.headers())) {
            if (name.startsWith("x-action") || name === "content-type" || name === "vary") {
              headers[name] = rewriteOrigins(value, slug, entry, "any");
            }
          }
          let body = "";
          try {
            body = rewriteOrigins((await response.body()).toString("utf8"), slug, entry, "any");
          } catch {
            // a redirect answer can carry no body; the header is what the client acts on
          }
          actions.set(`${root}|${actionId}`, { root, id: actionId, status, headers, body });
          return;
        }

        if (status >= 300 && status < 400 && response.request().resourceType() === "document") {
          const location = response.headers().location;
          if (!location) return;
          const key = url.pathname.replace(/\/+$/, "") || "/";
          // A hop back onto the same path (an auth provider's handshake that only strips a
          // query) is not a redirect a copy can replay: served on a miss it would loop.
          const target = new URL(location, url);
          if (target.origin === url.origin && (target.pathname.replace(/\/+$/, "") || "/") === key) return;
          redirects.set(`${root}|${key}`, {
            root,
            path: key,
            status,
            location: rewriteLocation(location, url.toString(), slug, entry),
          });
          return;
        }
        if (status >= 300) return;
        // A click step starts on a page some earlier pass already captured (usually the
        // landing). Re-writing it here would silently replace that capture with a newer
        // fetch, so only what the clicks LEAD to is stored.
        if (step.click && root === startRoot) return;
        // A snapshot step's document IS the snapshot, written once the page has rendered.
        // Letting the listener store raw documents here would clobber it — including an
        // EARLIER step's snapshot that this step merely passes through (sign-in on the way
        // to register).
        if (step.mode === "snapshot" && response.request().resourceType() === "document") return;

        const [purePath, search] = splitQuery(url.pathname + url.search);
        // Nor may ANY step store a raw document over a page another step snapshots: a plan
        // CTA that redirects to sign-in reaches the same path, and its raw bytes are the
        // empty card the snapshot exists to replace.
        if (response.request().resourceType() === "document" && snapshotPaths.has(`${root}|${purePath.replace(/\/+$/, "") || "/"}`)) return;
        const ext = extensionForContentType(response.headers()["content-type"]);
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
        await writeFileDeep(path.join(cloneRoot, root, diskPathFor(purePath, search, ext)), body);
        // A document reached with a query is ALSO its plain page, so a link or a typed URL
        // without the query lands on it rather than on a 404.
        if (search && response.request().resourceType() === "document") {
          await writeFileDeep(path.join(cloneRoot, root, diskPathFor(purePath, "", ext)), body);
        }
        written += 1;
      })(),
    );
  });

  const response = await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
  // Auth widgets render after the page settles; give them time before scrolling or snapshotting.
  await page.waitForTimeout(8000);
  // Buttons only. A click that would need a field filled first is the wall, and a step
  // never gets past one.
  for (const label of step.click ?? []) {
    await page.getByText(label, { exact: true }).first().click({ timeout: 15000 });
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(8000);
  }
  if (step.lands && new URL(page.url()).origin + new URL(page.url()).pathname !== new URL(step.lands).origin + new URL(step.lands).pathname) {
    throw new Error(`[onboarding:${slug}] ${step.url} was meant to land on ${step.lands} and landed on ${page.url()}`);
  }
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(2000);

  let snapshotTarget = null;
  if (step.mode === "snapshot") {
    const finalUrl = new URL(page.url());
    const root = rootFor(entry, finalUrl.origin);
    if (root === null) throw new Error(`[onboarding:${slug}] ${step.url} ended off the clone's origins at ${page.url()}`);
    const html = rewriteOrigins(await snapshotOf(page), slug, entry, root === "" ? null : "site");
    snapshotTarget = { root, pathname: finalUrl.pathname, search: finalUrl.search, html };
  }

  await Promise.all(pending);
  await context.close();

  // Written LAST so the raw document the listener stored cannot overwrite the rendered one.
  if (snapshotTarget) {
    const { root, pathname, search, html } = snapshotTarget;
    await writeFileDeep(path.join(cloneRoot, root, diskPathFor(pathname, "")), html);
    // The page is usually reached WITH its query (a redirect names it), and the reader
    // tries the query-bearing file first — so the raw document the listener stored there
    // must be replaced too, or the snapshot is only ever served to a typed plain URL.
    if (search) await writeFileDeep(path.join(cloneRoot, root, diskPathFor(pathname, search, ".html")), html);
    // Any OTHER query variant stored beside it (a redirect that reached the same page with
    // a different query, a handshake payload) is the raw page, and the reader would prefer
    // it to the snapshot for that query. Removed, so every query falls back to the snapshot.
    const kept = search ? path.basename(diskPathFor(pathname, search, ".html")) : null;
    const stem = path.basename(diskPathFor(pathname, "?x")).replace(/\.__q[0-9a-f]+.*$/, "");
    const dir = path.join(cloneRoot, root, path.dirname(diskPathFor(pathname, "?x")));
    for (const name of await readdir(dir).catch(() => [])) {
      if (name.startsWith(`${stem}.__q`) && name !== kept) await rm(path.join(dir, name));
    }
  }
  return { written, finalUrl: response ? page.url() : step.url };
}

const REWRITABLE = new Set([".html", ".css", ".js", ".mjs", ".json", ".txt"]);

async function* textFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* textFiles(full);
      continue;
    }
    if (entry.name === REDIRECTS_FILE || entry.name === ACTIONS_FILE) continue;
    if (REWRITABLE.has(path.extname(entry.name).toLowerCase())) yield full;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , slug] = process.argv;
  if (!slug) {
    console.error("usage: node scripts/capture-onboarding.mjs <slug>");
    process.exit(1);
  }
  const catalogue = JSON.parse(await readFile(path.join(process.cwd(), "src/lib/clone-onboarding.json"), "utf8"));
  const entry = catalogue[slug];
  if (!entry) throw new Error(`[onboarding] no entry for ${slug} in src/lib/clone-onboarding.json`);

  const cloneRoot = path.join(process.cwd(), "clones", slug);
  const redirects = new Map();
  const actions = new Map();
  const browser = await chromium.launch();
  for (const step of entry.steps) {
    for (const pass of PASSES) {
      // A snapshot is one rendered state; the extra passes only add asset variants.
      if (step.mode === "snapshot" && pass !== PASSES[0]) continue;
      const result = await captureStep(browser, slug, entry, step, pass, cloneRoot, redirects, actions);
      console.log(`[onboarding:${slug}] ${step.url} (${step.mode}, ${pass.label}) -> ${result.finalUrl}: ${result.written} written`);
    }
  }
  await browser.close();

  // One redirects file per root, merged with whatever an earlier capture recorded.
  const byRoot = new Map();
  for (const record of redirects.values()) {
    if (!byRoot.has(record.root)) byRoot.set(record.root, {});
    byRoot.get(record.root)[record.path] = { status: record.status, location: record.location };
  }
  for (const [root, records] of byRoot) {
    const file = path.join(cloneRoot, root, REDIRECTS_FILE);
    let existing = {};
    try {
      existing = JSON.parse(await readFile(file, "utf8"));
    } catch {
      // first capture for this root
    }
    await writeFileDeep(file, `${JSON.stringify({ ...existing, ...records }, null, 2)}\n`);
    console.log(`[onboarding:${slug}] ${Object.keys(records).length} redirect(s) recorded in ${path.join(root, REDIRECTS_FILE) || REDIRECTS_FILE}`);
  }

  const actionsByRoot = new Map();
  for (const record of actions.values()) {
    if (!actionsByRoot.has(record.root)) actionsByRoot.set(record.root, {});
    actionsByRoot.get(record.root)[record.id] = { status: record.status, headers: record.headers, body: record.body };
  }
  for (const [root, records] of actionsByRoot) {
    const file = path.join(cloneRoot, root, ACTIONS_FILE);
    let existing = {};
    try {
      existing = JSON.parse(await readFile(file, "utf8"));
    } catch {
      // first capture for this root
    }
    await writeFileDeep(file, `${JSON.stringify({ ...existing, ...records }, null, 2)}\n`);
    console.log(`[onboarding:${slug}] ${Object.keys(records).length} server action(s) recorded in ${path.join(root, ACTIONS_FILE)}`);
  }

  let rewritten = 0;
  for await (const file of textFiles(cloneRoot)) {
    const relative = path.relative(cloneRoot, file);
    const inSite = relative.startsWith(`${SITES_DIR}${path.sep}`) ? relative.split(path.sep)[1] : null;
    const before = await readFile(file, "utf8");
    const after = rewriteOrigins(before, slug, entry, inSite);
    if (after !== before) {
      await writeFile(file, after);
      rewritten += 1;
    }
  }
  console.log(`[onboarding:${slug}] ${rewritten} file(s) had a reference to one of the clone's origins pointed at its lab host`);
}
