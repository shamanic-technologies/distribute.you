#!/usr/bin/env node
/**
 * Freezes one of OUR OWN past landings into `apps/landing/archives/<slug>/`.
 *
 * The competitor clones next door are captured over HTTP because the origin is somebody
 * else's server. Ours is in git, so this reads the commit instead: same repository, same
 * bytes, and a re-run against the same commit produces the same directory. Nothing here
 * touches the network.
 *
 * WHAT IS STORED IS WHAT THE SERVER SENT, not what sat in `public/`. On the archived date
 * `/` was a route handler that read the file and rewrote it before answering — asset
 * references, product URLs, live-figure tokens — so storing the raw file would store
 * something no visitor ever received, and its pages would render without a stylesheet
 * (every one of them references `css/styles.css` RELATIVELY, which only resolved because
 * the handler rewrote it). So the capture replays that handler's rewrites once, here, and
 * the archive is served as bytes afterwards.
 *
 * TWO deliberate departures from what the live server did, both stated in the catalogue:
 *
 *   - NO analytics. The live handler injected GA, Google Ads and PostHog into every page.
 *     An archive that reported into them would write today's browsing into the record of
 *     a date that is over.
 *
 *   - The live-figure tokens take the LAST-KNOWN-GOOD constants the handler itself
 *     carried, which is exactly what it substituted whenever the metrics API was
 *     unreachable. A token left raw would render as `__OPEN_RATE__` on the page, and a
 *     figure fetched TODAY would be a number from this year printed on a page from that
 *     one.
 *
 * Both the rewrite table and those constants are READ OUT OF THE ARCHIVED COMMIT rather
 * than transcribed here, so a hand-typing slip cannot put a value in the archive that the
 * server never served.
 *
 * Usage: node scripts/capture-archive.mjs <slug>
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.join(HERE, "..");
const REPO_ROOT = path.join(APP_ROOT, "..", "..");

/**
 * The archives this script knows how to rebuild.
 *
 * Kept here rather than imported from `src/lib/archive-catalogue.ts` because that module
 * is TypeScript compiled into the app, while this is a plain node script — and because
 * the two answer different questions: the catalogue says what is SERVED, this says how it
 * was BUILT. `tests/unit/archive-serving.test.ts` pins the slugs equal.
 */
const RECIPES = {
  "2026-06-15": {
    commit: "65b74ca9964786c2b7c5c8ec810ab548cd0eb479",
    /** Where the pages lived in that commit. */
    pagesDir: "apps/landing/public/landing",
    /** Where the route handlers lived, so the URL→file map is read rather than guessed. */
    appDir: "apps/landing/src/app",
    /** The module whose rewrites the handler applied, and whose fallback figures it held. */
    handler: "apps/landing/src/lib/static-html.ts",
    /** The product URLs the handler substituted into every page. */
    urls: "shared/content/src/urls.ts",
  },
};

