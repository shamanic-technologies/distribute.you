import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACTIONS_FILE,
  CLONES,
  CLONE_ONBOARDING,
  REDIRECTS_FILE,
  SITES_DIR,
  cloneSlugForHost,
  cloneTargetForHost,
} from "@/lib/clone-catalogue";
import { clonePathFor } from "@/lib/clone-files";
// The capture script: plain ESM, CLI guarded on argv, so importing it runs nothing.
import {
  ACTIONS_FILE as SCRIPT_ACTIONS_FILE,
  REDIRECTS_FILE as SCRIPT_REDIRECTS_FILE,
  SITES_DIR as SCRIPT_SITES_DIR,
  labHostFor,
  rewriteOrigins,
  rootFor,
} from "../../scripts/capture-onboarding.mjs";

const REPO_APP = path.resolve(__dirname, "../..");
const CLONES_DIR = path.join(REPO_APP, "clones");

const gojiberry = CLONE_ONBOARDING.gojiberry;

/** The directory a URL of this clone is stored under, relative to `clones/<slug>/`. */
function rootOf(slug: string, url: string): string {
  const root = rootFor(CLONE_ONBOARDING[slug], new URL(url).origin);
  if (root === null) throw new Error(`${url} is not one of ${slug}'s origins`);
  return root;
}

/** Stored for this URL: a file (plain or query variant) or a recorded redirect. */
function storedFor(slug: string, url: string): "file" | "redirect" | null {
  const parsed = new URL(url);
  const root = path.join(CLONES_DIR, slug, rootOf(slug, url));
  const plain = clonePathFor(parsed.pathname);
  if (plain && existsSync(path.join(root, plain))) return "file";
  if (parsed.search) {
    const stem = clonePathFor(parsed.pathname, parsed.search);
    if (stem) {
      const dir = path.join(root, path.dirname(stem));
      if (existsSync(dir) && readdirSync(dir).some((name) => name.startsWith(path.basename(stem)))) return "file";
    }
  }
  const redirects = path.join(root, REDIRECTS_FILE);
  if (existsSync(redirects)) {
    const records = JSON.parse(readFileSync(redirects, "utf8"));
    if (records[parsed.pathname.replace(/\/+$/, "") || "/"]) return "redirect";
  }
  return null;
}

describe("onboarding hosts", () => {
  it("resolves a site host to its clone and its site", () => {
    expect(cloneTargetForHost("lab-gojiberry-app.distribute.you")).toEqual({ slug: "gojiberry", site: "app" });
    expect(cloneTargetForHost("LAB-Explee-Auth.distribute.you:3000")).toEqual({ slug: "explee", site: "auth" });
    // The proxy only needs the slug; a site host rewrites onto its clone like the landing.
    expect(cloneSlugForHost("lab-gojiberry-app.distribute.you")).toBe("gojiberry");
  });

  it("keeps a landing host on its landing", () => {
    for (const clone of CLONES) {
      expect(cloneTargetForHost(`lab-${clone.slug}.distribute.you`)).toEqual({ slug: clone.slug, site: null });
    }
  });

  it("refuses a site the catalogue does not name", () => {
    expect(cloneTargetForHost("lab-gojiberry-admin.distribute.you")).toBeNull();
    expect(cloneTargetForHost("lab-revid-app.distribute.you")).toBeNull();
  });

  it("never lets a site host shadow another clone", () => {
    const slugs = new Set(CLONES.map((clone) => clone.slug));
    for (const clone of CLONES) {
      for (const site of CLONE_ONBOARDING[clone.slug].sites) {
        expect(slugs.has(`${clone.slug}-${site.label}`)).toBe(false);
        expect(site.label).toMatch(/^[a-z0-9]+$/);
      }
    }
  });

  it("spells a site host the same way in the capture script", () => {
    expect(labHostFor("gojiberry", "app")).toBe("lab-gojiberry-app.distribute.you");
    expect(labHostFor("gojiberry")).toBe("lab-gojiberry.distribute.you");
    expect(SCRIPT_SITES_DIR).toBe(SITES_DIR);
    expect(SCRIPT_REDIRECTS_FILE).toBe(REDIRECTS_FILE);
    expect(SCRIPT_ACTIONS_FILE).toBe(ACTIONS_FILE);
  });
});

