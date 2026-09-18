import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Source-substring guards for the cold-email section. The pages import `@` at
 * runtime (React Query, Clerk), so what is assertable here is their SHAPE: which
 * read each page makes, which invariants hold, and that every nav entry has a
 * route behind it.
 */

const ROOT = path.resolve(__dirname, "..");
const SECTION = "src/app/(authed)/(dashboard)/audit/cold-email";

function read(rel: string): string {
  return fs.readFileSync(path.resolve(ROOT, rel), "utf-8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.resolve(ROOT, rel));
}

const PAGES = {
  overview: `${SECTION}/page.tsx`,
  domains: `${SECTION}/domains/page.tsx`,
  mailboxes: `${SECTION}/mailboxes/page.tsx`,
  accounts: `${SECTION}/accounts/page.tsx`,
  inbox: `${SECTION}/inbox/page.tsx`,
  rules: `${SECTION}/rules/page.tsx`,
} as const;

describe("the section exists, one page per object", () => {
  it("ships all six routes", () => {
    for (const [name, rel] of Object.entries(PAGES)) {
      expect(exists(rel), `${name} page is missing at ${rel}`).toBe(true);
    }
  });

  it("is listed in the sidebar, and every nav entry has a route behind it", () => {
    const sidebar = read("src/components/context-sidebar.tsx");
    expect(sidebar).toContain("Cold email");
    expect(sidebar).toContain('const COLD_EMAIL_ROOT = "/audit/cold-email"');
    // A nav entry whose route does not exist is a 404 nothing catches.
    const hrefs = [...sidebar.matchAll(/href: `?\$?\{?COLD_EMAIL_ROOT\}?(\/[a-z-]+)?`?/g)].map(
      (m) => m[1] ?? "",
    );
    expect(hrefs.length).toBe(6);
    for (const suffix of hrefs) {
      const rel = suffix === "" ? PAGES.overview : `${SECTION}${suffix}/page.tsx`;
      expect(exists(rel), `nav points at ${suffix || "/"} which has no page`).toBe(true);
    }
  });

  it("no longer offers a second door onto the same estate", () => {
    const sidebar = read("src/components/context-sidebar.tsx");
    expect(sidebar).not.toContain('href: "/audit/instantly"');
  });

  it("keeps the OTHER audit pages untouched", () => {
    const sidebar = read("src/components/context-sidebar.tsx");
    expect(sidebar).toContain('href: "/audit/accounts"');
    expect(sidebar).toContain('href: "/audit/config"');
  });

  it("keeps /audit/instantly reachable as a redirect, so old links do not 404", () => {
    const legacy = read("src/app/(authed)/(dashboard)/audit/instantly/page.tsx");
    expect(legacy).toContain('redirect("/audit/cold-email")');
  });
});

describe("each page reads the object it is about", () => {
  const READS: Record<keyof typeof PAGES, string[]> = {
    overview: ["getOpsInfra"],
    domains: ["getOpsDomains"],
    mailboxes: ["getOpsMailboxes"],
    accounts: ["getOpsAddresses"],
    inbox: ["getOpsThreads", "getOpsMessages", "getOpsMessageBody"],
    rules: ["getOpsLifecycleRules"],
  };

  for (const [name, reads] of Object.entries(READS) as [keyof typeof PAGES, string[]][]) {
    it(`${name} reads ${reads.join(", ")}`, () => {
      const src = read(PAGES[name]);
      for (const r of reads) expect(src).toContain(r);
    });
  }
});

describe("the fleet capacity is stated ONCE", () => {
  it("the card and the forecast chart's capacity line read the same served field", () => {
    const src = read(PAGES.overview);
    // Two reads of "how much can we send" is how a card and the chart under it
    // come to state different numbers for one fleet.
    expect(src).toContain("dailyCapacity={fleet?.dailyCapacity}");
    expect(src).toContain("`${num(fleet?.dailyCapacity)}/day`");
    // The legacy sending-forecast summary is NOT a second source here.
    expect(src).not.toContain("getInstantlySendingForecast");
  });
});

describe("the inbox never asks for everything", () => {
  const src = read(PAGES.inbox);

  it("builds its query through the helper that always sets the required limit", () => {
    expect(src).toContain("buildThreadsQuery");
    expect(src).toContain("buildMessagesQuery");
    // No hand-rolled query string that could omit `limit` (a 400 that reads on
    // screen as an empty inbox).
    expect(src).not.toContain("/instantly/ops/threads?");
  });

  it("pages with the producer's cursor", () => {
    expect(src).toContain("nextCursor");
    expect(src).toContain("setCursor(nextCursor)");
    expect(src).toContain("appendPage");
  });

  it("does NOT poll — a background refetch of page one would throw away every page the reader loaded", () => {
    expect(src).not.toContain("pollOptions");
    expect(src).not.toContain("refetchInterval");
  });

  it("shows a message body only when the reader opens it", () => {
    expect(src).toContain("Read body");
  });

  it("renders a third party's HTML as TEXT, never as markup", () => {
    expect(src).not.toContain("dangerouslySetInnerHTML");
  });
});

describe("the heavy reads poll on the slow cadence", () => {
  // `addresses` is a live Instantly list under the hood (~9s cold, cached 60s
  // server-side) — the same cadence the account-health table it replaces used.
  for (const name of ["overview", "domains", "mailboxes", "accounts", "rules"] as const) {
    it(`${name} uses pollOptionsSlower`, () => {
      expect(read(PAGES[name])).toContain("pollOptionsSlower");
    });
  }
});

describe("the Accounts page is the old table, from the superset read", () => {
  const src = read(PAGES.accounts);

  it("keeps every figure the old page showed, from the same field names", () => {
    for (const field of [
      "fillRank",
      "warmupScore",
      "warmupLimit",
      "inboxPlacement",
      "sentYesterday",
      "sentToday",
      "queuedFirstUnsentSequences",
      "queuedNextToday",
      "queuedOverdue",
      "queuedNextTomorrow",
      "queuedNextLater",
      "queueSize",
      "queuedSequences",
      "queuedFirstUnsent",
      "effectiveDailyCap",
      "dailyLimit",
      "lifecycleReason",
      "lifecycleUpdatedAt",
      "blockReason",
    ]) {
      expect(src, `the old page showed ${field}`).toContain(field);
    }
  });

  it("keeps the queue-health distribution and the raw Instantly config panel", () => {
    expect(src).toContain("QueueDistributionChart");
    expect(src).toContain("getInstantlyAccountDetail");
  });

  it("reads due-today from the LEAD count, never from queuedFirstUnsent (which counts every remaining step)", () => {
    expect(src).toContain("return r.queuedFirstUnsentSequences + r.queuedNextToday;");
  });

  it("reads the daily max from the producer's ramp-aware cap, never the pre-ramp limit alone", () => {
    expect(src).toContain("return r.effectiveDailyCap ?? r.dailyLimit;");
  });
});

describe("no figure is derived client-side", () => {
  // Every displayed stat is producer-owned. What the pages may do is COUNT the
  // rows on screen and pick a served field — never divide two served numbers
  // into a new metric.
  const BANNED = [
    /inboxPct\s*\/\s*/,
    /dailyCapacity\s*\/\s*/,
    /monthlyCents\s*\/\s*[a-zA-Z]/,
    /\*\s*100\s*\)\s*\.toFixed/,
  ];
  for (const [name, rel] of Object.entries(PAGES)) {
    it(`${name} derives no ratio from served fields`, () => {
      const src = read(rel);
      for (const pattern of BANNED) {
        expect(src, `${name} matches ${pattern}`).not.toMatch(pattern);
      }
    });
  }
});

describe("copy", () => {
  const files = [
    ...Object.values(PAGES),
    "src/components/cold-email/primitives.tsx",
    "src/components/cold-email/capacity-history-section.tsx",
    "src/components/cold-email/reconcile-section.tsx",
    "src/lib/instantly-ops.ts",
  ];

  it("carries no em-dash in PROSE", () => {
    // Two uses of U+2014 in this codebase are NOT prose and are deliberately
    // allowed: the standalone dash that stands for an absent value, and the
    // leading dash that indents a sub-row under the figure it breaks down. Both
    // are preceded by a quote. What the copy rule is about is an em-dash joining
    // two clauses, which is preceded by a word character or a closing paren.
    const PROSE_EM_DASH = /[\w)]\s*—/;
    for (const rel of files) {
      const stripped = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");
      expect(stripped, `${rel} has an em-dash in prose`).not.toMatch(PROSE_EM_DASH);
    }
  });

  it("uses no side or top border accent above 1px as a colour cue", () => {
    for (const rel of files) {
      const src = read(rel);
      expect(src, rel).not.toMatch(/border-(l|r|t)-[2-9]/);
    }
  });
});
