/**
 * Returns the user-facing display name for a workflow.
 * Priority: workflowDynastyName > workflowDynastySignatureName (capitalized) > workflowName (fallback).
 *
 * The `workflowDynastyName` stays constant across workflow upgrades/forks,
 * whereas `workflowName` (the versioned signature) changes on every upgrade.
 * Users should always see the stable dynasty name.
 */
export function workflowDisplayName(wf: {
  workflowDynastyName?: string | null;
  workflowDynastySignatureName?: string | null;
  workflowName?: string | null;
  workflowSlug?: string | null;
}): string {
  if (wf.workflowDynastyName) return wf.workflowDynastyName;
  if (wf.workflowDynastySignatureName && typeof wf.workflowDynastySignatureName === "string") {
    return wf.workflowDynastySignatureName.charAt(0).toUpperCase() + wf.workflowDynastySignatureName.slice(1);
  }
  return wf.workflowName || wf.workflowSlug || "Unknown";
}
