#!/usr/bin/env node
/**
 * Fifth capture pass: a competitor's onboarding PAST the signup, recorded by hand.
 *
 *   node scripts/har-to-flow.mjs <slug> <capture-dir>
 *
 * `capture-onboarding.mjs` stops at the wall because it never types into a form. This
 * pass takes what a person produced by walking the flow in a real browser with an
 * account of our own (a HAR of every response, one DOM file and one screenshot per
 * screen) and turns it into something the clone route can serve:
 *
 *  - `__flow/NN-<step>.html`: each screen's DOM with its scripts removed and a <base>
 *    pointing at the lab host of the origin it was rendered on, so its stylesheets
 *    resolve against our copy. Faithful to look at, inert to click (same contract as a
 *    snapshot step: the app behind it needs a live session we do not replay).
 *  - `__flow/shots/NN-<step>.jpg`: what the screen looked like.
 *  - `__flow/api/*.json`: the first successful JSON answer of every endpoint the flow
 *    called on the competitor's own hosts, with anything credential-shaped redacted.
 *    This is their data model, which is most of what there is to learn.
 *  - every asset (css, js, fonts, images) the flow loaded from the clone's own origins,
 *    written where `diskPathFor` says the reader will look, never over a file the other
 *    passes already stored.
 *  - `__flow/index.html`: the flow, in order, one screenshot per step.
 *
 * The capture dir is `<dir>/flow.har`, `<dir>/dom/*.html`, `<dir>/shots/*.png`.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { ACTIONS_FILE, REDIRECTS_FILE, labHostFor, rewriteOrigins, rootFor } from "./capture-onboarding.mjs";
import { QUERY_MARKER, queryHash } from "./clone-site.mjs";

export const RESPONSES_FILE = "__responses.json";
import { diskPathFor, extensionForContentType } from "./clone-site.mjs";

const [, , slug, captureDir] = process.argv;
if (!slug || !captureDir) {
  console.error("usage: har-to-flow.mjs <slug> <capture-dir>");
  process.exit(1);
}

const LANDING = path.resolve(import.meta.dirname, "..");
const cloneRoot = path.join(LANDING, "clones", slug);
const flowDir = path.join(cloneRoot, "__flow");
const catalogue = JSON.parse(await readFile(path.join(LANDING, "src/lib/clone-onboarding.json"), "utf8"));
const entry = catalogue[slug];
if (!entry) throw new Error(`no onboarding entry for ${slug}`);

/** Hosts whose JSON we keep: the clone's origins plus their API subdomains. */
const ownHosts = new Set([entry.origin, ...entry.sites.map((s) => s.origin)].map((o) => new URL(o).host));
const apex = new URL(entry.origin).host.replace(/^www\./, "");
const isOwnApi = (host) => host === apex || host.endsWith(`.${apex}`);

/** Analytics and tracking endpoints: noise, and they carry visitor ids. */
const NOISE = /\/(ingest|track|capi|flags|s|e|i\/v0\/e)\/?$|\/api\/track|\/api\/capi|\/ingest\//;

const SECRET_KEY = /token|jwt|secret|password|session|cookie|authorization|signature|api[_-]?key/i;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) && typeof v !== "object" ? "[redacted]" : redact(v)]),
    );
  }
  if (typeof value === "string" && /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) return "[redacted jwt]";
  return value;
}

async function writeDeep(target, body) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

const har = JSON.parse(await readFile(path.join(captureDir, "flow.har"), "utf8"));

// ─── Replay: what keeps the walked flow CLICKABLE on the clone ─────────────────────────
// Per root (the landing, or one of its sites): recorded API answers, Next server-action
// answers, and redirect hops, all merged into what earlier passes stored, never over it.
const replay = new Map(); // root -> { responses, actions, redirects }
const rscPages = new Set();
const replayFor = (root) => {
  if (!replay.has(root)) replay.set(root, { responses: {}, actions: {}, redirects: {} });
  return replay.get(root);
};
const header = (list, name) => list.find((h) => h.name.toLowerCase() === name)?.value ?? null;
/** Beacons that only need a 2xx so the page does not log an error. */
const BEACON = /\/cdn-cgi\/rum|\/api\/track|\/api\/capi|\/ingest\//;

