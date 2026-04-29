/**
 * Returns the user-facing display name for a workflow.
 * Priority: workflowDynastyName > signatureName (capitalized) > workflowName (fallback).
 *
 * The `workflowDynastyName` stays constant across workflow upgrades/forks,
 * whereas `workflowName` (the versioned signature) changes on every upgrade.
 * Users should always see the stable dynasty name.
 */
export function workflowDisplayName(wf: {
  workflowDynastyName?: string | null;
  signatureName?: string | null;
  workflowName?: string | null;
  workflowSlug?: string | null;
}): string {
  if (wf.workflowDynastyName) return wf.workflowDynastyName;
  if (wf.signatureName && typeof wf.signatureName === "string") {
    return wf.signatureName.charAt(0).toUpperCase() + wf.signatureName.slice(1);
  }
  return wf.workflowName || wf.workflowSlug || "Unknown";
}
