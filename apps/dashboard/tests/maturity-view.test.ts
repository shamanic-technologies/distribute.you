import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MATURITY_VIEW_COOKIE, maturityViewCookieAssignment, maturityViewFromCookie, parseMaturityView } from "../src/lib/v2/maturity-view-cookie";

// MATURITY-VIEW-1023 (owner 2026-10-23): one staff Mature / Flash choice on every Research and
// Monitoring page, Mature by default, never on a customer page.
const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("the view cookie: mature by default", () => {
  it("reads flash only when the cookie says flash", () => {
    expect(maturityViewFromCookie(undefined)).toBe("mature");
    expect(maturityViewFromCookie("")).toBe("mature");
    expect(maturityViewFromCookie(`a=1; ${MATURITY_VIEW_COOKIE}=flash; b=2`)).toBe("flash");
    expect(maturityViewFromCookie(`${MATURITY_VIEW_COOKIE}=nonsense`)).toBe("mature");
    expect(maturityViewFromCookie(`x${MATURITY_VIEW_COOKIE}=flash`)).toBe("mature");
  });
  it("round-trips through its own assignment, site-wide", () => {
    const set = maturityViewCookieAssignment("flash");
    expect(maturityViewFromCookie(set.split(";")[0])).toBe("flash");
    expect(set).toContain("path=/");
    expect(set).toContain("max-age=");
  });
  it("the query param: absent = mature, unknown = refused", () => {
    expect(parseMaturityView(null)).toBe("mature");
    expect(parseMaturityView("mature")).toBe("mature");
    expect(parseMaturityView("flash")).toBe("flash");
    expect(parseMaturityView("")).toBeNull();
    expect(parseMaturityView("FLASH")).toBeNull();
  });
});

describe("the hook and the switch are staff-only", () => {
  it("a non-staff reader always reads mature", () => {
    const hook = read("lib/v2/use-maturity-view.ts");
    expect(hook).toContain('const view: MaturityView = isStaff ? stored : "mature";');
    expect(hook).toContain("useStaffMode()");
    expect(hook).toContain("window.dispatchEvent(new Event(EVENT))");
  });
  it("the switch and Monitoring's line render nothing off staff mode, labels and hints as worded", () => {
    const src = read("components/v2/maturity-view-switch.tsx");
    expect(src.match(/if \(!isStaff\) return null;/g)?.length).toBe(3);
    expect(src).toContain('"Mature" : "Flash"');
    expect(src).toContain("Only people we wrote to long enough ago for their replies to arrive");
    expect(src).toContain("Everything to date, recent replies still on their way");
    expect(src).toContain("Every figure here is the same in both views.");
    expect(src).not.toMatch(/[—–]/);
  });
  it("Monitoring's one frame carries the switch and its line", () => {
    const src = read("components/v2/monitoring-page.tsx");
    const frame = src.slice(src.indexOf("function Frame("), src.indexOf("function Loaded<"));
    expect(frame).toContain("actions={<MaturityViewSwitch />}");
    expect(frame).toContain("<MaturityViewSameNote />");
    expect(src.match(/<TopBar\b/g)?.length).toBe(1);
  });
  it("never on a customer page: only Research and Monitoring mount it", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const hits = execSync(`grep -rlE --include=*.ts --include=*.tsx "MaturityViewSwitch|ResearchSwitches|useMaturityView" ${SRC}`, { encoding: "utf8" })
      .trim()
      .split("\n")
      .map((p) => p.slice(SRC.length + 1))
      .sort();
    expect(hits).toEqual([
      "components/v2/maturity-view-switch.tsx",
      "components/v2/monitoring-page.tsx",
      "components/v2/research-catalog.tsx",
      "components/v2/research-page.tsx",
      "components/v2/research-performance.tsx",
      "lib/research/research-source.tsx",
      "lib/v2/use-maturity-view.ts",
    ]);
  });
});

describe("Research reads carry the view, and every cache is keyed on it", () => {
  const source = read("lib/research/research-source.tsx");
  it("every browser query key ends on the view; texts stay view-free", () => {
    for (const root of ["researchFile", "researchCatalog", "researchPerformance"]) {
      expect(source).toContain(`["${root}Actual", view] : ["${root}", basis, view]`);
    }
    expect(source).toContain('queryKey: ["researchTexts"]');
    expect(source).toContain('fetchPart<Record<string, string>>("user", "texts")');
    expect(source).toContain("`/api/research/${basis}/${part}${view ? `?view=${view}` : \"\"}`");
  });
  it("live-file forwards view= on file, catalog and performance, never on the texts", () => {
    const live = read("lib/research/live-file.ts");
    for (const p of ["/v1/features/research?basis=${basis}&view=${view}", "/v1/features/research/catalog?basis=${basis}&view=${view}", "/v1/features/research/performance?basis=${basis}&view=${view}"]) {
      expect(live).toContain(p);
    }
    expect(live).toContain('readLive<Record<string, string>>("/v1/features/research/templates", staffEmail)');
  });
});

describe("the Research route: view validated, memory keyed on it", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("@clerk/nextjs/server");
  });

  async function loadRoute() {
    vi.doMock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "u", sessionClaims: { email: "kevin@distribute.you" } }) }));
    process.env.ADMIN_DISTRIBUTE_API_KEY = "k";
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (u) => {
      const url = String(u);
      urls.push(url);
      const view = new URL(url).searchParams.get("view");
      const body = url.includes("/catalog") ? {} : url.includes("/templates") ? { t: "x" } : { studies: [], view };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const mod = await import("../src/app/(authed)/api/research/[basis]/[part]/route");
    const call = (part: string, qs = "") =>
      mod.GET(new Request(`http://0.0.0.0:3000/api/research/user/${part}${qs}`), { params: Promise.resolve({ basis: "user", part }) });
    return { call, urls };
  }

  it("unknown view = 400 view_unrecognised, nothing read upstream", async () => {
    const { call, urls } = await loadRoute();
    const res = await call("file", "?view=soon");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "view_unrecognised" });
    expect(urls).toEqual([]);
  });

  it("absent = mature; flash is read and held apart from mature", async () => {
    const { call, urls } = await loadRoute();
    const r0 = await call("file");
    const mature = await r0.json();
    expect([r0.status, mature]).toEqual([200, expect.anything()]);
    const flash = await (await call("file", "?view=flash")).json();
    const matureAgain = await (await call("file", "?view=mature")).json();
    expect(mature.view).toBe("mature");
    expect(flash.view).toBe("flash");
    expect(matureAgain.view).toBe("mature");
    const fileReads = urls.filter((u) => /\/v1\/features\/research\?/.test(u));
    expect(fileReads).toEqual([
      expect.stringContaining("/v1/features/research?basis=user&view=mature"),
      expect.stringContaining("/v1/features/research?basis=user&view=flash"),
    ]);
  });

  it("the texts ignore the view: one upstream read", async () => {
    const { call, urls } = await loadRoute();
    await call("texts", "?view=flash");
    await call("texts");
    expect(urls.filter((u) => u.includes("/templates"))).toHaveLength(1);
  });
});