for (const e of har.log.entries) {
  const url = new URL(e.request.url);
  const root = rootFor(entry, url.origin);
  if (root === null) continue;
  const method = e.request.method;
  const res = e.response;
  const content = res.content ?? {};
  const mime = (content.mimeType ?? "").split(";")[0].trim();
  const key = `${method} ${url.pathname.replace(/\/+$/, "") || "/"}`;
  const bucket = replayFor(root);

  if (res.status >= 300 && res.status < 400) {
    const location = header(res.headers, "location");
    const pathKey = url.pathname.replace(/\/+$/, "") || "/";
    if (method === "GET" && location && !bucket.redirects[pathKey]) {
      bucket.redirects[pathKey] = { status: res.status, location: rewriteOrigins(new URL(location, url).toString(), slug, entry, "any") };
    }
    continue;
  }
  if (res.status < 200 || res.status >= 300) continue;

  const actionId = header(e.request.headers, "next-action");
  if (method === "POST" && actionId) {
    // Keyed by id AND page: one action id answers differently per page it is called from
    // (explee's project action rendered the project when replayed on the home page).
    const scoped = `${actionId} ${url.pathname.replace(/\/+$/, "") || "/"}`;
    if (!bucket.actions[scoped] && content.text) {
      bucket.actions[scoped] = { status: res.status, headers: { "content-type": content.mimeType || "text/x-component" }, body: content.text };
    }
    continue;
  }

  // A Next router payload asked with other params beside `_rsc` (`?src=cabinet&_rsc=`) is
  // also stored under the `_rsc`-only name, which is the one a click from the landing asks.
  if (method === "GET" && mime === "text/x-component" && content.text) {
    const rsc = url.searchParams.get("_rsc");
    if (rsc !== null) {
      // Stored where the reader's `_rsc` fallback looks: beside the page's `index.html`,
      // with an `.rsc` extension so it is served as `text/x-component`.
      const clean = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
      const stem = clean === "" ? "index" : `${clean}/index`;
      const target = path.join(cloneRoot, root, `${stem}.${QUERY_MARKER}${queryHash(`?_rsc=${rsc}`)}.rsc`);
      if (!existsSync(target)) await writeDeep(target, Buffer.from(content.text, content.encoding === "base64" ? "base64" : "utf8"));
      if (root === "") rscPages.add(url.pathname.replace(/\/+$/, "") || "/");
    }
    continue;
  }

  if (BEACON.test(url.pathname)) {
    bucket.responses[key] ??= { status: 204, contentType: "text/plain" };
    continue;
  }
  const isData = mime === "application/json" || mime === "text/event-stream" || mime === "text/plain" || mime === "application/octet-stream";
  if (!isData || (method === "GET" && mime === "application/octet-stream" && url.pathname.includes("."))) continue;
  if (bucket.responses[key] && (bucket.responses[key].body || bucket.responses[key].bodyBase64)) continue;
  if (!content.text) continue;
  if (mime === "application/json" && content.encoding !== "base64") {
    // Replayed intact except for anything credential-shaped (a live Stripe client secret,
    // a session token): the flow stays clickable, and nothing of theirs that authenticates is stored.
    const parsed = safeJson(content.text);
    bucket.responses[key] = { status: res.status, contentType: content.mimeType || mime, body: typeof parsed === "string" ? parsed : JSON.stringify(redact(parsed)) };
    continue;
  }
  bucket.responses[key] =
    content.encoding === "base64"
      ? { status: res.status, contentType: content.mimeType || mime, bodyBase64: content.text }
      : { status: res.status, contentType: content.mimeType || mime, body: content.text };
}

