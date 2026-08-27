import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";

/**
 * The staff console carries its OWN copy of the funnel steps, because it has no
 * `sales-funnels.ts` catalogue of its own (it is a deliberate fork and keeps its own
 * settings surfaces). This guard is the thing that stops the copy drifting.
 *
 * It lives HERE rather than in `apps/admin` on purpose: this suite is a CI merge gate
 * and admin's is not, so a drift caught here blocks a merge instead of rotting silently
 * the way admin's source-substring guards have before.
 *
 * Read as source text rather than imported — admin is a separate app with its own
 * tsconfig, and reaching across with a runtime import would couple the two builds. The
 * funnels are plain data, so parsing the literal is enough to compare them.
 */
const ADMIN_FUNNEL_STEPS = readFileSync(
  join(__dirname, "../../admin/src/lib/lead-funnel-stages.ts"),
  "utf8",
);

/** Pull `FUNNEL_STEPS`'s per-funnel `steps` arrays straight out of the source. */
function adminFunnelSteps(): Record<string, string[]> {
  const block = ADMIN_FUNNEL_STEPS.slice(
    ADMIN_FUNNEL_STEPS.indexOf("export const FUNNEL_STEPS"),
    ADMIN_FUNNEL_STEPS.indexOf("export function normalizeSalesFunnelKey"),
  );
  const out: Record<string, string[]> = {};
  for (const m of block.matchAll(/(\w+):\s*\{\s*name:\s*"[^"]*",\s*steps:\s*\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((s) => s[1]);
  }
  return out;
}

describe("admin's funnel steps match this app's catalogue", () => {
  it("parses admin's funnels at all (the guard is worthless if it silently finds none)", () => {
    const funnels = adminFunnelSteps();
    expect(Object.keys(funnels).length).toBe(SALES_FUNNELS.length);
  });

  it("carries the same steps, funnel for funnel and label for label", () => {
    // `SALES_FUNNELS` is the single source. Admin's literal copy exists because it has
    // no catalogue; it must say exactly the same thing.
    const funnels = adminFunnelSteps();
    for (const def of SALES_FUNNELS) {
      expect(funnels[def.key]).toEqual(def.steps);
    }
  });

  it("carries the same funnel NAMES too, so one funnel reads one way in both consoles", () => {
    for (const def of SALES_FUNNELS) {
      expect(ADMIN_FUNNEL_STEPS).toContain(`name: "${def.name}"`);
    }
  });

  it("covers every funnel this app sells, with no extras", () => {
    expect(Object.keys(adminFunnelSteps()).sort()).toEqual(SALES_FUNNELS.map((d) => d.key).sort());
  });
});

/**
 * The staff console writes the SAME statement through the SAME producer, so the cost
 * lead-service now demands has to be asked for there too. Pinned from this side for the
 * same reason as the funnels above: this suite is a CI merge gate and admin's is not, so
 * a staff console that quietly stopped asking would go on 400-ing with nothing red.
 */
describe("admin asks for the step cost too", () => {
  const ADMIN_SECTION = readFileSync(
    join(__dirname, "../../admin/src/components/leads/lead-funnel-stage-section.tsx"),
    "utf8",
  );
  const ADMIN_API = readFileSync(join(__dirname, "../../admin/src/lib/api.ts"), "utf8");
  const ADMIN_PAGE = readFileSync(
    join(
      __dirname,
      "../../admin/src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/leads/page.tsx",
    ),
    "utf8",
  );

  it("declares the cost required on the write", () => {
    expect(ADMIN_API).toContain("costCents: number;");
    expect(ADMIN_API).toContain("costCents: z.number().nullable(),");
  });

  it("opens the question on both kinds instead of writing straight through", () => {
    expect(ADMIN_SECTION).toContain("stepCostCentsFrom(rawCost)");
    expect(ADMIN_SECTION).toContain('setAsking({ key: stage.key as WritableStageKey, next: "never" })');
    expect(ADMIN_SECTION).not.toContain('onClick={() => onSet(stage.key as WritableStageKey, "never")}');
  });

  it("defaults nothing when the field is left empty", () => {
    expect(ADMIN_SECTION).toContain("if (costCents == null) return;");
    expect(ADMIN_SECTION).not.toContain("costCents: 0");
    expect(ADMIN_PAGE).not.toContain("costCents: 0");
  });

  it("sends it on every statement and reads it back", () => {
    expect(ADMIN_PAGE).toContain("? { step: key, kind: next, costCents }");
    expect(ADMIN_PAGE).toContain("costs={panelCosts}");
  });
});
