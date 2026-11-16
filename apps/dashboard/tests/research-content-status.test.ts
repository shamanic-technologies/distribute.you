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
  scriptFiguresBySlug,
  statusWord,
  templateMeasures,
} from "../src/lib/research/content-status";
import type { ResearchCatalog } from "../src/lib/research/research";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

// A catalogue slice by Engine (RESEARCH-BY-ENGINE-1113): only the fields the lookups read, measure ids as prod serves them.
const REPLY = "email_sent/start/conversation";
const VISIT = "website_visit/start/website_visit";
const MEETING = "meeting_booked/conversation/meeting_booked";
function catalog(): ResearchCatalog {
  const sc = (key: string, outcomes: number, cost: number | null) => ({ key, figures: { outcomes, costPerOutcomeUsd: { value: cost } } }) as never;
  const tpl = (key: string) => ({ key, label: key, scripts: [] }) as never;
  const measure = (id: string, scripts: never[], templates: never[]) =>
    ({ id, engine: id.split("/")[0], startsFrom: null, counts: { key: "x", name: "X" }, description: "d", scripts, templates, llms: [] }) as never;
  return {
    engines: [
      { outcome: "email_sent", name: "Email sent", measures: [measure(REPLY, [sc("a", 0, null), sc("b", 3, 120)], [tpl("cold-email-v59"), tpl("shared")])] },
      { outcome: "website_visit", name: "Website visit", measures: [measure(VISIT, [sc("a", 2, 40), sc("c", 5, 9)], [tpl("shared"), tpl("cold-email-v68")])] },
      { outcome: "meeting_booked", name: "Meeting booked", measures: [measure(MEETING, [], [])] },
    ],
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

  it("lists the measures a template writes for, the current one first", () => {
    expect(templateMeasures(catalog(), "shared", VISIT)).toEqual([VISIT, REPLY]);
    expect(templateMeasures(catalog(), "shared", REPLY)).toEqual([REPLY, VISIT]);
    expect(templateMeasures(catalog(), "cold-email-v68", REPLY)).toEqual([VISIT]);
    expect(templateMeasures(null, "shared", REPLY)).toEqual([]);
  });

  it("a script's modal figures are its own served row's, the first one that made an outcome winning", () => {
    const by = scriptFiguresBySlug(catalog());
    // `a` made nothing on the reply measure, 2 visits on the visit one: the served row with outcomes wins.
    expect(by.get("a")).toEqual({ outcomes: 2, cost: 40 });
    expect(by.get("b")).toEqual({ outcomes: 3, cost: 120 });
    expect(by.get("c")).toEqual({ outcomes: 5, cost: 9 });
    expect(scriptFiguresBySlug(null).size).toBe(0);
  });
});

