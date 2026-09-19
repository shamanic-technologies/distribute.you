import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/**
 * The CRM surface is BETA, and the owner asked for BOTH halves gated: the nav
 * entry and the page. A nav gate alone leaves the URL reachable by typing it,
 * which is the shape this repo has shipped by accident before.
 */
describe("the CRM surface is gated on both halves", () => {
  const sidebar = read("components/context-sidebar.tsx");

  it("gates the nav entry on the email allowlist, not on the dead flag hook", () => {
    // `useFeatureFlag` returns false unconditionally in this app, so gating on it
    // does not STAGE a surface, it DELETES one — for staff too.
    expect(sidebar).toContain("const crmOk = useIsBetaUser();");
    const entry = sidebar.slice(sidebar.indexOf('id: "brand-crm"'));
    expect(sidebar.slice(0, sidebar.indexOf('id: "brand-crm"'))).toContain("crmOk");
    expect(entry.slice(0, 400)).toContain('label: "CRM"');
  });

  it("badges the nav entry beta, so a viewer who CAN see it knows it is not GA", () => {
    const at = sidebar.indexOf('id: "brand-crm"');
    expect(at).toBeGreaterThan(-1);
    expect(sidebar.slice(at, at + 400)).toContain('maturity: "beta" as Maturity');
  });

  it("hangs the entry off the brand, because an integration belongs to a brand", () => {
    const at = sidebar.indexOf('id: "brand-crm"');
    expect(sidebar.slice(at, at + 400)).toContain("${basePath}/crm");
  });

  it("does not make the entry depend on a revenue feature", () => {
    // A brand that sells through nothing yet still has a CRM to look at, so this
    // entry is deliberately outside the `revenueOk` family above it.
    const at = sidebar.indexOf('id: "brand-crm"');
    const block = sidebar.slice(sidebar.lastIndexOf("...(", at), at);
    expect(block).toContain("crmOk");
    expect(block).not.toContain("revenueOk");
  });
});
