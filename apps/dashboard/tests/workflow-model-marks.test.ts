import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  workflowModelMark,
  knownModelAliases,
} from "../src/lib/workflow-model-marks";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

/**
 * Real unit tests — `workflow-model-marks.ts` imports NOTHING, which is what makes
 * them possible. A runtime `@/…` import there turns every one of these into a
 * resolution failure, so the alias-free property is itself pinned below.
 */
describe("workflowModelMark", () => {
  it("names the family and the tier, and hands back the provider's domain", () => {
    expect(workflowModelMark("flash-pro")).toEqual({
      alias: "flash-pro",
      label: "Gemini Flash Pro",
      providerDomain: "google.com",
    });
    expect(workflowModelMark("fable")).toEqual({
      alias: "fable",
      label: "Claude Fable",
      providerDomain: "anthropic.com",
    });
    expect(workflowModelMark("glm-pro")).toEqual({
      alias: "glm-pro",
      label: "GLM Pro",
      providerDomain: "z.ai",
    });
    expect(workflowModelMark("gpt-pro")).toEqual({
      alias: "gpt-pro",
      label: "GPT Pro",
      providerDomain: "openai.com",
    });
    expect(workflowModelMark("kimi-flash")).toEqual({
      alias: "kimi-flash",
      label: "Kimi Flash",
      providerDomain: "moonshot.ai",
    });
  });

  it("covers every alias the LIVE channel serves", () => {
    // Measured through the gateway on 2026-09-10: the eight distinct non-null
    // `contentModel` values across the 24 workflows of sales-cold-email-outreach.
    for (const alias of [
      "flash",
      "flash-pro",
      "deepseek-flash",
      "deepseek-pro",
      "glm-flash",
      "glm-pro",
      "fable",
      "gpt-pro",
    ]) {
      const mark = workflowModelMark(alias);
      expect(mark, alias).not.toBeNull();
      expect(mark!.providerDomain, alias).not.toBeNull();
    }
  });

  it("covers every alias chat-service exposes, across its six providers", () => {
    // chat-service's own MODELS_BY_PROVIDER. A seventh family shipping there is
    // allowed to land here unknown (it renders its alias, no logo) — this pins the
    // six that exist so a REMOVAL from the catalogue goes red.
    expect(new Set(knownModelAliases())).toEqual(
      new Set([
        "haiku",
        "sonnet",
        "opus",
        "fable",
        "flash-lite",
        "flash",
        "flash-pro",
        "pro",
        "deepseek-flash",
        "deepseek-pro",
        "glm-flash",
        "glm-pro",
        "kimi-flash",
        "kimi-pro",
        "gpt-pro",
      ]),
    );
  });

  it("hands an UNKNOWN alias its own text and NO logo", () => {
    // A mark we would have to invent is worse than none: a guessed domain would put
    // another company's logo beside a customer's spend.
    expect(workflowModelMark("grok-turbo")).toEqual({
      alias: "grok-turbo",
      label: "grok-turbo",
      providerDomain: null,
    });
  });

  it("answers NULL when the workflow states no model, and never a default tier", () => {
    expect(workflowModelMark(null)).toBeNull();
    expect(workflowModelMark(undefined)).toBeNull();
    expect(workflowModelMark("")).toBeNull();
    expect(workflowModelMark("   ")).toBeNull();
  });

  it("trims, because the alias is read off a DAG body", () => {
    expect(workflowModelMark(" flash ")?.label).toBe("Gemini Flash");
  });

  it("labels no model with a VERSION NUMBER — that is the value that rots", () => {
    // chat-service walked `flash-pro` from Gemini 3.5 to 3.7 to 3.8 inside a year.
    // A label carrying a version would have gone stale three times with nothing red.
    for (const alias of knownModelAliases()) {
      expect(workflowModelMark(alias)!.label, alias).not.toMatch(/\d/);
    }
  });

  it("is alias-free, so these are real unit tests", () => {
    const src = read("src/lib/workflow-model-marks.ts");
    expect(src).not.toMatch(/^import .* from "@\//m);
  });
});

describe("the surfaces that draw a model", () => {
  const table = read("src/components/workflows/campaign-workflows-page.tsx");
  const detail = read("src/components/workflows/campaign-workflow-detail-page.tsx");
  const rows = read("src/lib/campaign-workflow-rows.ts");
  const api = read("src/lib/api.ts");

  it("reads both fields off the wire under workflow-service's own names", () => {
    expect(api).toContain("contentModel: z.string().nullish()");
    expect(api).toContain("contentPromptType: z.string().nullish()");
    // `.optional()` accepts an ABSENT field and REFUSES a null one — and workflow-
    // service sends null for half the live channel, so it would blank the whole read.
    expect(api).not.toContain("contentModel: z.string().optional()");
    expect(api).not.toContain("contentPromptType: z.string().optional()");
  });

  it("carries both onto the row, from the CATALOGUE only", () => {
    expect(rows).toContain("contentModel: entry?.contentModel ?? null");
    expect(rows).toContain("contentPromptType: entry?.contentPromptType ?? null");
    // A revenue group states neither; reading one off it would invent a shape for a
    // retired workflow whose catalogue entry is gone.
    expect(rows).not.toContain("group?.contentModel");
    expect(rows).not.toContain("group?.contentPromptType");
  });

  it("resolves the mark through the ONE catalogue, at both call sites", () => {
    for (const [name, src] of [
      ["table", table],
      ["detail", detail],
    ] as const) {
      expect(src, name).toContain(
        'import { workflowModelMark } from "@/lib/workflow-model-marks"',
      );
      expect(src, name).toContain("workflowModelMark(");
    }
  });

  it("draws the provider logo by DOMAIN, never by a name", () => {
    for (const [name, src] of [
      ["table", table],
      ["detail", detail],
    ] as const) {
      // `?? null` on the table's side is the ABSENT-model case, not a fallback: a
      // row with no model renders no mark, which is what `ProviderLogo` does on null.
      expect(src, name).toMatch(/domain=\{model\??\.providerDomain/);
    }
  });

  it("prints the template VERBATIM — it is the only template identity on the wire", () => {
    expect(table).toContain("{row.contentPromptType}");
    expect(detail).toContain("{row.contentPromptType}");
  });

  it("states a dash for a workflow that names no model, never a default", () => {
    // The guessed default is the one thing that would be silently wrong: half the
    // live channel states no model, so a fallback would mislabel twelve workflows.
    for (const [name, src] of [
      ["table", table],
      ["detail", detail],
    ] as const) {
      expect(src, name).not.toMatch(/contentModel\s*\?\?\s*"/);
      expect(src, name).not.toContain('workflowModelMark(row.contentModel ?? "');
    }
  });

  it("names the model on the sibling price bars, which is what they differ by", () => {
    expect(detail).toContain("${r.workflowDynastyName} · ${m.label}");
    // A truncated label states its whole self on hover.
    expect(detail).toContain("title={r.label}");
  });

  it("puts the model where the channel and audience type used to be", () => {
    // Every row of a channel-scoped page read the same `email · cold-outreach`, so
    // the line distinguished nothing; the model and the template are what does.
    expect(table).not.toContain('[row.channel, row.audienceType].filter(Boolean)');
  });

  it("uses only tints the dark remap already covers", () => {
    // Grays only: `html.dark` remaps gray-900 down to gray-300, so no new rule is
    // needed. A colour outside that set would render a light block on the dark theme.
    const cell = table.slice(table.indexOf("export function WorkflowIdentity("));
    const body = cell.slice(0, cell.indexOf("export function CampaignWorkflowsPage("));
    const tints = body.match(/(?:bg|text|border)-(?!gray|brand|white)[a-z]+-\d{2,3}/g) ?? [];
    expect(tints).toEqual([]);
  });
});
