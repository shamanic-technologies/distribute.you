import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getContentModelStatuses, setContentModelStatus } from "../src/lib/api";
import {
  aliasStatusOnPipe,
  contentDeprecation,
  contentPipeOf,
  modelDeprecatedElsewhere,
  modelsByTab,
  researchPipeOf,
  type ModelPipeStatusRow,
} from "../src/lib/research/content-status";

// LLM-STATUS-PER-PIPE-1023 (owner 2026-10-23): « I deprecated it for the pipe 'lead -> website visit',
// not 'lead -> PR'!!!! Il faut que la deprecation manuelle soit par pipe!! ». A writer model's status is
// set and read on ONE pipe (channel x leg); no global retirement exists.

const VISIT = { featureSlug: "sales-cold-email-outreach", legKey: "lead_found_to_website_visit" };
const REPLY = { featureSlug: "sales-cold-email-outreach", legKey: "lead_found_to_conversation" };
const WHY = "Too expensive, too smart for clicks";

// Prod, 2026-10-23: glm-pro and opus deprecated on Lead → Website visit only.
const deprecatedOnVisit = (model: string) => ({
  model,
  provider: "x",
  status: "active",
  statusReason: null,
  statusChangedBy: null,
  statusChangedAt: null,
  pipeStatuses: [{ ...VISIT, status: "deprecated", statusReason: WHY, statusChangedBy: "kevin.lourd@gmail.com", statusChangedAt: "2026-10-23T06:40:55.218Z" }],
});
const PROD = [deprecatedOnVisit("glm-pro"), deprecatedOnVisit("opus"), { model: "sonnet", provider: "anthropic", status: "active", pipeStatuses: [] }];
const pipeStatusesOf = (alias: string) => PROD.find((m) => m.model === alias)?.pipeStatuses as ModelPipeStatusRow[] | undefined;
const statusMap = (pipe: typeof VISIT) => new Map(PROD.map((m) => [m.model, aliasStatusOnPipe(m.pipeStatuses as ModelPipeStatusRow[], pipe).status]));

describe("a model's status is the one on the page's pipe", () => {
  it("glm-pro and opus: Deprecated on Lead → Website visit with the reason and author, Active on Lead → Positive reply", () => {
    for (const alias of ["glm-pro", "opus"]) {
      const visit = aliasStatusOnPipe(pipeStatusesOf(alias), VISIT);
      expect(visit.status).toBe("deprecated");
      expect(contentDeprecation(visit)).toEqual({ reason: WHY, decidedBy: "kevin.lourd@gmail.com", decidedAt: "2026-10-23T06:40:55.218Z" });
      expect(aliasStatusOnPipe(pipeStatusesOf(alias), REPLY).status).toBe("active");
    }
  });

  it("no entry on a pipe = active there (the producer's rule); the top-level status is never read", () => {
    expect(aliasStatusOnPipe([], VISIT)).toEqual({ status: "active" });
    expect(aliasStatusOnPipe(null, VISIT)).toEqual({ status: "active" });
  });

  it("the legacy leg spelling names the same pipe", () => {
    expect(aliasStatusOnPipe(pipeStatusesOf("glm-pro"), { ...VISIT, legKey: "start_to_website_visit" }).status).toBe("deprecated");
  });

  it("the Active / Deprecated tabs split per pipe", () => {
    const rows = ["glm-pro", "opus", "sonnet"].map((k) => ({ key: k, aliases: [k], aliasesUnavailableReason: null }));
    const visit = modelsByTab(rows, { answered: true, map: statusMap(VISIT) })!;
    expect(visit.deprecated.map((r) => r.key)).toEqual(["glm-pro", "opus"]);
    expect(visit.active.map((r) => r.key)).toEqual(["sonnet"]);
    const reply = modelsByTab(rows, { answered: true, map: statusMap(REPLY) })!;
    expect(reply.deprecated).toEqual([]);
  });

  it("names the OTHER pipes a model is deprecated on, never the page's own", () => {
    const fromReply = modelDeprecatedElsewhere(["glm-pro"], pipeStatusesOf, REPLY);
    expect(fromReply).toHaveLength(1);
    expect(fromReply[0].pipe).toEqual(VISIT);
    expect(fromReply[0].deprecation[0].reason).toBe(WHY);
    expect(modelDeprecatedElsewhere(["glm-pro"], pipeStatusesOf, VISIT)).toEqual([]);
    expect(modelDeprecatedElsewhere(["sonnet"], pipeStatusesOf, REPLY)).toEqual([]);
    // Several aliases: a pipe counts only once every alias is deprecated there.
    expect(modelDeprecatedElsewhere(["glm-pro", "sonnet"], pipeStatusesOf, REPLY)).toEqual([]);
  });

  it("a Research pipe maps to its content pipe and back, by channel and leg", () => {
    const pipes = [
      { id: "cold-email-website-visit", channel: "sales-cold-email-outreach", leg: "start_to_website_visit" },
      { id: "cold-email-positive-reply", channel: "sales-cold-email-outreach", leg: "lead_found_to_conversation" },
    ];
    expect(contentPipeOf(pipes[0])).toEqual(VISIT);
    expect(contentPipeOf(null)).toBeNull();
    expect(researchPipeOf(pipes, VISIT)).toBe("cold-email-website-visit");
    expect(researchPipeOf(pipes, REPLY)).toBe("cold-email-positive-reply");
    expect(researchPipeOf(pipes, { featureSlug: "other", legKey: "x" })).toBeNull();
  });
});

