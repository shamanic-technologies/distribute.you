import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DISTRY-PRINCIPAL-1119: Monitoring > Chat > Distry edits Distry's definition (chat-service, versioned)
// and lists every Engine of the live catalogue with the served "callable / why not" verdict.
const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const view = read("components/v2/monitoring-distry.tsx");
const page = read("components/v2/monitoring-page.tsx");
const api = read("lib/api.ts");

describe("Monitoring > Distry", () => {
  it("is a Monitoring page rendered by DistryView, with a hub card", () => {
    expect(read("lib/monitoring/monitoring.ts")).toContain('"chat/distry"');
    expect(page).toContain('{view.page === "chat/distry" && <DistryView />}');
    expect(page).toContain('href={href("chat/distry")}');
  });

  it("reads and writes through the staff gateway paths", () => {
    expect(api).toContain("distryConfig: ");
    expect(api).toContain("distryEngines: ");
    for (const fn of ["getStaffDistryConfig", "getStaffDistryVersions", "saveStaffDistryConfig", "restoreStaffDistryVersion", "getStaffDistryEngines"]) {
      expect(view).toContain(fn);
    }
  });

  it("renders the Engines in the served order with the served reason", () => {
    const at = view.indexOf("function EnginesTable(");
    const body = view.slice(at, view.indexOf("function VersionsTable(", at));
    expect(body).not.toContain(".sort(");
    expect(body).not.toContain(".filter(");
    expect(body).toContain("e.reason");
  });

  it("re-reads after a write instead of reloading the page", () => {
    expect(view).toContain('refetchQueries({ queryKey: ["staffDistryVersions"] })');
    expect(view).not.toContain("location.reload");
  });

  it("lays the page out on two columns and opens every row's detail in a right panel", () => {
    expect(view).toContain("lg:grid-cols-2");
    for (const kind of ["tool", "engine", "version"]) expect(view).toContain(`setOpen({ kind: "${kind}"`);
    // The Prompt and the skills open from the skills block and from each @mention chip (DISTRY-SKILL-MENTIONS-1122).
    expect(view).toContain("<SkillsBlock");
    expect(view).toContain("openFromSkills");
    expect(view).toContain('document.getElementById("v2-portal")');
    // A skill's text is edited in the same panel as Chat > Skills, with Distry's own switch in it.
    expect(view).toContain("<SkillPanel");
    expect(read("components/v2/monitoring-skills.tsx")).toContain("export function SkillPanel(");
  });
});

// DISTRY-THINKING-1122: the owner clicked "Use" on GPT-6.1 Terra at Medium and Distry was saved at the
// model's default, because only Anthropic sent a level. Every provider now saves the served level.
describe("Monitoring > Distry: thinking level for every provider", () => {
  const tableAt = view.indexOf("function ModelsTable(");
  const table = view.slice(tableAt, view.indexOf("\n}\n", tableAt));
  const pickerAt = view.indexOf("function ModelPicker(");
  const picker = view.slice(pickerAt, view.indexOf("\n}\n", pickerAt));

  it("Use on a variant saves the served level, whatever the provider", () => {
    expect(table).toContain("onUse(m.provider, modelName, v.distry.level)");
    expect(view).toContain("save({ provider, model, effort })");
    expect(view).not.toContain('provider === "anthropic" ? effort : null');
  });

  it("a variant Distry cannot run shows its served reason and no Use button", () => {
    expect(table).toContain("v.distry.canRun ? (");
    expect(table).toContain("{!v.distry.canRun && v.distry.reason && <span");
    expect(table).toContain(") : null}");
  });

  it("the Thinking dropdown lists the model's served levels, for every provider", () => {
    expect(picker).toContain("thinkingLevels");
    expect(picker).toContain("disabled={levels.length === 0}");
    expect(picker).not.toContain('provider !== "anthropic"');
    expect(picker).not.toContain("config.efforts");
    // Switching provider resets the level to the model's default.
    expect(picker).toContain("model: config.models[e.target.value]?.[0] ?? model, effort: null");
  });

  it("names `none` as Reasoning off and null as Model default", () => {
    // The helper moved beside the fallback order (DISTRY-THINKING-1122), shared by the picker and the order.
    const words = read("components/v2/distry-fallback-order.tsx");
    expect(words).toContain('if (level === "none") return "Reasoning off";');
    expect(words).toContain('if (level === null) return "Model default";');
    expect(view).toContain('import { DistryFallbackOrder, thinkingWords } from "./distry-fallback-order";');
  });

  it("reads thinkingLevels and each variant's distry verdict from chat-service", () => {
    expect(api).toContain("thinkingLevels: z.array(z.string())");
    expect(api).toContain("distry: z.object({ level: z.string().nullable(), canRun: z.boolean(), reason: z.string().nullable() })");
  });
});
