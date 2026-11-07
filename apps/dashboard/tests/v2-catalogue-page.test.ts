import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogueRowsSchema, CatalogueStrategySchema, CatalogueTacticSchema, ScriptListSchema, catalogueTabOf, dynastyHeads, dynastyName, enginesOf } from "../src/lib/v2/catalogue";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const script = (o: Partial<Record<string, unknown>>) => ({
  id: "s", outcome: "message_written", dynasty: "cold-writer", version: 1, scriptSlug: "x", description: "Writes", materials: [], vendors: [],
  tactics: {}, status: "active", dynastyStatus: "active", runnable: true, creationType: "scratch", createdFromScript: null, createdBy: "k",
  replay: null, cases: 0, deprecationReason: null, createdAt: "2026-11-07", updatedAt: "2026-11-07", ...o,
});

describe("Catalogue page (owner 2026-11-07, every client)", () => {
  it("parses the served scripts, tactics and strategies", () => {
    const list = ScriptListSchema.parse({ scripts: [script({}), script({ id: "t", replay: { cases: 3, matches: 3 } })] });
    expect(list.scripts).toHaveLength(2);
    expect(CatalogueRowsSchema(CatalogueTacticSchema).parse({ object: "tactic", total: 1, truncated: false, rows: [{ id: "a", name: "Brand named", description: "d", clientLine: null, appliesTo: "script" }] }).rows[0].name).toBe("Brand named");
    expect(CatalogueRowsSchema(CatalogueStrategySchema).parse({ total: 1, truncated: false, rows: [{ id: "s", name: "Quiet", description: "d", requires: [{ id: "a", name: "A" }], excludes: [], pipeIds: ["p"] }] }).rows[0].requires[0].name).toBe("A");
  });

  it("one head per live dynasty, one Engine per outcome in the served outcome order", () => {
    const scripts = ScriptListSchema.parse({
      scripts: [
        script({ id: "1", version: 1, status: "deprecated" }),
        script({ id: "2", version: 2, materials: ["lead_found"] }),
        script({ id: "3", dynasty: "old", dynastyStatus: "deprecated", status: "deprecated" }),
        script({ id: "4", outcome: "lead_found", dynasty: "apollo-finder" }),
      ],
    }).scripts;
    expect(dynastyHeads(scripts).map((s) => s.id).sort()).toEqual(["2", "4"]);
    const engines = enginesOf(scripts, ["lead_found", "message_written"]);
    expect(engines.map((e) => e.outcome)).toEqual(["lead_found", "message_written"]);
    expect(engines[1].materials).toEqual(["lead_found"]);
    expect(dynastyName("apollo-finder")).toBe("Apollo finder");
    expect(catalogueTabOf("scripts")).toBe("scripts");
    expect(catalogueTabOf("nope")).toBe("outcomes");
  });

  it("the sidebar's Production group lists Catalogue for every client, never behind staff mode", () => {
    const shell = read("src/components/v2/v2-shell.tsx");
    const production = shell.slice(shell.indexOf('<Group title="Production">'), shell.indexOf('<Group title="Setup">'));
    expect(production).toContain('label="Catalogue"');
    expect(production).toContain("href={v2CatalogueHome(orgId, brandId)}");
    expect(production.indexOf('label="Connected accounts"')).toBeLessThan(production.indexOf('label="Catalogue"'));
  });

  it("the page reads the served lists, tabs in the URL, a refusal is one plain line", () => {
    const page = read("src/components/v2/catalogue-page.tsx");
    for (const r of ["listActiveScripts", "listCatalogueTactics", "listCatalogueStrategies", "getPublicCatalogueSteps"]) expect(page).toContain(r);
    expect(page).toContain('window.history.replaceState(null, "", `?tab=${next}`)');
    expect(page).toContain("show here soon.");
    expect(page).not.toContain("pipeIds");
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/catalogue/page.tsx")).toContain("<CataloguePage />");
    const api = read("src/lib/api.ts");
    expect(api).toContain("apiCall<unknown>(`/scripts?status=active`)");
    expect(api).toContain("apiCall<unknown>(`/catalogue/tactics?limit=25`)");
    expect(api).toContain("apiCall<unknown>(`/catalogue/strategies?limit=25`)");
  });
});