describe("the write names the pipe", () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  beforeEach(() => {
    calls.length = 0;
    globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      calls.push({ url: String(input), init });
      const body = String(input).endsWith("/content/models") ? { models: PROD } : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it("deprecating sends featureSlug + legKey with the reason: the other pipes are untouched", async () => {
    await setContentModelStatus("glm-pro", { status: "deprecated", reason: WHY }, VISIT);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/content/models/glm-pro/status");
    expect(calls[0].init?.method).toBe("PUT");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ status: "deprecated", reason: WHY, ...VISIT });
  });

  it("re-activating sends the pipe and no reason", async () => {
    await setContentModelStatus("opus", { status: "active" }, VISIT);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ status: "active", ...VISIT });
  });

  it("reads each model's pipeStatuses", async () => {
    const models = await getContentModelStatuses();
    expect(models.find((m) => m.model === "glm-pro")?.pipeStatuses?.[0]).toMatchObject({ ...VISIT, status: "deprecated", statusReason: WHY });
  });
});

describe("the page acts on its own pipe only", () => {
  const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");
  const status = read("components/v2/research-status.tsx");
  const list = read("components/v2/research-catalog.tsx");

  it("every model status read is scoped to the page's pipe", () => {
    expect(list).not.toContain("useModelStatuses()");
    expect(list).toContain("useModelStatuses(contentPipe)");
    expect(list).toContain("useModelStatuses(useContentPipe(pipe))");
  });

  it("re-activating and deprecating write on the target's pipe", () => {
    expect(status).toContain('setContentModelStatus(alias, { status: "active" }, t.pipe)');
    expect(status).toContain("setContentModelStatus(alias, change, target.pipe)");
  });

  it("deprecating a model stops only the workflows on its pipe, never retire-by-content across the channel", () => {
    const confirm = status.slice(status.indexOf("const confirm = async"), status.indexOf("if (typeof document"));
    const model = confirm.slice(confirm.indexOf("} else {"));
    expect(model).not.toContain("retireWorkflowsByContent");
    expect(model).toContain("for (const w of rows) await setWorkflowDynastyStatus(w.workflowDynastySlug");
    // The list is the channel's dry run kept to the workflows the pipe's leg ranks.
    expect(status).toContain("({ model, featureSlug: target.pipe.featureSlug })");
    expect(status).toContain("preview.data.workflows.filter((w) => onPipe.has(w.workflowDynastySlug))");
  });
});
