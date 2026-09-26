import { describe, expect, it } from "vitest";
import { v2PathForV1 } from "../src/lib/ui-version";

const O = "org_1";
const B = "b-1";
const V = `/v2/orgs/${O}/brands/${B}`;
const map = (p: string, s = "") =>
  v2PathForV1(p, s, { lastBrand: (o) => (o === O ? B : undefined), activeOrgId: O });

describe("v2PathForV1: every v1 brand page has a v2 twin", () => {
  it.each([
    [`/orgs/${O}/brands/${B}`, "", V],
    [`/orgs/${O}/brands/${B}/leads`, "", `${V}/people`],
    [`/orgs/${O}/brands/${B}/leads`, "?leadRowId=r1", `${V}/people/r1`],
    [`/orgs/${O}/brands/${B}/settings`, "", `${V}/settings`],
    [`/orgs/${O}/brands/${B}/crm`, "", `${V}/integrations`],
    [`/orgs/${O}/brands/${B}/crm/merged`, "", `${V}/integrations/merged`],
    [`/orgs/${O}/brands/${B}/offers`, "", `${V}/offers`],
    [`/orgs/${O}/brands/${B}/offers/of1`, "", `${V}/offers/of1`],
    [`/orgs/${O}/brands/${B}/offers/of1/settings`, "", `${V}/offers/of1`],
    [`/orgs/${O}/brands/${B}/offers/of1/audiences`, "?audienceId=a", `${V}/offers/of1/targeting?audienceId=a`],
    [`/orgs/${O}/brands/${B}/offers/of1/audiences/leads`, "", `${V}/people`],
    [`/orgs/${O}/brands/${B}/offers/of1/campaigns`, "", `${V}/missions`],
    [`/orgs/${O}/brands/${B}/offers/of1/campaigns/c1`, "", `${V}/missions/c1`],
    [`/orgs/${O}/brands/${B}/offers/of1/campaigns/c1/settings`, "", `${V}/missions/c1/settings`],
    [`/orgs/${O}/brands/${B}/offers/of1/campaigns/c1/leads`, "", `${V}/missions/c1`],
    [`/orgs/${O}/brands/${B}/offers/of1/campaigns/c1/audiences`, "", `${V}/offers/of1/targeting`],
    [`/orgs/${O}/brands/${B}/offers/of1/campaigns/c1/workflows`, "", `${V}/missions/c1/workflows`],
    [`/orgs/${O}/brands/${B}/offers/of1/campaigns/c1/workflows/lithium`, "", `${V}/missions/c1/workflows?workflow=lithium`],
    [`/orgs/${O}/billing`, "?success=true", `${V}/billing?success=true`],
    [`/orgs/${O}/api-keys`, "", `${V}/api-keys`],
    [`/orgs/${O}/provider-keys`, "", `${V}/api-keys`],
    [`/account`, "", `${V}/account`],
    [`/orgs/${O}`, "", `/v2/orgs/${O}`],
  ])("%s%s -> %s", (p, s, want) => {
    expect(map(p, s)).toBe(want);
  });

  it("an org-level page with no remembered brand stays on v1", () => {
    expect(v2PathForV1(`/orgs/${O}/billing`, "", { lastBrand: () => undefined })).toBeNull();
  });

  it("paths v2 has no twin for are left alone", () => {
    expect(map("/onboarding")).toBeNull();
    expect(map(`/v2/orgs/${O}/brands/${B}`)).toBeNull();
    expect(map(`/orgs/${O}/brands/${B}/unknown`)).toBeNull();
  });
});

describe("v2 never links to v1", () => {
  const { readdirSync, readFileSync, statSync } = require("fs") as typeof import("fs");
  const { join, resolve } = require("path") as typeof import("path");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(f) ? [p] : [];
    });
  const root = resolve(__dirname, "../src");
  const files = [...walk(join(root, "components/v2")), ...walk(join(root, "app/(authed)/v2")), join(root, "lib/v2/routes.ts")];

  it("no v2 source names a v1 dashboard path", () => {
    // A quoted or template path starting at a v1 route (not `/v2/...`). The one
    // sanctioned way back is the "Back to v1" switch, which computes its target in
    // `ui-version-switch.tsx`, outside this tree.
    const V1 = /["'`](\/orgs\/|\/account["'`?]|\/api-keys["'`]|\/leads\b)/;
    const hits = files.flatMap((f) =>
      readFileSync(f, "utf-8")
        .split("\n")
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => V1.test(line) && !line.trim().startsWith("*") && !line.trim().startsWith("//"))
        .map(({ line, i }) => `${f.slice(root.length)}:${i + 1}: ${line.trim()}`),
    );
    expect(hits).toEqual([]);
  });

  it("the Back-to-v1 switch is the only exit, and it lives in the account menu", () => {
    const menus = readFileSync(join(root, "components/v2/sidebar-menus.tsx"), "utf-8");
    expect(menus).toContain('switchUiVersion("v1", backToV1Href(');
  });
});
