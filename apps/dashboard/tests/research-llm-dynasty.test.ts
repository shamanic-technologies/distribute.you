import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { modelHeadLabel, type ResearchModel } from "../src/lib/research/research";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

// LLM-DYNASTY-1022-DASH: a Models row is a chat-service LLM dynasty (features-service #1944), its
// versions served in `models[]` with figures that add up to the row.
const dynasty = (name: string, head: string) =>
  ({ slug: "x", name, provider: "google", capabilityTier: "cheap", headModelId: head, servedToday: true, legacyAliases: [] });
const version = (label: string, head: boolean) => ({ key: label, label, head }) as never;

describe("modelHeadLabel", () => {
  it("names the version a dynasty runs now by its full served name (owner 2026-10-23)", () => {
    const m = { dynasty: dynasty("Gemini Flash", "gemini-3.8-flash"), models: [version("Gemini 3.8 Flash", true), version("Gemini 3.5 Flash", false)] } as Pick<ResearchModel, "dynasty" | "models">;
    expect(modelHeadLabel(m)).toBe("Gemini 3.8 Flash");
  });
  it("keeps the whole label whatever its first word", () => {
    const m = { dynasty: dynasty("GLM Flash", "glm-5.3-flash"), models: [version("GLM-5.3 Flash", true)] } as Pick<ResearchModel, "dynasty" | "models">;
    expect(modelHeadLabel(m)).toBe("GLM-5.3 Flash");
  });
  it("is null on a model on its own and on a catalogue built before dynasties", () => {
    expect(modelHeadLabel({ dynasty: null, models: [version("Gemini 3 Flash", true)] })).toBeNull();
    expect(modelHeadLabel({})).toBeNull();
  });
});

describe("Models pages read the served dynasty", () => {
  const src = read("components/v2/research-catalog.tsx");
  it("a Models row: logo as tall as two lines, the dynasty name, then the version it runs now; no « now » chip", () => {
    // Owner 2026-10-23: « Non je n'aime pas du tout ton tag "Now xx" ».
    expect(src).toContain("<ModelNameLines m={r as ResearchModel} href={href} />");
    const cell = src.slice(src.indexOf("function ModelNameLines("), src.indexOf("function ModelVersionsTable("));
    expect(cell).toContain("<MarkLines");
    expect(cell).toContain("{second.text}");
    expect(src).not.toContain("ModelRowChip");
    expect(src).not.toMatch(/>\s*[Nn]ow <span/);
  });
  it("the model page header says the head version on its quiet line, no chip", () => {
    const view = src.slice(src.indexOf("function ModelView("));
    expect(view).toContain("sub={second?.text ?? null}");
  });
  it("a model page lists its served versions, each opening a drawer", () => {
    expect(src).toContain("<ModelVersionsTable pipe={pipe} m={m} versions={versions} />");
    const table = src.slice(src.indexOf("function ModelVersionsTable("), src.indexOf("function ServedWord("));
    expect(table).toContain("<ResearchDrawer");
    expect(table).toContain("<TemplateFigures f={open} outcome={o} more />");
    // Every figure is the served string: nothing summed or divided here.
    expect(table).not.toMatch(/reduce\(|\/ ?v\.|Number\(/);
  });
});
