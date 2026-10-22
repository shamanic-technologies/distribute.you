/**
 * The workflow version a run was on (WF-RUNS-OUTPUTS-1022). Pure formatting over the
 * fields content-generation-service serves; alias-free so it carries real unit tests.
 */

/**
 * A version's short label off its family slug: `acrux` + `acrux-v2` reads `v2`, the family's own
 * slug (its first version) `v1`. A slug that does not extend the family with `-v<N>` reads whole.
 */
export function runVersionLabel(familySlug: string, versionSlug: string | null): string | null {
  if (!versionSlug) return null;
  if (versionSlug === familySlug) return "v1";
  const prefix = `${familySlug}-`;
  if (versionSlug.startsWith(prefix)) {
    const rest = versionSlug.slice(prefix.length);
    if (/^v\d+$/.test(rest)) return rest;
  }
  return versionSlug;
}
