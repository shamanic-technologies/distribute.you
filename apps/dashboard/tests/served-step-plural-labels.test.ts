import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { legCatalogueFromWire, stepPluralLabel } from "../src/lib/legs";

/**
 * Standard vocabulary (owner 2026-10-15): a step's words are features-service's, singular
 * (`label`) and plural (`pluralLabel`). `lead_found` reads "Lead" / "Leads"; the dashboard
 * shows the SERVED word everywhere and pluralizes nothing itself.
 */
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

/** Comments name steps in prose; only code and copy are checked. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("served step plural labels (owner 2026-10-15)", () => {
  it("no dashboard source hardcodes the retired 'Lead found' / 'Leads found' words", () => {
    const hits = sourceFiles(join(root, "src")).filter((f) => /\bLeads? found\b/.test(stripComments(readFileSync(f, "utf8"))));
    expect(hits).toEqual([]);
  });

  it("the catalogue reader keeps features-service's pluralLabel (zod and the structural reader)", () => {
    const api = read("src/lib/api.ts");
    const schema = api.slice(api.indexOf("const PublicCatalogueSchema = z.object({"), api.indexOf("export type PublicCatalogue ="));
    expect(schema).toContain("pluralLabel: z.string().nullish()");
    // The trigger fields features-service added ride through too (type, outcomeKey, callable).
    expect(schema).toContain("outcomeKey: z.string().nullish()");
    const catalogue = legCatalogueFromWire({
      steps: [{ key: "lead_found", label: "Lead", pluralLabel: "Leads" }],
      triggers: [{ id: "lead_found_reached", label: "Lead", type: "outcome", outcomeKey: "lead_found", callable: true }],
    });
    expect(stepPluralLabel(catalogue, "lead_found", "Lead")).toBe("Leads");
    expect(catalogue.triggers.get("lead_found_reached")).toMatchObject({ type: "outcome", outcomeKey: "lead_found", callable: true });
  });

  it("a step served without a plural reads its served singular, never a local pluralizer", () => {
    const catalogue = legCatalogueFromWire({ steps: [{ key: "meeting_booked", label: "Meeting booked" }] });
    expect(stepPluralLabel(catalogue, "meeting_booked", "Meeting booked")).toBe("Meeting booked");
  });

  it("outcomes, crews and the pipe/campaign count headings read the served plural", () => {
    expect(read("src/lib/v2/outcomes.ts")).toContain("stepPluralLabel(catalogue, key, singular)");
    expect(read("src/lib/v2/crews.ts")).not.toContain("OUTCOME_PLURAL");
    for (const f of ["src/components/v2/pipe-sections.tsx", "src/components/v2/campaign-page.tsx"]) {
      const src = read(f);
      expect(src).toContain("stepPluralLabel(");
      expect(src).not.toMatch(/const plural = \(noun/);
    }
  });
});
