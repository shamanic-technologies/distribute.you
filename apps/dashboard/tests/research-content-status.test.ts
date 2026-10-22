import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aliasList,
  contentDeprecation,
  deprecationLine,
  modelAliasesOf,
  modelDeprecation,
  modelStatus,
  statusWord,
  templatePipes,
} from "../src/lib/research/content-status";
import type { ResearchCatalog } from "../src/lib/research/research";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

// A catalogue slice: only the fields the lookups read.
function catalog(): ResearchCatalog {
  const wf = (key: string, model: string | null, alias: string | null) =>
    ({ key, writesWithNow: model ? { version: "v1", template: null, model: { key: model, label: model, linked: true }, modelAlias: alias } : null }) as never;
  const tpl = (key: string) => ({ key, label: key, workflows: [] }) as never;
  return {
    "cold-email-positive-reply": {
      workflows: [wf("a", "glm-5.3", "glm-pro"), wf("b", "gemini-3.1-pro", null), wf("c", null, null), wf("e", "deepseek-v4.1-flash", "deepseek-pro")],
      templates: [tpl("cold-email-v59"), tpl("shared")],
      models: [],
    },
    "cold-email-website-visit": {
      workflows: [wf("d", "gemini-3.8-flash", "flash-pro"), wf("f", "deepseek-v4.1-flash", "deepseek-flash"), wf("g", "glm-5.3", "glm-pro")],
      templates: [tpl("shared"), tpl("cold-email-v68")],
      models: [],
    },
    "meeting-booking": { workflows: [], templates: [], models: [] },
  };
}

describe("TEMPLATE-MODEL-STATUS-1019: lookups", () => {
  it("names the two served statuses and nothing else", () => {
    expect(statusWord("active")).toBe("Active");
    expect(statusWord("deprecated")).toBe("Deprecated");
    expect(statusWord(null)).toBeNull();
    expect(statusWord(undefined)).toBeNull();
  });

  it("reads a model's aliases off its served row, and says why when there is none", () => {
    // A model no workflow writes with today still has its aliases (GPT-6 Astra, Claude Fable 5.1).
    expect(modelAliasesOf({ key: "gpt-6-astra", aliases: ["gpt-pro"], aliasesUnavailableReason: null })).toEqual({ aliases: ["gpt-pro"], gap: null });
    // One concrete model served under two aliases (prod 2026-10-19): both are acted on.
    expect(modelAliasesOf({ key: "deepseek-v4.1-flash", aliases: ["deepseek-flash", "deepseek-pro"] }).aliases).toEqual(["deepseek-flash", "deepseek-pro"]);
    expect(modelAliasesOf({ key: "glm-5.2", aliases: [], aliasesUnavailableReason: "no_alias_serves_it" }).gap).toBe("Retired: no alias uses it now");
    expect(modelAliasesOf({ key: "x", aliases: [], aliasesUnavailableReason: "model_not_in_chat_service" }).gap).toBe("Not served by chat-service");
    expect(modelAliasesOf({ key: "x", aliases: [], aliasesUnavailableReason: "model_ids_unreadable" }).gap).toBe("chat-service unreadable now");
    // A catalogue built before the field: no guess, a plain word.
    expect(modelAliasesOf({ key: "x" })).toEqual({ aliases: [], gap: "Not stated yet" });
  });

  it("names every alias a model write changes", () => {
    expect(aliasList(["glm-pro"])).toBe("glm-pro");
    expect(aliasList(["deepseek-flash", "deepseek-pro"])).toBe("deepseek-flash and deepseek-pro");
    expect(aliasList(["a", "b", "c"])).toBe("a, b and c");
  });

  it("a model reads Deprecated only once every alias is", () => {
    const st: Record<string, string> = { a: "deprecated", b: "active", c: "deprecated" };
    expect(modelStatus(["a", "b"], (x) => st[x])).toBe("active");
    expect(modelStatus(["a", "c"], (x) => st[x])).toBe("deprecated");
    expect(modelStatus(["a", "zz"], (x) => st[x])).toBeNull();
    expect(modelStatus([], (x) => st[x])).toBeNull();
  });

  it("lists a template's legs, the current one first", () => {
    expect(templatePipes(catalog(), "shared", "cold-email-website-visit")).toEqual(["cold-email-website-visit", "cold-email-positive-reply"]);
    expect(templatePipes(catalog(), "shared", "cold-email-positive-reply")).toEqual(["cold-email-positive-reply", "cold-email-website-visit"]);
    expect(templatePipes(catalog(), "cold-email-v68", "cold-email-positive-reply")).toEqual(["cold-email-website-visit"]);
    expect(templatePipes(null, "shared", "cold-email-positive-reply")).toEqual([]);
  });
});