describe("pointing a clone's references at its own lab hosts", () => {
  it("sends a landing CTA to our copy of the app", () => {
    expect(rewriteOrigins('href="https://app.gojiberry.ai/registration"', "gojiberry", gojiberry, null)).toBe(
      'href="https://lab-gojiberry-app.distribute.you/registration"',
    );
  });

  it("rewrites the JSON-escaped form a bundle carries", () => {
    expect(rewriteOrigins('"https:\\/\\/app.gojiberry.ai\\/login"', "gojiberry", gojiberry, null)).toBe(
      '"https:\\/\\/lab-gojiberry-app.distribute.you\\/login"',
    );
  });

  it("does not claim a longer host that merely starts the same way", () => {
    const text = "https://app.gojiberry.ai.evil.com/x https://api.gojiberry.ai/v1";
    expect(rewriteOrigins(text, "gojiberry", gojiberry, null)).toBe(text);
  });

  it("points the landing origin home only from inside a site", () => {
    // On the landing those references are already same-origin; rewriting them would touch
    // its canonical and its JSON-LD and nothing a click reaches.
    expect(rewriteOrigins("https://gojiberry.ai/#pricing", "gojiberry", gojiberry, null)).toBe(
      "https://gojiberry.ai/#pricing",
    );
    expect(rewriteOrigins("https://gojiberry.ai/#pricing", "gojiberry", gojiberry, "app")).toBe(
      "https://lab-gojiberry.distribute.you/#pricing",
    );
  });
});

