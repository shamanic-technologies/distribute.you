import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { llmLogoFiles, llmMark } from "../src/lib/llm-marks";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, "src", rel), "utf8");

/**
 * ONE look for every workflow, template and LLM the dashboard names (owner 2026-10-22: « chaque
 * template ait son icône, chaque LLM ait son logo… Fais un format uniforme »).
 */
describe("llmMark: every model family the fleet serves wears its product mark", () => {
  // chat-service /internal/model-dynasties display names + aliases, prod 2026-10-22.
  const served: [string, string][] = [
    ["Claude Haiku 5.5", "claude"],
    ["Claude Opus 5.5", "claude"],
    ["Claude Fable 5.1", "claude"],
    ["fable", "claude"],
    ["claude-opus-5-5", "claude"],
    ["Gemini 3.8 Flash", "gemini"],
    ["Gemini 3.5 Flash-Lite", "gemini"],
    ["gemini-3.8-flash", "gemini"],
    ["flash-pro", "gemini"],
    ["Gemini Flash Pro", "gemini"],
    ["DeepSeek V4.1 Flash", "deepseek"],
    ["deepseek-pro", "deepseek"],
    ["GLM-5.3 Flash", "glm"],
    ["GLM-5.3", "glm"],
    ["glm-pro", "glm"],
    ["Kimi K2.6", "kimi"],
    ["kimi-pro", "kimi"],
    ["GPT-6 Astra", "openai"],
    ["GPT-5.6 Terra", "openai"],
    ["gpt-pro", "openai"],
    // model ids content generation stores on its runs (workflow dynasty outputs, prod 2026-10-22)
    ["glm-5.3-flash", "glm"],
    ["deepseek-flash", "deepseek"],
    ["gpt-5.6-terra", "openai"],
    ["gemini-3.1-pro-preview", "gemini"],
    ["gemini-3.5-flash-lite", "gemini"],
    ["claude-sonnet-4-6", "claude"],
  ];
  it.each(served)("%s -> %s", (name, logo) => {
    expect(llmMark(name).logoSrc).toBe(`/model-logos/${logo}.svg`);
  });

  it("drops the family word only from a 'Family rest' name, the whole name kept for the hover", () => {
    expect(llmMark("Claude Opus 5.5")).toEqual({ label: "Opus 5.5", name: "Claude Opus 5.5", logoSrc: "/model-logos/claude.svg", family: "Claude" });
    expect(llmMark("GLM-5.3").label).toBe("GLM-5.3");
    expect(llmMark("fable").label).toBe("fable");
  });

  it("a vendor id decides when the read carries one", () => {
    expect(llmMark("Newname 1", "anthropic").logoSrc).toBe("/model-logos/claude.svg");
  });

  it("an unknown family has no mark (the component draws the neutral one and logs it), never a guess", () => {
    expect(llmMark("Jev 1.13").logoSrc).toBeNull();
    expect(llmMark("glmx").logoSrc).toBeNull();
    expect(llmMark("Professional").logoSrc).toBeNull();
  });

  it("every mark the lookup names ships", () => {
    for (const f of llmLogoFiles()) expect(existsSync(join(root, "public", "model-logos", f)), f).toBe(true);
  });
});

describe("CatalogueName: the one component", () => {
  const src = read("components/v2/catalogue-name.tsx");

  it("two variants, one mark size each, an LLM through provider-logo, an unknown one logged", () => {
    expect(src).toContain('variant?: "inline" | "chip"');
    expect(src).toContain("const INLINE_MARK = 16;");
    expect(src).toContain("const CHIP_MARK = 12;");
    expect(src).toContain('import { ModelProductLogo } from "@/components/provider-logo";');
    expect(src).toContain('console.error("[v2] LLM with no product mark');
    expect(src).toContain("if (icon) return <CatalogueMark icon={icon} color={color} name={name} size={size} />;");
  });

  it("no other surface draws a model logo or a workflow topic mark of its own", () => {
    const files = [
      "components/v2/research-catalog.tsx",
      "components/v2/research-template-outputs.tsx",
      "components/v2/research-live-workflows.tsx",
      "components/v2/written-with-tags.tsx",
    ];
    for (const f of files) {
      const s = read(f);
      expect(s, f).not.toContain("logoSrc");
      expect(s, f).not.toContain('<TopicMark topic="workflow"');
      expect(s, f).toContain("CatalogueName");
    }
  });
});

describe("workflow and template marks are the SERVED ones (MARKS-1022, part 2)", () => {
  const icons = read("components/v2/catalogue-mark-icons.tsx");
  const mark = read("components/v2/catalogue-mark.tsx");

  it("every name features-service serves (/public/catalogue/mark-icons) is drawn, never the fallback circle", () => {
    const served = JSON.parse(icons.slice(icons.indexOf("SERVED_MARK_ICON_NAMES: readonly string[] = ") + 44, icons.lastIndexOf("]") + 1)) as string[];
    expect(served.length).toBe(200);
    const keys = new Set([...mark.matchAll(/^\s+"?([a-z-]+)"?: \w+Icon,/gm), ...icons.matchAll(/^\s+"?([a-z-]+)"?: \w+Icon,/gm)].map((m) => m[1]));
    for (const n of served) expect(keys.has(n), n).toBe(true);
    expect(mark).toContain("CATALOGUE_ICONS[icon] ?? MARK_ICONS[icon]");
  });

  it("each surface passes the served mark: the read's own icon, else the dynasty key to look it up", () => {
    expect(read("components/v2/research-live-workflows.tsx")).toContain("icon={r.icon} color={r.color}");
    expect(read("lib/api.ts")).toContain("// The workflow's own mark (MARKS-1022");
    expect(read("lib/live-workflow-rows.ts")).toContain("icon: r.icon ?? null,");
    expect(read("components/v2/research-template-outputs.tsx")).toContain("servedKey={o.templateDynasty.slug}");
    expect(read("components/v2/research-catalog.tsx")).toContain('servedKey={kind === "models" ? null : r.key}');
    expect(read("components/v2/run-page.tsx")).toContain("servedKey={template.id}");
    expect(read("components/workflows/workflow-cells.tsx")).toContain("servedKey={template.id}");
    // Customer surfaces never read the staff catalogue: the Written with chip is an LLM only.
    expect(read("components/v2/written-with-tags.tsx")).not.toContain("servedKey");
  });
});
