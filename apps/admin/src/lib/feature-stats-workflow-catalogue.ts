/**
 * The workflow CATALOGUE the Workflow page's AI panel edits against.
 *
 * The org-scoped workflow editor knows which workflow it edits from the URL, so
 * its chat context carries one `workflowId` and the model never has to resolve a
 * name. This page has no such URL: the user names the workflow in the sentence
 * ("duplicate Ballad but swap the LLM"). So the context carries a name → UUID
 * table instead, and the model resolves the sentence against it.
 *
 * What it deliberately does NOT carry is the DAG. A large workflow's DAG
 * serializes past the gateway's JSON body limit and the context is re-sent on
 * every turn, so the model reads it on demand via `get_workflow_details` — the
 * same rule the single-workflow editor follows.
 *
 * Alias-free (type-only import, erased at build) so it carries real unit tests.
 */
import type { Workflow } from "./api";

export type WorkflowCatalogueEntry = {
  /** Stable lineage slug — the same key the cross-org stats rows join on. */
  workflowDynastySlug: string;
  workflowDynastyName: string;
  /** UUID of the newest live version — what `fork_workflow` takes. */
  id: string;
  version: number;
};

/**
 * One entry per dynasty: the newest LIVE version.
 *
 * Deprecated dynasties and superseded versions (`upgradedTo` set) are dropped —
 * forking a retired version would branch a lineage nobody runs. Ties on version
 * keep the first seen, so the list order stays stable across polls.
 */
export function buildWorkflowCatalogue(workflows: Workflow[]): WorkflowCatalogueEntry[] {
  const byDynasty = new Map<string, WorkflowCatalogueEntry>();

  for (const w of workflows) {
    if (!w.workflowDynastySlug || !w.id) continue;
    if (w.status === "deprecated") continue;
    if (w.upgradedTo) continue;

    const current = byDynasty.get(w.workflowDynastySlug);
    if (current && current.version >= w.version) continue;

    byDynasty.set(w.workflowDynastySlug, {
      workflowDynastySlug: w.workflowDynastySlug,
      workflowDynastyName: w.workflowDynastyName || w.workflowDynastySlug,
      id: w.id,
      version: w.version,
    });
  }

  return [...byDynasty.values()].sort((a, b) =>
    a.workflowDynastyName.localeCompare(b.workflowDynastyName),
  );
}

/**
 * The instructions block for the catalogue-scoped chat.
 *
 * Two things it has to say that the single-workflow editor does not. First, the
 * target is named in the sentence, not in the context — so resolve it here, and
 * ask which one only when the name is genuinely ambiguous. Second, duplicating
 * an existing workflow is a FORK of its UUID, never `create_workflow`: the
 * platform prompt reads an absent `workflowId` as "this feature has no workflow
 * yet, generate one from scratch", which would throw away the very DAG the user
 * asked to copy.
 */
export function workflowCatalogueInstructions(
  featureSlug: string,
  catalogue: WorkflowCatalogueEntry[],
): string {
  const table = catalogue.length
    ? catalogue
        .map(
          (e) =>
            `- "${e.workflowDynastyName}" (dynasty ${e.workflowDynastySlug}, v${e.version}) → UUID ${e.id}`,
        )
        .join("\n")
    : "(none yet — this feature runs no workflow)";

  return [
    "You are a workflow assistant for the distribute.you platform, working from the",
    `cross-brand Workflow page of the "${featureSlug}" feature.`,
    "",
    "== SCOPE ==",
    `Every workflow of the "${featureSlug}" feature is in scope. This chat is NOT`,
    "locked to one workflow: the user names the one they mean in their message.",
    "",
    "== WORKFLOW CATALOGUE (name → UUID) ==",
    table,
    "",
    "Resolve the workflow the user names against this table and use its UUID for",
    "every tool call that takes a workflowId. Never ask the user for a UUID — you",
    "have them above. Ask which workflow they mean ONLY when the name they wrote",
    "matches more than one entry.",
    "",
    "== DUPLICATING A WORKFLOW ==",
    'When the user asks to duplicate / copy / clone a workflow with a change ("copy',
    'X but swap the LLM", "same as Y but with a different model"):',
    "1. call get_workflow_details with the SOURCE workflow's UUID from the table,",
    "2. mutate the returned DAG locally — apply only the change the user asked for,",
    "3. call fork_workflow with { workflowId: <source UUID>, dag: <complete DAG> },",
    "4. call validate_workflow on the result and report any error.",
    "Do NOT use create_workflow for this. create_workflow regenerates a DAG from a",
    "description and would discard the source workflow's pipeline, which is exactly",
    "what the user asked you to keep. create_workflow is only for a workflow that",
    "has no source to copy at all.",
    "",
    "The DAGs are NOT inlined here — they are large and the context is re-sent every",
    "turn. Read one with get_workflow_details whenever you need to inspect or edit it.",
    "",
    "== WHEN YOU ARE DONE ==",
    "State plainly what you created and its name, so the user can find its row in",
    "the table behind this panel. A new workflow appears there with no numbers yet:",
    "it has not run, so it has no spend and no outcomes to report.",
  ].join("\n");
}
