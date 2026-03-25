/**
 * Returns the user-facing display name for a workflow.
 * Priority: displayName > signatureName (capitalized) > name (fallback).
 *
 * The `displayName` stays constant across workflow upgrades/forks,
 * whereas `name` (the versioned signature) changes on every upgrade.
 * Users should always see the stable display name.
 */
export function workflowDisplayName(wf: {
  signatureName?: string | null;
  displayName?: string | null;
  name?: string | null;
  workflowName?: string | null;
}): string {
  if (wf.displayName) return wf.displayName;
  if (wf.signatureName && typeof wf.signatureName === "string") {
    return wf.signatureName.charAt(0).toUpperCase() + wf.signatureName.slice(1);
  }
  return wf.name || wf.workflowName || "Unknown";
}
