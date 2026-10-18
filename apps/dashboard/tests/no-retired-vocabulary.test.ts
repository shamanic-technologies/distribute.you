import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The dashboard speaks the current model (owner 2026-10-18): a CAMPAIGN is offer x leg x channel,
 * a PIPE is one leg x one channel. The two retired words, and the identifiers built on them, are
 * gone from every file under `src`, comments and docs included. The words are assembled here so
 * this guard does not trip a repo-wide search for them.
 */

const SRC = join(__dirname, "..", "src");
const [C, M] = [["cr", "ew"].join(""), ["miss", "ion"].join("")];
const Cap = (w: string) => w[0].toUpperCase() + w.slice(1);
const BANNED_WORD = new RegExp(`\\b(${C}s?|${M}s?)\\b`, "i");
const BANNED_IDENT = new RegExp(`${Cap(C)}[A-Z]|${Cap(M)}[A-Z]|\\b${C}[A-Z]|\\b${M}[A-Z]|use${Cap(M)}s`);
const banned = (line: string) => BANNED_WORD.test(line) || BANNED_IDENT.test(line);

// Legacy URL route folder (old links and onboarding emails): its pages name it in a comment.
const LEGACY_DIR = `app/(authed)/v2/orgs/[orgId]/brands/[brandId]/${M}s/`;
// A prompt snapshot quoting a brand profile's own company statement field, not our vocabulary.
const DATA_FILES = new Set(["lib/research/research-templates.json"]);
// Workflow links sent before 2026-10-18 carry the retired parameter names.
const ALLOWED_LINES = new Set([
  `// Legacy links (before 2026-10-18) carry \`${C}\` and \`${M}\` for the pipe and the campaign.`,
  `const pipeRaw = search.get("pipe") ?? search.get("${C}") ?? "";`,
  `const campaignRaw = search.get("campaign") ?? search.get("${M}");`,
]);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe("the retired vocabulary is gone from the dashboard source", () => {
  it("no file under src names it, outside the legacy URL folder and its link params", () => {
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(500);
    const hits: string[] = [];
    for (const f of files) {
      const rel = relative(SRC, f);
      if (rel.startsWith(LEGACY_DIR) || DATA_FILES.has(rel)) continue;
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (banned(line) && !ALLOWED_LINES.has(line.trim())) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("the predicate catches the words and the identifiers, and passes look-alikes", () => {
    for (const bad of [`// every ${C} buys one`, `Open ${M}s`, `const x = use${Cap(M)}s(`, `type ${Cap(C)}Identity`, `${M}ByCampaignId`, `${C}For(`]) {
      expect(banned(bad), bad).toBe(true);
    }
    for (const ok of ["permission", "submissions", "formSubmissionAt", "WrenchScrewdriverIcon", "pipeFor(", "useCampaigns("]) {
      expect(banned(ok), ok).toBe(false);
    }
  });
});
