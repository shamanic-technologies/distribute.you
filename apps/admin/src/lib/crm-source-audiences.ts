// Pure join between crm-service "sources" (the CSV files imported for a brand)
// and human-service audiences. api-free on purpose so it is unit-testable and so
// the React card stays a thin renderer.
//
// Model: ONE imported source ⟷ ONE audience bound to it. A source with no bound
// audience is not part of the outreach yet; a source whose audience is `active`
// is ON; any other lifecycle status (paused / archived / suggested) is OFF.

export type AudienceLifecycle =
  | "suggested"
  | "active"
  | "paused"
  | "archived"
  | "deprecated";

/** Shape of a crm-service upload, narrowed to what the join needs. */
export interface CrmSourceLike {
  id: string;
  filename?: string | null;
  rowCount?: number | null;
  status?: string | null;
  uploadedAt?: string | null;
}

/** Shape of a human-service audience, narrowed to what the join needs. */
export interface AudienceLike {
  id: string;
  name: string;
  provider: string | null;
  status: AudienceLifecycle;
  crmSourceUploadId?: string | null;
}

export interface CrmSourceAudienceRow {
  uploadId: string;
  /** null when crm-service has no filename for the upload — the row renders but
   *  cannot be turned on, because an audience needs a name and we never invent one. */
  filename: string | null;
  rowCount: number;
  uploadStatus: string | null;
  uploadedAt: string | null;
  /** The audience bound to this source, if one has been created. */
  audienceId: string | null;
  audienceStatus: AudienceLifecycle | null;
  /** ON = a bound audience exists and is active. */
  enabled: boolean;
}

export function isCrmAudience(a: AudienceLike): boolean {
  return a.provider === "crm";
}

/**
 * The audience name for a source = the CSV filename, verbatim. Returns null when
 * the source has no usable filename (the caller must then block the toggle
 * rather than fabricate a name).
 */
export function audienceNameForSource(filename: string | null | undefined): string | null {
  const trimmed = (filename ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * CRM audiences that are NOT bound to a source. These are the legacy /
 * whole-brand CRM audiences: while one of them is active it serves people from
 * EVERY imported source, which contradicts the per-source switches. The card
 * surfaces them so the two readings can never silently disagree.
 */
export function unboundCrmAudiences(audiences: AudienceLike[]): AudienceLike[] {
  return audiences.filter((a) => isCrmAudience(a) && !a.crmSourceUploadId);
}

/**
 * Join sources to their bound audience. Newest upload first (mirrors the CRM
 * Sources page ordering). When several audiences claim the same source, the
 * active one wins — an ON switch must never read OFF because a stale archived
 * duplicate sorted first.
 */
export function buildCrmSourceAudienceRows(
  uploads: CrmSourceLike[],
  audiences: AudienceLike[],
): CrmSourceAudienceRow[] {
  const bound = new Map<string, AudienceLike>();
  for (const a of audiences) {
    if (!isCrmAudience(a) || !a.crmSourceUploadId) continue;
    const current = bound.get(a.crmSourceUploadId);
    if (!current || (current.status !== "active" && a.status === "active")) {
      bound.set(a.crmSourceUploadId, a);
    }
  }

  return [...uploads]
    .sort((a, b) => {
      const at = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const bt = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return bt - at;
    })
    .map((u) => {
      const audience = bound.get(u.id) ?? null;
      return {
        uploadId: u.id,
        filename: audienceNameForSource(u.filename),
        rowCount: u.rowCount ?? 0,
        uploadStatus: u.status ?? null,
        uploadedAt: u.uploadedAt ?? null,
        audienceId: audience?.id ?? null,
        audienceStatus: audience?.status ?? null,
        enabled: audience?.status === "active",
      };
    });
}
