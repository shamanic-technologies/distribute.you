import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listConfigRepos } from "../src/lib/github-config";

/**
 * `listConfigRepos` feeds the "Repository CLAUDE.md" list, so its length is set by
 * how many repositories the organisation owns rather than by anything in this repo.
 * That makes a single unpaged request a scheduled failure: on the day the 101st
 * repository is created the call comes back one page short, no error is raised, and
 * a repository missing from the console reads exactly like one the token was never
 * granted. These tests pin the paging so that day is uneventful.
 *
 * The module talks to GitHub through the global `fetch`, so that is what is faked
 * here. It imports nothing through the `@` alias, which is what keeps it runtime
 * importable and these tests real rather than source-substring guards.
 */

function repoPage(count: number, offset: number) {
  return Array.from({ length: count }, (_, i) => ({
    full_name: `shamanic-technologies/repo-${String(offset + i).padStart(3, "0")}`,
    archived: false,
  }));
}

function mockFetchPages(pages: unknown[][]) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url);
    const page = Number(new URL(url).searchParams.get("page") ?? "1");
    return {
      ok: true,
      status: 200,
      json: async () => pages[page - 1] ?? [],
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

describe("listConfigRepos", () => {
  beforeEach(() => {
    vi.stubEnv("GITHUB_CONFIG_TOKEN", "github_pat_test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("stops after one request when the first page is short", async () => {
    const calls = mockFetchPages([repoPage(3, 0)]);

    const repos = await listConfigRepos();

    expect(repos).toHaveLength(3);
    // A short page IS the last page. Asking for another one costs a request every
    // single time for an answer that is always empty.
    expect(calls).toHaveLength(1);
  });

  it("walks past 100 instead of silently truncating", async () => {
    // The exact shape of the bug this replaced: a full first page, and more behind it.
    mockFetchPages([repoPage(100, 0), repoPage(23, 100)]);

    const repos = await listConfigRepos();

    expect(repos).toHaveLength(123);
    expect(repos).toContain("shamanic-technologies/repo-122");
  });

  it("requests each page exactly once, in order", async () => {
    const calls = mockFetchPages([repoPage(100, 0), repoPage(100, 100), repoPage(5, 200)]);

    await listConfigRepos();

    expect(calls.map((url) => new URL(url).searchParams.get("page"))).toEqual(["1", "2", "3"]);
  });

  it("drops archived repositories and agent-config itself", async () => {
    mockFetchPages([
      [
        { full_name: "shamanic-technologies/agent-config", archived: false },
        { full_name: "shamanic-technologies/live-one", archived: false },
        { full_name: "shamanic-technologies/old-one", archived: true },
      ],
    ]);

    const repos = await listConfigRepos();

    // agent-config has its own section, and an archived repo is not somewhere
    // anybody should be committing config from a browser.
    expect(repos).toEqual(["shamanic-technologies/live-one"]);
  });

  it("returns names sorted, whatever order the pages arrive in", async () => {
    mockFetchPages([
      [
        { full_name: "shamanic-technologies/zebra", archived: false },
        { full_name: "shamanic-technologies/alpha", archived: false },
      ],
    ]);

    const repos = await listConfigRepos();

    expect(repos).toEqual(["shamanic-technologies/alpha", "shamanic-technologies/zebra"]);
  });

  it("gives up rather than paging forever when every page comes back full", async () => {
    // Defends against a paging bug turning into an unbounded burst of requests at
    // somebody else's API. The ceiling is far above the real repository count.
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return { ok: true, status: 200, json: async () => repoPage(100, calls.length * 100) } as unknown as Response;
      }),
    );

    await listConfigRepos();

    expect(calls.length).toBeLessThanOrEqual(20);
    expect(calls.length).toBeGreaterThan(1);
  });

  it("reports a missing credential rather than returning an empty list", async () => {
    vi.stubEnv("GITHUB_CONFIG_TOKEN", "");
    mockFetchPages([repoPage(1, 0)]);

    // An empty list would render as "this token reaches no repositories", which is a
    // different statement from "there is no token".
    await expect(listConfigRepos()).rejects.toThrow(/GITHUB_CONFIG_TOKEN/);
  });
});
