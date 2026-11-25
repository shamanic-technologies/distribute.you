import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Owner 2026-11-17: "Partout ... tu dis It's FREE ... Alors que ce n'est pas free. C'est
 * usage based" then "Usage based, 0% markup". The hosted AI agent is billed per action
 * from a prepaid balance (auto reload charges it), so no public or signup surface may
 * call OUR product free, nor promise "no monthly fee" / "$0/month". Only the open source
 * version run on your own server is free, said with that scope ("on your server",
 * "free to run yourself").
 *
 * Competitor facts stay allowed ("Seamless.AI is free for up to 50 credits", a "Start free
 * trial" button on their site, a competitor plan row priced "$0/month"): the patterns
 * below name OUR subjects, and the two competitor shapes are carved out precisely.
 */

const LANDING = path.resolve(__dirname, "../..");
const REPO = path.resolve(LANDING, "../..");

function walk(dir: string, exts: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, exts));
    else if (exts.test(name)) out.push(p);
  }
  return out;
}

/** Every public and signup surface that speaks for us. */
export function surfaces(): string[] {
  return [
    // The lab's own offer (LAB-SOLO-PIVOT-1125, owner 2026-11-25) has a Free plan on your own keys:
    // its two files only reach the password-gated lab host, never a public page.
    ...walk(path.join(LANDING, "src"), /\.(ts|tsx)$/).filter((f) => !/[\\/]lib[\\/]lab-(?:offer|docs)\.ts$/.test(f)),
    ...walk(path.join(LANDING, "content/blog"), /\.(html|json)$/),
    ...walk(path.join(REPO, "shared/content/src"), /\.ts$/),
    ...walk(path.join(REPO, "apps/dashboard/src/app/(authed)/sign-up"), /\.tsx?$/),
    ...walk(path.join(REPO, "apps/dashboard/src/components/auth"), /\.tsx?$/),
    path.join(LANDING, "public/landing/index-v2.html"),
    path.join(LANDING, "public/llms.txt"),
    path.join(LANDING, "public/docs/llms.txt"),
  ];
}

/** Claims that our product, agent or plan is free. Case-insensitive. */
const BANNED: readonly RegExp[] = [
  /start free(?! trial)/i, // our CTA is "Get started"; "Start free trial" is a competitor's button
  /\bit['’]s free/i,
  /(platform|agent|distribute\.you|our plan) is free/i,
  /is a free ai agent/i,
  /free to start/i,
  /no monthly fee/i,
  /\$0\/month/i,
  /plan-price">Free<small>(?!on your server)/i,
  /\bfree(\.|,) (every|at the api|api price|0% markup|your budget)/i,
  /, free\.(?=\s|"|`|<|$)/im,
  /, free(?=[`"])/i,
];

/** A competitor plan row (`{ plan: "Free", price: "$0/month", ... }`) states THEIR price. */
const COMPETITOR_PRICE_ROW = /\bplan: "[^"]*", price: "\$0\/month"/;

export function freeClaims(text: string): string[] {
  const hits: string[] = [];
  for (const line of text.split("\n")) {
    for (const re of BANNED) {
      if (!re.test(line)) continue;
      if (re.source.includes("\\$0") && COMPETITOR_PRICE_ROW.test(line)) continue;
      hits.push(`${re.source} :: ${line.trim().slice(0, 140)}`);
    }
  }
  return hits;
}

describe("no surface calls our product free (owner 2026-11-17: usage based, 0% markup)", () => {
  it("the predicate catches the retired wording and lets competitor facts through", () => {
    for (const old of [
      '<a class="btn btn-accent" href="/x">Start free</a>',
      "The platform is free. You choose how much goes to your outreach.",
      '<div class="plan-price">Free<small>no monthly fee</small></div>',
      '<th scope="col">Free to start</th>',
      "Revenue made easy. Our AI agent books your meetings. Free, at the API price with 0% markup.",
      "distribute.you is the AI SDR that books your meetings, free. Compare price.",
      'description: "Free. Every action at the API price, 0% markup."',
      "distribute.you is free, and every action is billed at the API price.",
      "Hosted, $0/month.",
      "It's free.",
    ]) {
      expect(freeClaims(old), old).not.toEqual([]);
    }
    for (const fact of [
      "Seamless.AI is free for up to 50 credits.",
      'Solo has a Start free trial button.',
      '{ plan: "Free", price: "$0/month", note: "Free for up to 2 users" },',
      '<div class="plan-price">Free<small>on your server</small></div>',
      "Usage based, 0% markup. Every action at the API price.",
      "Open source under MIT, free to run yourself.",
    ]) {
      expect(freeClaims(fact), fact).toEqual([]);
    }
  });

  it("every public and signup surface is clean", () => {
    const files = surfaces();
    expect(files.length).toBeGreaterThan(50);
    const found: string[] = [];
    for (const f of files) {
      for (const hit of freeClaims(readFileSync(f, "utf8"))) found.push(`${path.relative(REPO, f)}: ${hit}`);
    }
    expect(found).toEqual([]);
  });
});
