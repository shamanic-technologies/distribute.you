import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { unhydratedBoundaries, waitForHydrationSettled } from "../src/lib/hydration-settled";

/**
 * MON-PAGE-SPEED-FLOOR-1120: the saved copy is written into the cache only once every
 * server-rendered Suspense boundary has hydrated (the page under the brand loading.tsx,
 * the Copilot chunk), else React #418 client-rebuilds the section.
 *
 * Proved in real Chromium with React's own SSR + hydrateRoot (probe kept in the session's
 * .context/probe-hydration): a write before the section hydrated replaced its server DOM,
 * the gated write kept it and landed one poll after the section hydrated. Here: the walker
 * over a minimal DOM shape (no jsdom in this app).
 */

type FakeNode = {
  nodeType: number;
  data?: string;
  childNodes: FakeNode[];
  nextSibling: FakeNode | null;
  previousSibling: FakeNode | null;
  [k: string]: unknown;
};

const el = (children: FakeNode[] = [], hydrated = false): FakeNode => link({ nodeType: 1, childNodes: children, nextSibling: null, previousSibling: null, ...(hydrated ? { "__reactFiber$abc": {} } : {}) });
const text = (hydrated = false): FakeNode => ({ nodeType: 3, childNodes: [], nextSibling: null, previousSibling: null, ...(hydrated ? { "__reactFiber$abc": {} } : {}) });
const comment = (data: string): FakeNode => ({ nodeType: 8, data, childNodes: [], nextSibling: null, previousSibling: null });

function link(n: FakeNode): FakeNode {
  n.childNodes.forEach((c, i) => {
    c.previousSibling = n.childNodes[i - 1] ?? null;
    c.nextSibling = n.childNodes[i + 1] ?? null;
  });
  return n;
}

const run = (root: FakeNode) => unhydratedBoundaries(root as unknown as Node);

describe("unhydratedBoundaries", () => {
  it("names a boundary whose last node React has not tagged yet, and none once it is", () => {
    const pending = el([el([], true), comment("$"), el([el()]), el(), comment("/$")], true);
    expect(run(el([pending]))).toHaveLength(1);
    const done = el([el([], true), comment("$"), el([el()], true), el([], true), comment("/$")], true);
    expect(run(el([done]))).toHaveLength(0);
  });

  it("checks the LAST node of the boundary (a boundary's render completes after its last child)", () => {
    const halfway = el([comment("$"), el([], true), el([], false), comment("/$")]);
    expect(run(halfway)).toHaveLength(1);
  });

  it("skips nested boundaries' markers and checks them on their own", () => {
    // outer: [div(hydrated), <!--$--> inner(div not hydrated) <!--/$-->] — the outer's last REAL node is the inner div
    const nested = el([comment("$"), el([], true), comment("$"), el([], false), comment("/$"), comment("/$")]);
    const left = run(nested);
    expect(left).toHaveLength(2);
    const innerDone = el([comment("$"), el([], true), comment("$"), el([], true), comment("/$"), comment("/$")]);
    expect(run(innerDone)).toHaveLength(0);
  });

  it("text nodes count: React tags the text it hydrates", () => {
    expect(run(el([comment("$"), text(false), comment("/$")]))).toHaveLength(1);
    expect(run(el([comment("$"), text(true), comment("/$")]))).toHaveLength(0);
  });

  it("a still-streaming boundary waits; a client-rendered one and an empty one never block", () => {
    expect(run(el([comment("$?"), el(), comment("/$")]))).toHaveLength(1);
    expect(run(el([comment("$!"), el(), comment("/$")]))).toHaveLength(0);
    expect(run(el([comment("$"), comment("/$")]))).toHaveLength(0);
  });

  it("walks the whole tree, not only the root's children", () => {
    const deep = el([el([el([comment("$"), el(), comment("/$")], true)], true)], true);
    expect(run(deep)).toHaveLength(1);
  });
});

describe("waitForHydrationSettled", () => {
  it("resolves once the boundary hydrates, polling", async () => {
    vi.useFakeTimers();
    const section = el();
    const root = el([comment("$"), section, comment("/$")]);
    let done = false;
    void waitForHydrationSettled({ root: root as unknown as Node, timeoutMs: 5000, intervalMs: 16 }).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toBe(false);
    section["__reactFiber$abc"] = {};
    await vi.advanceTimersByTimeAsync(16);
    expect(done).toBe(true);
    vi.useRealTimers();
  });

  it("is bounded and loud: a section that never hydrates does not hold the saved copy forever", async () => {
    vi.useFakeTimers();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = el([comment("$"), el(), comment("/$")]);
    let done = false;
    const t0 = Date.now();
    void waitForHydrationSettled({ root: root as unknown as Node, timeoutMs: 5000, intervalMs: 16, now: () => Date.now() - t0 + 0 }).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(5100);
    expect(done).toBe(true);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
    vi.useRealTimers();
  });

  it("the query provider waits for it after its own hydration, before any setQueryData", () => {
    const src = readFileSync(new URL("../src/lib/query-provider.tsx", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("async function reseedColdQueriesFromDisk("), src.indexOf("function makeQueryClient("));
    const wait = fn.indexOf("await waitForHydrationSettled(");
    expect(wait).toBeGreaterThan(fn.indexOf("if (hydrated) await hydrated;"));
    expect(wait).toBeLessThan(fn.indexOf("client.setQueryData("));
  });
});

describe("the v2 shell imports no page body (MON-PAGE-SPEED-FLOOR-1120: the shell's JavaScript is every page's floor)", () => {
  const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");
  const shell = read("components/v2/v2-shell.tsx");
  const menus = read("components/v2/sidebar-menus.tsx");
  const panel = read("components/v2/copilot-panel.tsx");

  it("reads the funnel face, the published outcomes and the company URL from small modules", () => {
    expect(shell).toContain('import { FunnelFace } from "@/components/v2/funnel-face";');
    expect(shell).toContain('from "@/components/v2/published-outcome-data";');
    for (const page of ["funnel-campaigns", "published-outcome-page", "companies-page", "people-page", "setup-pages", "campaign-page-next"]) {
      expect(shell, page).not.toContain(`"@/components/v2/${page}"`);
      expect(menus, page).not.toContain(`"@/components/v2/${page}"`);
    }
  });

  it("loads the Copilot chat as its own chunk, still server-rendered (no ssr: false, no loading skeleton)", () => {
    expect(panel).toContain('dynamic(() => import("@/components/v2/copilot-chat")');
    expect(panel).not.toContain("ssr: false");
    expect(panel).not.toContain("loading:");
    expect(panel).not.toContain('import { CopilotChat } from "@/components/v2/copilot-chat"');
  });

  it("draws catalogue marks from the duotone-only icon set, never a six-weight Phosphor module", () => {
    for (const f of ["components/v2/catalogue-mark.tsx", "components/v2/catalogue-mark-icons.tsx"]) {
      expect(read(f), f).not.toContain("@phosphor-icons/react/dist/csr/");
      expect(read(f), f).toContain('from "@/components/v2/duotone-icons"');
    }
    expect(read("components/v2/catalogue-mark.tsx")).toContain('weight="duotone"');
  });
});