function git(...args) {
  return execFileSync("git", ["-C", REPO_ROOT, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function gitBinary(...args) {
  return execFileSync("git", ["-C", REPO_ROOT, ...args], { maxBuffer: 64 * 1024 * 1024 });
}

/** Every path under `prefix` at that commit. */
function treeFiles(commit, prefix) {
  return git("ls-tree", "-r", "--name-only", commit, prefix)
    .split("\n")
    .filter((line) => line.length > 0);
}

/**
 * The URL each page was served at, read from the route handlers themselves.
 *
 * A hand-written map would be a second statement of something the commit already
 * contains, and it would go stale silently: a page whose route the map forgot is simply
 * absent from the archive, which reads as a capture that succeeded.
 */
function routeMap(recipe) {
  const map = new Map();
  for (const file of treeFiles(recipe.commit, recipe.appDir)) {
    if (!file.endsWith("/route.ts")) continue;
    const source = git("show", `${recipe.commit}:${file}`);
    const served = /staticResponse\("([^"]+)"\)/.exec(source);
    if (served === null) continue;
    const url = file.slice(recipe.appDir.length, -"/route.ts".length) || "/";
    map.set(url, served[1]);
  }
  return map;
}

/**
 * The handler's own `.replaceAll("a", "b")` sequence, in order, with `URLS.x` resolved.
 *
 * Read rather than copied: the sequence is what made a page renderable (the relative asset
 * references) and what pointed its buttons at the product, and re-typing it here is how
 * an archive comes to differ from the thing it claims to be a photograph of.
 */
function rewriteTable(recipe) {
  const handler = git("show", `${recipe.commit}:${recipe.handler}`);
  const urlsSource = git("show", `${recipe.commit}:${recipe.urls}`);

  const urls = new Map();
  for (const [, key, value] of urlsSource.matchAll(/^\s+(\w+):\s*"([^"]+)",?$/gm)) {
    urls.set(key, value);
  }

  const sequence = /const rewritten = html\n([\s\S]*?);\n/.exec(handler);
  if (sequence === null) throw new Error(`[capture] no rewrite sequence in ${recipe.handler}`);

  const table = [];
  for (const match of sequence[1].matchAll(
    /\.replaceAll\(\s*'([^']*)',\s*(?:'([^']*)'|`([^`]*)`),?\s*\)/g,
  )) {
    const from = match[1];
    const literal = match[2];
    const template = match[3];
    if (literal !== undefined) {
      table.push([from, literal]);
      continue;
    }
    const resolved = template.replace(/\$\{URLS\.(\w+)\}/g, (_, key) => {
      const value = urls.get(key);
      if (value === undefined) throw new Error(`[capture] URLS.${key} not found`);
      return value;
    });
    table.push([from, resolved]);
  }

  if (table.length === 0) throw new Error(`[capture] empty rewrite table for ${recipe.commit}`);
  return table;
}

/**
 * The figures the handler fell back to when the metrics API did not answer.
 *
 * Parsed out of its own constant, so the archive can only ever carry numbers that commit
 * was able to serve.
 */
function fallbackFigures(recipe) {
  const handler = git("show", `${recipe.commit}:${recipe.handler}`);
  const block = /FALLBACK_LIVE_PERFORMANCE_METRICS[^=]*=\s*\{([\s\S]*?)\n\};/.exec(handler);
  if (block === null) throw new Error(`[capture] no fallback figures in ${recipe.handler}`);

  const figures = new Map();
  for (const [, key, value] of block[1].matchAll(/^\s+(\w+):\s*"([^"]*)",?$/gm)) {
    figures.set(key, value);
  }
  if (figures.size === 0) throw new Error(`[capture] fallback figures parsed empty`);
  return figures;
}

/**
 * The token→figure substitutions, longest token first.
 *
 * The order is what stops `__OPEN_RATE__` from eating the front of
 * `__OPEN_RATE_NUMERIC__`; the handler achieved the same by listing the numeric ones
 * first, which is an ordering nobody would notice was load-bearing.
 */
function tokenTable(figures) {
  const pairs = [
    ["__BEST_POSITIVE_REPLY_COST_NUMERIC__", "costPerPositiveReplyNumeric"],
    ["__BEST_POSITIVE_REPLY_COST__", "costPerPositiveReplyLabel"],
    ["__OPEN_RATE_NUMERIC__", "openRateNumeric"],
    ["__OPEN_RATE__", "openRateLabel"],
    ["__POSITIVE_REPLY_RATE_NUMERIC__", "positiveReplyRateNumeric"],
    ["__POSITIVE_REPLY_RATE__", "positiveReplyRateLabel"],
    ["__OPENED_PER_HUNDRED_NUMERIC__", "openedPerHundredNumeric"],
    ["__OPENED_PER_HUNDRED__", "openedPerHundredLabel"],
    ["__POSITIVE_REPLIES_PER_HUNDRED_NUMERIC__", "positiveRepliesPerHundredNumeric"],
    ["__POSITIVE_REPLIES_PER_HUNDRED_RANGE__", "positiveRepliesPerHundredRangeLabel"],
    ["__POSITIVE_REPLIES_PER_HUNDRED_BAR_NUMERIC__", "positiveRepliesPerHundredBarNumeric"],
    ["__POSITIVE_REPLIES_PER_HUNDRED__", "positiveRepliesPerHundredLabel"],
    ["__EMAILS_SENT_NUMERIC__", "emailsSentNumeric"],
    ["__EMAILS_SENT__", "emailsSentLabel"],
  ];

  const table = pairs
    .map(([token, key]) => {
      const value = figures.get(key);
      if (value === undefined) throw new Error(`[capture] fallback figure ${key} missing`);
      return [token, value];
    })
    .sort((a, b) => b[0].length - a[0].length);

  // The handler also carried the pre-token literal on the counter's data attribute.
  const numeric = figures.get("costPerPositiveReplyNumeric");
  table.push([`data-n="1.42"`, `data-n="${numeric}"`]);
  return table;
}

/**
 * Where a URL's bytes live inside the archive.
 *
 * Mirrors `clonePathFor` in `src/lib/clone-files.ts`, which the archive route reuses: an
 * extension-less request reads `<path>/index.html`. `tests/unit/archive-serving.test.ts`
 * imports that reader and walks every URL through it, because a disagreement here is a
 * 404 on a page that is sitting on disk.
 */
function storedPathFor(url) {
  return url === "/" ? "index.html" : `${url.replace(/^\//, "")}/index.html`;
}

function capture(slug) {
  const recipe = RECIPES[slug];
  if (recipe === undefined) {
    throw new Error(`[capture] unknown archive "${slug}". Known: ${Object.keys(RECIPES).join(", ")}`);
  }

  const root = path.join(APP_ROOT, "archives", slug);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  const rewrites = rewriteTable(recipe);
  const tokens = tokenTable(fallbackFigures(recipe));
  const pages = routeMap(recipe);

  let written = 0;
  for (const [url, file] of [...pages].sort()) {
    let html = git("show", `${recipe.commit}:${recipe.pagesDir}/${file}`);
    for (const [from, to] of rewrites) html = html.replaceAll(from, to);
    for (const [from, to] of tokens) html = html.replaceAll(from, to);

    const target = path.join(root, storedPathFor(url));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, html);
    written += 1;
    console.log(`[capture] ${url} <- ${file}`);
  }

  // Assets are stored under the prefix the rewrites point at, byte for byte: the handler
  // rewrote the REFERENCES and never the stylesheet or the scripts themselves.
  let assets = 0;
  for (const file of treeFiles(recipe.commit, recipe.pagesDir)) {
    const relative = file.slice(recipe.pagesDir.length + 1);
    if (relative.endsWith(".html")) continue;
    const target = path.join(root, "landing", relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, gitBinary("show", `${recipe.commit}:${file}`));
    assets += 1;
    console.log(`[capture] /landing/${relative}`);
  }

  console.log(`[capture] ${slug}: ${written} pages, ${assets} assets from ${recipe.commit.slice(0, 8)}`);
}

const slug = process.argv[2];
if (slug === undefined) {
  console.error("usage: node scripts/capture-archive.mjs <slug>");
  process.exit(1);
}
capture(slug);
