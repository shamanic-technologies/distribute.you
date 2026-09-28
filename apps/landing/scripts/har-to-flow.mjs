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

import { labHostFor, rootFor } from "./capture-onboarding.mjs";
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
let assets = 0;
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

  if (!ownHosts.has(url.host) || e.request.method !== "GET" || mime === "text/html" || mime === "application/json") continue;
  const root = rootFor(entry, url.origin);
  if (root === null) continue;
  const target = path.join(cloneRoot, root, diskPathFor(url.pathname, url.search, extensionForContentType(mime)));
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

console.log(JSON.stringify({ slug, steps: steps.length, apis, assets }));
