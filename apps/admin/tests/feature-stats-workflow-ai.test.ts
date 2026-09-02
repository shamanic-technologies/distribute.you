import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildWorkflowCatalogue,
  workflowCatalogueInstructions,
} from "../src/lib/feature-stats-workflow-catalogue";
import { buildWorkflowPerfRows } from "../src/lib/feature-stats-workflow-rows";

const ROUTE = join(
  __dirname,
  "../src/app/(authed)/(dashboard)/feature-stats/sales-cold-email-outreach",
);
const PANEL = join(__dirname, "../src/components/feature-stats/workflow-ai-panel.tsx");
const read = (p: string) => readFileSync(p, "utf8");

// The panel + its context live in the SHARED workflows body every feature's
// /workflows route renders — the route file is a one-line wrapper.
const page = read(
  join(__dirname, "../src/components/feature-stats/feature-workflows-page.tsx"),
);
const panel = read(PANEL);

/** Minimal Workflow shape — only the fields the catalogue reads. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wf = (over: Record<string, unknown>): any => ({
  id: "id-1",
  workflowDynastySlug: "ballad",
  workflowDynastyName: "Ballad",
  version: 1,
  ...over,
});

describe("workflow catalogue", () => {
  it("keeps the newest version of each dynasty", () => {
    const rows = buildWorkflowCatalogue([
      wf({ id: "v1", version: 1 }),
      wf({ id: "v3", version: 3 }),
      wf({ id: "v2", version: 2 }),
    ]);
    expect(rows).toEqual([
      { workflowDynastySlug: "ballad", workflowDynastyName: "Ballad", id: "v3", version: 3 },
    ]);
  });

  it("drops a superseded version — forking it would branch a lineage nobody runs", () => {
    const rows = buildWorkflowCatalogue([
      wf({ id: "old", version: 5, upgradedTo: "new" }),
      wf({ id: "new", version: 6 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["new"]);
  });

  it("drops a deprecated dynasty entirely", () => {
    expect(buildWorkflowCatalogue([wf({ status: "deprecated" })])).toEqual([]);
  });

  it("falls back to the slug when a dynasty carries no name", () => {
    const [row] = buildWorkflowCatalogue([wf({ workflowDynastyName: "" })]);
    expect(row.workflowDynastyName).toBe("ballad");
  });

  it("orders by name so the table the model reads is stable across polls", () => {
    const rows = buildWorkflowCatalogue([
      wf({ id: "z", workflowDynastySlug: "zephyr", workflowDynastyName: "Zephyr" }),
      wf({ id: "a", workflowDynastySlug: "azalea", workflowDynastyName: "Azalea" }),
    ]);
    expect(rows.map((r) => r.workflowDynastyName)).toEqual(["Azalea", "Zephyr"]);
  });
});

describe("workflow catalogue instructions", () => {
  const instructions = workflowCatalogueInstructions("sales-cold-email-outreach", [
    { workflowDynastySlug: "ballad", workflowDynastyName: "Ballad", id: "uuid-ballad", version: 4 },
  ]);

  it("gives the model the name → UUID table so it never asks for an id", () => {
    expect(instructions).toContain('"Ballad"');
    expect(instructions).toContain("uuid-ballad");
    expect(instructions).toContain("Never ask the user for a UUID");
  });

  it("routes a duplication through fork_workflow, never create_workflow", () => {
    expect(instructions).toContain("get_workflow_details");
    expect(instructions).toContain("fork_workflow");
    expect(instructions).toContain("Do NOT use create_workflow for this");
  });

  it("says the DAG is read on demand — it is never inlined here", () => {
    expect(instructions).toContain("NOT inlined here");
  });

  it("states the empty-row consequence so the answer matches the table", () => {
    expect(instructions).toContain("no numbers yet");
  });

  it("forbids inventing an enumerated identifier from the user's words", () => {
    // 2026-08-15: the model heard "Deepseek Flash v4", wrote `deepseek-flash-v4`
    // into three prod DAGs, and reported them validated. The real alias is
    // `deepseek-flash`, and it was one get_endpoint_details call away.
    expect(instructions).toContain("Never turn the spoken name into a slug");
    expect(instructions).toContain("get_endpoint_details");
    expect(instructions).toContain("Do not answer from memory");
  });

  it("says validate_workflow does not check the value, so it is not proof", () => {
    expect(instructions).toContain("validate_workflow does NOT check this");
  });

  it("still names the catalogue when the feature runs nothing", () => {
    expect(workflowCatalogueInstructions("x", [])).toContain("none yet");
  });
});

describe("the catalogue is the fourth row source", () => {
  const entry = {
    workflowDynastySlug: "fresh",
    workflowDynastyName: "Fresh",
    id: "uuid-fresh",
    version: 1,
  };

  it("shows a workflow that has never run, with every earned figure blank", () => {
    const rows = buildWorkflowPerfRows([], [], [], [entry]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      slug: "fresh",
      name: "Fresh",
      positiveReplies: null,
      cpprUsd: null,
      websiteVisits: null,
      cpwvUsd: null,
      outreach: null,
      investedUsd: null,
    });
  });

  it("does not duplicate a workflow the stats reads already know", () => {
    const rows = buildWorkflowPerfRows(
      [
        {
          workflowDynastySlug: "fresh",
          workflowDynastyName: "Fresh",
          spentUsd: 10,
          observedClicks: 1,
          observedPositiveReplies: 1,
          costPerOutcomeUsd: 10,
          recentCostPerOutcomeUsd: null,
        },
      ],
      [],
      [],
      [entry],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].investedUsd).toBe(10);
  });

  it("stays optional, so the three-source callers are unchanged", () => {
    expect(buildWorkflowPerfRows([], [], [])).toEqual([]);
  });
});

describe("the Workflow page's Edit-with-AI panel", () => {
  it("ships the panel component", () => {
    expect(existsSync(PANEL)).toBe(true);
  });

  it("puts the button in the page header", () => {
    expect(page).toContain("Edit with AI");
    expect(page).toContain("setAiOpen(true)");
  });

  it("reuses the single-workflow chat instead of a second implementation", () => {
    expect(panel).toContain("WorkflowChat");
    expect(panel).toContain('from "@/components/workflows/workflow-chat"');
    expect(panel).not.toContain("useChat");
    expect(panel).not.toContain("DefaultChatTransport");
  });

  it("paints above the app header, which is sticky z-50", () => {
    // At z-40 the header covered the panel's own title and close button.
    expect(panel).toContain("fixed inset-0 z-[60]");
    expect(panel).not.toContain("fixed inset-0 z-40");
  });

  it("overlays the table rather than splitting it into a column", () => {
    expect(panel).toContain("fixed inset-0");
    expect(panel).toContain("absolute inset-y-0 right-0");
  });

  it("stays mounted while closed so a streaming answer is never aborted", () => {
    // Hidden, not unmounted: `invisible` + `pointer-events-none`, no early return.
    expect(panel).toContain("pointer-events-none invisible");
    expect(panel).not.toContain("if (!open) return null");
  });

  it("never inlines a DAG in the chat context — it is re-sent every turn", () => {
    const body = page.slice(page.indexOf("const aiContext"));
    expect(body).not.toContain("dag");
    expect(page).toContain("workflows: catalogue");
  });

  it("keys the catalogue under the root the chat invalidates, so a new workflow lands in the table", () => {
    expect(page).toContain('["workflows", featureSlug]');
  });

  it("reveals on settle — the catalogue read cannot skeleton the page forever", () => {
    expect(page).toContain("catalogueQuery.isPending && !catalogueQuery.isError");
  });
});