describe("every clone's onboarding is catalogued and on disk", () => {
  it("has an entry per clone, anchored on the clone's own origin", () => {
    expect(Object.keys(CLONE_ONBOARDING).sort()).toEqual(CLONES.map((clone) => clone.slug).sort());
    for (const clone of CLONES) {
      const entry = CLONE_ONBOARDING[clone.slug];
      expect(entry.origin).toBe(new URL(clone.source).origin);
      expect(entry.steps.length).toBeGreaterThan(0);
      // The wall is the half of the report the owner decides on; it is never left blank.
      expect(entry.wall.length).toBeGreaterThan(80);
    }
  });

  it("names only steps on the clone's own origins, and says where a click lands", () => {
    for (const clone of CLONES) {
      const entry = CLONE_ONBOARDING[clone.slug];
      for (const step of entry.steps) {
        expect(["bytes", "snapshot"]).toContain(step.mode);
        expect(() => rootOf(clone.slug, step.url)).not.toThrow();
        if (step.click) {
          expect(step.lands, `${clone.slug} ${step.url} clicks but never says where it lands`).toBeTruthy();
          expect(() => rootOf(clone.slug, step.lands!)).not.toThrow();
        }
      }
    }
  });

  it("stores every step, as a page or as the redirect the origin answered", () => {
    for (const clone of CLONES) {
      for (const step of CLONE_ONBOARDING[clone.slug].steps) {
        const target = step.lands ?? step.url;
        expect(storedFor(clone.slug, target), `${clone.slug}: nothing stored for ${target}`).not.toBeNull();
      }
    }
  });

  it("stores a snapshot with no script left in it", () => {
    // A script left in a snapshot boots, calls the auth provider off its domain, and tears
    // the rendered card down to the empty one the snapshot exists to replace.
    for (const clone of CLONES) {
      for (const step of CLONE_ONBOARDING[clone.slug].steps.filter((s) => s.mode === "snapshot")) {
        const target = new URL(step.lands ?? step.url);
        const file = path.join(CLONES_DIR, clone.slug, rootOf(clone.slug, target.toString()), clonePathFor(target.pathname)!);
        const html = readFileSync(file, "utf8");
        expect(html, `${file} still carries a script`).not.toMatch(/<script\b/i);
        expect(html.length).toBeGreaterThan(2000);
      }
    }
  });

  it("gives every site a directory, and leaves no landing CTA pointing at a site's origin", () => {
    for (const clone of CLONES) {
      const entry = CLONE_ONBOARDING[clone.slug];
      for (const site of entry.sites) {
        expect(existsSync(path.join(CLONES_DIR, clone.slug, SITES_DIR, site.label))).toBe(true);
        const landing = readFileSync(path.join(CLONES_DIR, clone.slug, "index.html"), "utf8");
        expect(landing, `${clone.slug}/index.html still links ${site.origin}`).not.toContain(`${site.origin}/`);
      }
    }
  });

  it("replays only redirects and actions that stay on our hosts", () => {
    for (const clone of CLONES) {
      const roots = ["", ...CLONE_ONBOARDING[clone.slug].sites.map((site) => path.join(SITES_DIR, site.label))];
      for (const root of roots) {
        const dir = path.join(CLONES_DIR, clone.slug, root);
        const redirects = path.join(dir, REDIRECTS_FILE);
        if (existsSync(redirects)) {
          for (const [from, record] of Object.entries(JSON.parse(readFileSync(redirects, "utf8"))) as [
            string,
            { status: number; location: string },
          ][]) {
            expect(record.status).toBeGreaterThanOrEqual(300);
            expect(record.status).toBeLessThan(400);
            expect(new URL(record.location).hostname, `${clone.slug} ${from}`).toMatch(/^lab-[a-z0-9-]+\.distribute\.you$/);
            // A hop back onto its own path would loop on every miss.
            expect(new URL(record.location).pathname.replace(/\/+$/, "") || "/").not.toBe(from);
          }
        }
        const actions = path.join(dir, ACTIONS_FILE);
        if (existsSync(actions)) {
          for (const record of Object.values(JSON.parse(readFileSync(actions, "utf8"))) as {
            headers: Record<string, string>;
          }[]) {
            const redirect = record.headers["x-action-redirect"];
            if (redirect) expect(new URL(redirect.split(";")[0]).hostname).toMatch(/^lab-[a-z0-9-]+\.distribute\.you$/);
          }
        }
      }
    }
  });
});

describe("the serving surface for onboarding", () => {
  const route = readFileSync(path.join(REPO_APP, "src/app/internal-clone/[slug]/[[...path]]/route.ts"), "utf8");
  const config = readFileSync(path.join(REPO_APP, "next.config.ts"), "utf8");

  it("reads a site's files from its own root, chosen by the host", () => {
    expect(route).toContain("cloneTargetForHost(host)");
    expect(route).toContain("path.join(base, SITES_DIR, target.site)");
    // The landing root holds the sites and the recorded files; none of them is a page.
    expect(route).toContain("first === SITES_DIR || first === REDIRECTS_FILE || first === ACTIONS_FILE");
  });

  it("replays a server action only when one was recorded, and executes nothing", () => {
    const post = route.slice(route.indexOf("export async function POST("));
    expect(post).toContain('request.headers.get("next-action")');
    expect(post).toContain("actions[actionId]");
    expect(post).toContain("status: 404");
    expect(post).toContain('"x-robots-tag": "noindex, nofollow"');
  });

  it("keeps every one of OUR redirects off the lab hosts", () => {
    // Config redirects run before the proxy: an unguarded `/sign-in` sent a competitor's
    // own sign-in page to our dashboard before the clone ever saw the request.
    const block = config.slice(config.indexOf("async redirects()"));
    const sources = block.match(/source: "/g) ?? [];
    const guarded = block.match(/missing: offLab/g) ?? [];
    expect(sources.length).toBeGreaterThan(0);
    expect(guarded.length).toBe(sources.length);
  });
});