describe("TEMPLATE-MODEL-STATUS-1019: the three Research pages", () => {
  const status = read("components/v2/research-status.tsx");
  const list = read("components/v2/research-catalog.tsx");
  const live = read("components/v2/research-live-workflows.tsx");
  const api = read("lib/api.ts");

  it("reads and writes the gateway's staff routes", () => {
    for (const path of ['"/content/templates"', '"/content/models"', "/content/templates/${encodeURIComponent(type)}/status", "/content/models/${encodeURIComponent(model)}/status", "/content/templates/${encodeURIComponent(type)}/outputs?limit=", '"/workflows/retire-by-content"', "/workflows/dynasty/${encodeURIComponent(workflowDynastySlug)}/status"]) {
      expect(api).toContain(path);
    }
  });

  it("the modal lists the workflows with a DRY RUN before anything is written", () => {
    expect(status).toContain("retireWorkflowsByContent(b, { dryRun: true })");
  });

  it("confirming deprecates the template or model, THEN retires its workflows", () => {
    const confirm = status.slice(status.indexOf("const confirm = async"), status.indexOf("if (typeof document"));
    const setAt = confirm.indexOf("setContentTemplateStatus(target.key, change)");
    const retireAt = confirm.indexOf("retireWorkflowsByContent(b, { dryRun: false, reason: workflowReason })");
    expect(setAt).toBeGreaterThan(-1);
    expect(retireAt).toBeGreaterThan(setAt);
  });

  it("setting active touches the status only, no workflow", () => {
    const activate = status.slice(status.indexOf("const activate = async (t: ContentTarget)"), status.indexOf("const modal = confirming"));
    expect(activate).toContain('"active"');
    expect(activate).not.toContain("retireWorkflowsByContent");
    expect(activate).not.toContain("setWorkflowDynastyStatus");
  });

  it("Templates: ROI + % Conversion (served), no Leg / # column, ⋮, and the outputs drawer on a row click", () => {
    // Owner 2026-10-22: one leg per pipe page (Leg said nothing), the Active tab already states the status,
    // and the ROI order number meant nothing beside the ROI itself.
    expect(list).not.toContain(">Leg</th>");
    expect(list).not.toContain("<FirstAndMore");
    expect(list).not.toContain(">#</th>");
    expect(list).toContain('{kind === "models" && <th className={`${TH} w-52`}>Status</th>}');
    expect(list).toContain("<TemplateRoi t={r as ResearchTemplate} />");
    expect(list).toContain(">% Conversion</th>");
    expect(list).toContain("<TemplateOutputsPanel");
    // A row opens its detail in the right drawer (owner 2026-10-23), no panel open from the start.
    expect(list).not.toContain("?? (shown[0] as ResearchTemplate | undefined)");
    expect(list).toContain("onClose={() => setSelected(null)}");
    expect(list).toContain("<StatusMenu");
  });

  it("Models: Status + ⋮ keyed on the SERVED aliases, never the workflows join, no Leg column", () => {
    expect(list).toContain('{ kind: "model", aliases: modelKeys, label: r.label }');
    expect(list).toContain("modelAliasesOf(r as ResearchModel)");
    expect(list).toContain("gap={served.gap}");
    expect(status).not.toContain("useModelAliases");
    expect(read("lib/research/content-status.ts")).not.toContain("writesWithNow");
    // Several aliases: the confirm and the menu name each one.
    expect(status).toContain("This deprecates each of them.");
    expect(list).toContain("contentNote(target, DEPRECATE_CONTENT_NOTE)");
  });

  it("Workflows: each row carries the dynasty status and its ⋮", () => {
    expect(live).toContain("<WorkflowStatusCells slug={r.slug}");
    expect(live).toContain("w-28`}>Status</th>");
    expect(live).not.toContain(">#</th>");
  });

  it("every new root is held out of the disk cache", () => {
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("SENSITIVE_QUERY_ROOTS"), persist.indexOf("PERSISTABLE_QUERY_ROOTS"));
    for (const root of ["contentTemplateStatuses", "contentModelStatuses", "workflowDynastyDeprecation", "retireByContentPreview", "templateOutputs"]) {
      expect(sensitive).toContain(`"${root}"`);
    }
  });

  it("the Workflows table's Status and LLM/Template cells paint from disk (owner 2026-10-21), the actual basis never", () => {
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("SENSITIVE_QUERY_ROOTS"), persist.indexOf("PERSISTABLE_QUERY_ROOTS"));
    const persistable = persist.slice(persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    for (const root of ["workflowDynastyStatuses", "researchCatalog"]) expect(persistable).toContain(`"${root}",`);
    expect(sensitive).not.toContain('"workflowDynastyStatuses"');
    expect(sensitive).toContain('"researchCatalogActual"');
    const source = read("lib/research/research-source.tsx");
    expect(source).toContain('basis === "actual" ? ["researchCatalogActual"]');
  });
});

