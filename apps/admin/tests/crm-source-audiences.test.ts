import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  audienceNameForSource,
  buildCrmSourceAudienceRows,
  isCrmAudience,
  unboundCrmAudiences,
  type AudienceLike,
  type CrmSourceLike,
} from "../src/lib/crm-source-audiences";

const upload = (over: Partial<CrmSourceLike> & { id: string }): CrmSourceLike => ({
  filename: "list.csv",
  rowCount: 10,
  status: "promoted",
  uploadedAt: "2026-07-01T00:00:00.000Z",
  ...over,
});

const audience = (over: Partial<AudienceLike> & { id: string }): AudienceLike => ({
  name: "list.csv",
  provider: "crm",
  status: "active",
  crmUploadId: null,
  ...over,
});

describe("audienceNameForSource", () => {
  it("uses the CSV filename verbatim", () => {
    expect(audienceNameForSource("Clients 2026.csv")).toBe("Clients 2026.csv");
  });

  it("returns null rather than inventing a name when the filename is missing", () => {
    expect(audienceNameForSource(null)).toBeNull();
    expect(audienceNameForSource("")).toBeNull();
    expect(audienceNameForSource("   ")).toBeNull();
  });
});

describe("isCrmAudience", () => {
  it("only matches the crm provider", () => {
    expect(isCrmAudience(audience({ id: "a", provider: "crm" }))).toBe(true);
    expect(isCrmAudience(audience({ id: "a", provider: "apollo" }))).toBe(false);
    expect(isCrmAudience(audience({ id: "a", provider: null }))).toBe(false);
  });
});

describe("buildCrmSourceAudienceRows", () => {
  it("marks a source with an active bound audience as ON", () => {
    const rows = buildCrmSourceAudienceRows(
      [upload({ id: "u1" })],
      [audience({ id: "a1", crmUploadId: "u1", status: "active" })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].enabled).toBe(true);
    expect(rows[0].audienceId).toBe("a1");
    expect(rows[0].audienceStatus).toBe("active");
  });

  it("marks a paused bound audience as OFF but keeps the audience id", () => {
    const rows = buildCrmSourceAudienceRows(
      [upload({ id: "u1" })],
      [audience({ id: "a1", crmUploadId: "u1", status: "paused" })],
    );
    expect(rows[0].enabled).toBe(false);
    expect(rows[0].audienceId).toBe("a1");
  });

  it("marks a source with no bound audience as OFF with no audience id", () => {
    const rows = buildCrmSourceAudienceRows([upload({ id: "u1" })], []);
    expect(rows[0].enabled).toBe(false);
    expect(rows[0].audienceId).toBeNull();
    expect(rows[0].audienceStatus).toBeNull();
  });

  it("ignores audiences bound to another source and non-crm audiences", () => {
    const rows = buildCrmSourceAudienceRows(
      [upload({ id: "u1" })],
      [
        audience({ id: "a1", crmUploadId: "u2", status: "active" }),
        audience({ id: "a2", provider: "apollo", crmUploadId: "u1", status: "active" }),
      ],
    );
    expect(rows[0].enabled).toBe(false);
    expect(rows[0].audienceId).toBeNull();
  });

  it("prefers the active audience when several claim the same source", () => {
    const rows = buildCrmSourceAudienceRows(
      [upload({ id: "u1" })],
      [
        audience({ id: "stale", crmUploadId: "u1", status: "archived" }),
        audience({ id: "live", crmUploadId: "u1", status: "active" }),
      ],
    );
    expect(rows[0].audienceId).toBe("live");
    expect(rows[0].enabled).toBe(true);
  });

  it("sorts newest upload first", () => {
    const rows = buildCrmSourceAudienceRows(
      [
        upload({ id: "old", uploadedAt: "2026-01-01T00:00:00.000Z" }),
        upload({ id: "new", uploadedAt: "2026-07-01T00:00:00.000Z" }),
      ],
      [],
    );
    expect(rows.map((r) => r.uploadId)).toEqual(["new", "old"]);
  });

  it("surfaces a missing filename as null so the caller can block the toggle", () => {
    const rows = buildCrmSourceAudienceRows([upload({ id: "u1", filename: null })], []);
    expect(rows[0].filename).toBeNull();
  });

  it("defaults a missing rowCount to 0 without hiding the row", () => {
    const rows = buildCrmSourceAudienceRows([upload({ id: "u1", rowCount: null })], []);
    expect(rows[0].rowCount).toBe(0);
  });
});

describe("unboundCrmAudiences", () => {
  it("returns crm audiences with no source binding", () => {
    const found = unboundCrmAudiences([
      audience({ id: "whole-brand", crmUploadId: null }),
      audience({ id: "bound", crmUploadId: "u1" }),
      audience({ id: "apollo", provider: "apollo", crmUploadId: null }),
    ]);
    expect(found.map((a) => a.id)).toEqual(["whole-brand"]);
  });
});

// The card must never fabricate an audience name, and must never gate on a
// hardcoded feature slug of its own (the slug lives in one helper).
describe("crm source audiences card wiring", () => {
  const cardSrc = readFileSync(
    join(__dirname, "../src/components/settings/crm-source-audiences-card.tsx"),
    "utf8",
  );
  const pageSrc = readFileSync(
    join(
      __dirname,
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/settings/page.tsx",
    ),
    "utf8",
  );

  it("names the audience after the source filename, from the joined row", () => {
    expect(cardSrc).toContain("name: row.filename");
  });

  it("creates the audience bound to the source it was toggled from", () => {
    expect(cardSrc).toContain("crmUploadId: row.uploadId");
    expect(cardSrc).toContain('provider: "crm"');
  });

  it("reveals on settle so a failed read never eternal-skeletons", () => {
    expect(cardSrc).toContain("isError: uploadsError");
    expect(cardSrc).toContain("isError: audiencesError");
    expect(cardSrc).toContain("const settled =");
  });

  it("gates the Audiences section on the shared slug helper, not a literal", () => {
    expect(pageSrc).toContain("isCrmOutreachFeature(featureSlug)");
    expect(pageSrc).not.toMatch(/featureSlug\s*===\s*["']sales-crm/);
  });
});