describe("TEMPLATE-MODEL-STATUS-1019: the three Research pages", () => {
  const status = read("components/v2/research-status.tsx");
  const list = read("components/v2/research-catalog.tsx");
  const api = read("lib/api.ts");

  it("reads and writes the gateway's staff routes", () => {
    for (const path of ['"/content/templates"', '"/content/models"', "/content/templates/${encodeURIComponent(type)}/status", "/content/templates/${encodeURIComponent(type)}/outputs?limit=", '"/workflows/retire-by-content"', "/workflows/dynasty/${encodeURIComponent(workflowDynastySlug)}/status"]) {
      expect(api).toContain(path);
    }
    // A model's status is read, never written, since Research has no channel x leg grain (RESEARCH-BY-ENGINE-1113).
    expect(api).not.toContain("/content/models/${encodeURIComponent(model)}/status");
  });

  it("the modal lists the scripts with a DRY RUN before anything is written", () => {
    expect(status).toContain("retireWorkflowsByContent({ promptType: target.key }, { dryRun: true })");
  });

  it("confirming deprecates the template, THEN retires its scripts", () => {
    const confirm = status.slice(status.indexOf("const confirm = async"), status.indexOf("if (typeof document"));
    const setAt = confirm.indexOf("setContentTemplateStatus(target.key, change)");
    const retireAt = confirm.indexOf("retireWorkflowsByContent({ promptType: target.key }, { dryRun: false, reason: workflowReason })");
    expect(setAt).toBeGreaterThan(-1);
    expect(retireAt).toBeGreaterThan(setAt);
  });

  it("setting active touches the status only, no workflow", () => {
    const activate = status.slice(status.indexOf("const activate = async (t: ContentTarget)"), status.indexOf("const modal = confirming"));
    expect(activate).toContain('"active"');
    expect(activate).not.toContain("retireWorkflowsByContent");
    expect(activate).not.toContain("setWorkflowDynastyStatus");
  });

  it("LLMs: LLM, $ / outcome, % Conversion, # outcomes, $ Spent, Status, in that order, no ROI (owner 2026-10-23, ROI-CONSISTENCY-1103)", () => {
    const head = list.slice(list.indexOf('{kind === "llms" ? ('), list.indexOf("</thead>"));
    expect(head).not.toContain("RoiLabel");
    const order = ["{`$ ${o.unit}`}", ">% Conversion</th>", "{`# ${o.plural}`}", ">$ Spent</th>", ">Status</th>"].map((t) => head.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const models = head.slice(0, head.indexOf(") : null}"));
    expect(models).not.toContain("Emails");
    const roiAt = list.indexOf('{kind === "llms" ? (', list.indexOf("<tbody>"));
    const cells = list.slice(roiAt, list.indexOf("<ContentStatusWord", roiAt));
    expect(cells).toContain("<Dash v={r.cost} />");
    // $ Spent prints the row's own served spend on every measure; post columns sit before it (THREADS-IDEAS-AB).
    expect(cells.indexOf("{r.outcomes}")).toBeLessThan(cells.indexOf("r.spend}"));
    expect(cells.indexOf("<PostCells")).toBeLessThan(cells.indexOf("r.spend}"));
  });

  it("Templates: Template, Tactics, % Conversion, $ / outcome, # outcomes, $ Spent, Status, in that order, no ROI (owner 2026-10-23, ROI-CONSISTENCY-1103)", () => {
    const head = list.slice(list.indexOf("Owner 2026-10-23: Template, Tactics"), list.indexOf('{kind === "llms" ? ('));
    expect(head).not.toContain("RoiLabel");
    const order = [">Tactics</th>", ">% Conversion</th>", "{`$ ${o.unit}`}", "{`# ${o.plural}`}", ">$ Spent</th>", ">Status</th>"].map((t) => head.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(head).not.toContain("Scripts</th>");
    // Served order, never re-sorted in the browser (RESEARCH-TPL-SERVED-ORDER-1023).
    expect(list).toContain("tabbed ? (byTab?.[tab] ?? []) : rows;");
    const lib = read("lib/research/research.ts");
    expect(lib).not.toContain("templatesInTableOrder");
    const shownAt = list.indexOf("const shown: (ResearchScript");
    expect(list.slice(shownAt, list.indexOf("\n", shownAt))).not.toMatch(/\.sort\(|toSorted/);
  });

  it("Templates: % Conversion (served), no ROI, no Leg / # column, ⋮, and the outputs drawer on a row click", () => {
    // Owner 2026-10-22: no Leg column (it said nothing), the Active tab already states the status,
    // and the ROI order number meant nothing beside the ROI itself.
    expect(list).not.toContain(">Leg</th>");
    expect(list).not.toContain("<FirstAndMore");
    expect(list).not.toContain(">#</th>");
    expect(list).not.toContain("TemplateRoi");
    expect(list).toContain(">% Conversion</th>");
    expect(list).toContain("<TemplateOutputsPanel");
    // A row opens its detail in the right drawer (owner 2026-10-23), no panel open from the start.
    expect(list).not.toContain("?? (shown[0] as ResearchTemplate | undefined)");
    expect(list).toContain("onClose={() => setSelected(null)}");
    expect(list).toContain("<StatusMenu");
  });

  it("LLMs: a row click opens the LLM drawer, the name opens its page (owner 2026-10-24)", () => {
    expect(list).toContain('const drawerRow = kind === "templates" || kind === "llms";');
    expect(list).toContain("drawerRow ? opensDrawer(e.target, e.currentTarget) && setSelected(r.key) : nav(href)");
    expect(list).toContain("<ModelPanel");
    // $ / run (owner 2026-10-24): the served average, left of $ Spent, and the figures + curve in the drawer and on the page.
    expect(list.indexOf(">$ / run</th>")).toBeLessThan(list.lastIndexOf(">$ Spent</th>"));
    expect(list.indexOf(">$ / run</th>")).toBeGreaterThan(list.indexOf("{`# ${o.plural}`}</th>"));
    expect(list).toContain("<Dash v={(r as ResearchModel).runCost?.averageDisplay ?? null} />");
    expect(list.match(/<RunCostChart c=\{m\.runCost\}/g)?.length).toBe(2);
    // An LLM's last emails are read per channel x leg by content generation, a grain Research by Engine no longer has:
    // the drawer and the page say « not carried », never another grain's emails (RESEARCH-BY-ENGINE-1113).
    expect(list.match(/<ModelOutputs \/>/g)?.length).toBe(2);
    expect(list).toContain("<EmptyNote>{LLM_OUTPUTS_NOT_CARRIED}</EmptyNote>");
    expect(list).not.toContain("useModelDynastyOutputs");
  });

  it("LLMs: Status read off the SERVED aliases without a channel, never written from Research (no Engine grain for it)", () => {
    // RESEARCH-BY-ENGINE-1113 supersedes LLM-STATUS-PER-PIPE-1023: the status was set per channel x leg; Research reads it, never writes it.
    expect(list).toContain('const target = kind === "templates" ? ({ kind: "template"');
    expect(list).toContain("modelAliasesOf(r as ResearchModel)");
    expect(list).toContain("gap={served.gap}");
    expect(list).toContain("useModelStatuses()");
    for (const src of [status, list]) {
      expect(src).not.toContain("setContentModelStatus");
      expect(src).not.toContain("useContentPipe");
      expect(src).not.toContain("featureSlug");
    }
    expect(status).not.toContain("useModelAliases");
    expect(read("lib/research/content-status.ts")).not.toContain("writesWithNow");
    expect(list).toContain("deprecateNote={DEPRECATE_CONTENT_NOTE}");
  });

  it("every new root is held out of the disk cache", () => {
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("SENSITIVE_QUERY_ROOTS"), persist.indexOf("PERSISTABLE_QUERY_ROOTS"));
    for (const root of ["contentTemplateStatuses", "contentModelStatuses", "workflowDynastyDeprecation", "retireByContentPreview", "templateOutputs"]) {
      expect(sensitive).toContain(`"${root}"`);
    }
  });

  it("the Scripts table's cells paint from disk (owner 2026-10-21), the actual basis never", () => {
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("SENSITIVE_QUERY_ROOTS"), persist.indexOf("PERSISTABLE_QUERY_ROOTS"));
    const persistable = persist.slice(persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    for (const root of ["workflowDynastySummaries", "researchEngineCatalog"]) expect(persistable).toContain(`"${root}",`);
    expect(sensitive).not.toContain('"workflowDynastySummaries"');
    expect(sensitive).toContain('"researchEngineCatalogActual"');
    const source = read("lib/research/research-source.tsx");
    expect(source).toContain('basis === "actual" ? ["researchEngineCatalogActual", view]');
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
    expect(api).toContain("setWorkflowDynastyStatus(workflowDynastySlug: string, change: CatalogueStatusChange)");
    expect(api).toContain('run: { dryRun: true } | { dryRun: false; reason: string }');
  });

  it("Confirm stays off until the Why? box holds text, in both confirmations", () => {
    expect(status).toContain("disabled={busy || listed === undefined || !reason}");
    expect(status).toContain("disabled={busy || !reason}");
    expect(status.match(/<WhyField /g)?.length).toBe(2);
    // A script's Deprecate opens the Why? modal, never writes on the menu click.
    expect(status).toContain("onDeprecate={() => setAsking(true)}");
  });

  it("every deprecated row and page shows its served why", () => {
    expect(list).toContain("deprecation={deprecation}");
    expect(status).toContain("deprecation={why.deprecation}");
    // script, template dynasty, template version, LLM pages
    expect(list.match(/<DeprecationNote /g)?.length).toBe(4);
    expect(api).toContain('new URLSearchParams({ workflowDynastySlug, status: "all" })');
  });
});