describe("DEPRECATION-REASON-1020: every Deprecate asks why; every deprecated item says why, who, when", () => {
  const status = read("components/v2/research-status.tsx");
  const list = read("components/v2/research-catalog.tsx");
  const api = read("lib/api.ts");

  it("prints the reason, then who and the day, each only when served", () => {
    const catchAll = "Catch-all copy of Azha: the Cold Email pipe never chooses which emails to keep, the Lead Sourcing pipe does (owner 2026-10-20).";
    expect(deprecationLine({ reason: catchAll, decidedBy: "kevin@distribute.you", decidedAt: "2026-10-20T17:07:19.080Z" })).toBe(
      `${catchAll} (kevin@distribute.you, 2026-10-20)`,
    );
    // Before reasons existed: "Not specified" as is, no who or when invented.
    expect(deprecationLine({ reason: "Not specified", decidedBy: null, decidedAt: null })).toBe("Not specified");
    expect(deprecationLine({ reason: "Old", decidedBy: null, decidedAt: "2026-10-01T00:00:00Z" })).toBe("Old (2026-10-01)");
    expect(deprecationLine({ reason: "Old", decidedBy: "a@b.c", decidedAt: null })).toBe("Old (a@b.c)");
  });

  it("reads a template or alias deprecation off its status row, only when deprecated", () => {
    expect(contentDeprecation({ status: "active", statusReason: null })).toBeNull();
    expect(contentDeprecation({ status: "deprecated", statusReason: "Too long", statusChangedBy: "k@d.you", statusChangedAt: "2026-10-20T10:00:00Z" })).toEqual({
      reason: "Too long",
      decidedBy: "k@d.you",
      decidedAt: "2026-10-20T10:00:00Z",
    });
  });

  it("a model is deprecated (with each distinct why) only once every alias is", () => {
    const d = (reason: string) => ({ reason, decidedBy: null, decidedAt: null });
    const by: Record<string, ReturnType<typeof d> | null> = { a: d("X"), b: d("X"), c: d("Y"), e: null };
    expect(modelDeprecation(["a", "b"], (x) => by[x])).toEqual([d("X")]);
    expect(modelDeprecation(["a", "c"], (x) => by[x])).toEqual([d("X"), d("Y")]);
    expect(modelDeprecation(["a", "e"], (x) => by[x])).toBeNull();
    expect(modelDeprecation([], (x) => by[x])).toBeNull();
  });

  it("every deprecation write carries a reason, typed so none can be sent without one", () => {
    expect(api).toContain('export type CatalogueStatusChange = { status: "active" } | { status: "deprecated"; reason: string };');
    expect(api).toContain("setContentTemplateStatus(type: string, change: CatalogueStatusChange)");
    expect(api).toContain("setContentModelStatus(model: string, change: CatalogueStatusChange)");
    expect(api).toContain("setWorkflowDynastyStatus(workflowDynastySlug: string, change: CatalogueStatusChange)");
    expect(api).toContain('run: { dryRun: true } | { dryRun: false; reason: string }');
  });

  it("Confirm stays off until the Why? box holds text, in both confirmations", () => {
    expect(status).toContain("disabled={busy || preview.data === undefined || !reason}");
    expect(status).toContain("disabled={busy || !reason}");
    expect(status.match(/<WhyField /g)?.length).toBe(2);
    // A workflow's Deprecate opens the Why? modal, never writes on the menu click.
    expect(status).toContain("onDeprecate={() => setAsking(true)}");
  });

  it("every deprecated row and page shows its served why", () => {
    expect(list).toContain("deprecation={deprecation}");
    expect(status).toContain("deprecation={why.deprecation}");
    // workflow, template dynasty, template version, model pages
    expect(list.match(/<DeprecationNote /g)?.length).toBe(4);
    expect(api).toContain('new URLSearchParams({ workflowDynastySlug, status: "all" })');
  });
});