// A page the walk reached by CLIENT navigation has a router payload in the HAR and no
// document, so a reload of it (or the router giving up on a payload) 404s. Fetched from
// the origin now, with every chunk it names that the clone does not hold yet.
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" };
let fetchedDocs = 0;
for (const pagePath of rscPages) {
  const doc = path.join(cloneRoot, diskPathFor(pagePath, "", ".html"));
  if (existsSync(doc)) continue;
  const res = await fetch(`${entry.origin}${pagePath}`, { headers: { ...UA, accept: "text/html" } });
  if (!res.ok) {
    console.error(`[har-to-flow] ${pagePath}: origin answered ${res.status}, document not stored`);
    continue;
  }
  const html = await res.text();
  for (const ref of new Set(html.match(/\/_next\/static\/[^"'\s\\]+/g) ?? [])) {
    const plain = path.join(cloneRoot, diskPathFor(ref.split("?")[0]));
    if (existsSync(plain)) continue;
    const asset = await fetch(`${entry.origin}${ref}`, { headers: UA });
    if (asset.ok) await writeDeep(plain, Buffer.from(await asset.arrayBuffer()));
  }
  await writeDeep(doc, rewriteOrigins(html, slug, entry, null));
  fetchedDocs++;
}

async function mergeJson(file, additions) {
  let current = {};
  try {
    current = JSON.parse(await readFile(file, "utf8"));
  } catch {
    // first write
  }
  const merged = { ...additions, ...current };
  if (Object.keys(merged).length > 0) await writeDeep(file, `${JSON.stringify(merged, null, 2)}\n`);
  return Object.keys(merged).length - Object.keys(current).length;
}
const replayCounts = {};
for (const [root, bucket] of replay) {
  const dir = path.join(cloneRoot, root);
  replayCounts[root || "/"] = {
    responses: await mergeJson(path.join(dir, RESPONSES_FILE), bucket.responses),
    actions: await mergeJson(path.join(dir, ACTIONS_FILE), bucket.actions),
    redirects: await mergeJson(path.join(dir, REDIRECTS_FILE), bucket.redirects),
  };
}

let assets = 0;
const writtenDocs = new Set();
const apiSeen = new Set();
let apis = 0;

for (const e of har.log.entries) {
  const url = new URL(e.request.url);
  const res = e.response;
  const content = res.content ?? {};
  if (res.status < 200 || res.status >= 300 || content.text == null) continue;
  const body = content.encoding === "base64" ? Buffer.from(content.text, "base64") : Buffer.from(content.text, "utf8");
  const mime = (content.mimeType ?? "").split(";")[0].trim();

  if (mime === "application/json" && isOwnApi(url.host) && !NOISE.test(url.pathname)) {
    const key = `${e.request.method} ${url.host}${url.pathname}`;
    if (apiSeen.has(key)) continue;
    apiSeen.add(key);
    let parsed;
    try {
      parsed = JSON.parse(body.toString("utf8"));
    } catch {
      continue;
    }
    const name = `${e.request.method}-${url.host}${url.pathname}`.replace(/[^a-z0-9.-]+/gi, "_").slice(0, 180);
    const record = {
      request: { method: e.request.method, url: `${url.origin}${url.pathname}`, query: url.search || null },
      requestBody: e.request.postData?.text ? redact(safeJson(e.request.postData.text)) : null,
      response: redact(parsed),
    };
    await writeDeep(path.join(flowDir, "api", `${name}.json`), `${JSON.stringify(record, null, 2)}\n`);
    apis++;
    continue;
  }

  // The landing's documents from the walk REPLACE the stored ones: the chunks the walk
  // loaded belong to today's build, and a page from an older build asks for chunks the
  // clone does not hold, so the app half-boots. A site's pages stay as the earlier pass
  // stored them (some are snapshots of widgets that refuse to render off their domain).
  if (ownHosts.has(url.host) && e.request.method === "GET" && mime === "text/html") {
    const docRoot = rootFor(entry, url.origin);
    // The FIRST load of a page wins: it is the one an anonymous visitor gets. A later load
    // in the same walk carries the session and resumes the project instead.
    if (docRoot === "" && !url.search && !writtenDocs.has(url.pathname)) {
      writtenDocs.add(url.pathname);
      const doc = path.join(cloneRoot, diskPathFor(url.pathname, "", ".html"));
      await writeDeep(doc, rewriteOrigins(body.toString("utf8"), slug, entry, null));
      assets++;
    }
    continue;
  }
  if (!ownHosts.has(url.host) || e.request.method !== "GET") continue;
  if (["application/json", "text/event-stream", "text/x-component", "text/plain"].includes(mime)) continue;
  const root = rootFor(entry, url.origin);
  if (root === null) continue;
  const target = path.join(cloneRoot, root, diskPathFor(url.pathname, url.search, extensionForContentType(mime)));
  // A Next chunk is named by the hash of its content, so its `?dpl=<deployment>` tail
  // changes nothing but the deployment it was asked from. Stored once more under its
  // plain path, the reader's plain-form fallback serves it to a page from ANY build.
  const onlyDpl = [...url.searchParams.keys()].join() === "dpl";
  const plain = onlyDpl ? path.join(cloneRoot, root, diskPathFor(url.pathname, "", extensionForContentType(mime))) : null;
  if (plain && !existsSync(plain)) await writeDeep(plain, body);
  if (existsSync(target)) continue;
  await writeDeep(target, body);
  assets++;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}

// Screens: strip scripts, pin a <base> to the lab host of the origin each was rendered on.
const domDir = path.join(captureDir, "dom");
const shotDir = path.join(captureDir, "shots");
const steps = [];
const doms = (await readdir(domDir)).filter((f) => f.endsWith(".html")).sort();
const originHosts = [
  [new URL(entry.origin).host, labHostFor(slug)],
  ...entry.sites.map((s) => [new URL(s.origin).host, labHostFor(slug, s.label)]),
];
for (const file of doms) {
  let html = await readFile(path.join(domDir, file), "utf8");
  if (html.length < 200) continue;
  const tag = file.replace(/\.html$/, "");
  const renderedOn = originHosts.find(([host]) => html.includes(host))?.[1] ?? labHostFor(slug);
  html = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]+rel="(?:modulepreload|preload)"[^>]*as="script"[^>]*>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "");
  for (const [host, lab] of originHosts) html = html.replaceAll(`https://${host}`, `https://${lab}`);
  html = html.replace(/<head([^>]*)>/i, `<head$1><base href="https://${renderedOn}/"><meta name="robots" content="noindex">`);
  await writeDeep(path.join(flowDir, `${tag}.html`), html);
  const png = path.join(shotDir, `${tag}.png`);
  if (existsSync(png)) {
    await mkdir(path.join(flowDir, "shots"), { recursive: true });
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", png, "--out", path.join(flowDir, "shots", `${tag}.jpg`)], { stdio: "ignore" });
  }
  steps.push(tag);
}

const index = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${slug} onboarding flow</title>
<style>body{font:14px/1.5 -apple-system,Inter,sans-serif;margin:32px;color:#111}figure{margin:0 0 40px}img{max-width:100%;border:1px solid #ddd;border-radius:8px}figcaption{margin:6px 0}a{color:#2563eb}</style>
</head><body><h1>${slug}: onboarding past the signup</h1>
<p><a href="api/">API answers</a> (${apis} endpoints). Each step links to its frozen DOM.</p>
${steps.map((t) => `<figure><figcaption><a href="${t}.html">${t}</a></figcaption><img loading="lazy" src="shots/${t}.jpg" alt="${t}"></figure>`).join("\n")}
</body></html>
`;
await writeDeep(path.join(flowDir, "index.html"), index);
const apiFiles = existsSync(path.join(flowDir, "api")) ? (await readdir(path.join(flowDir, "api"))).sort() : [];
await writeDeep(
  path.join(flowDir, "api", "index.html"),
  `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"></head><body><ul>${apiFiles
    .filter((f) => f.endsWith(".json"))
    .map((f) => `<li><a href="${f}">${f}</a></li>`)
    .join("")}</ul></body></html>`,
);

console.log(JSON.stringify({ slug, steps: steps.length, apis, assets, replay: replayCounts, fetchedDocs }));
