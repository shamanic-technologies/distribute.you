import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Two right-panel affordances on the Leads page.
 *
 * 1. The "Audience" card states WHICH audience the lead came from and links to the
 *    Audiences page for everything else. It used to also print Size / Remaining,
 *    which duplicated numbers the Audiences page owns while still not showing the
 *    targeting filters — the thing a reader of that card actually wants. The link
 *    carries `?audienceId=`, the deep-link seed CustomerAudiencesPage reads on first
 *    paint, so the audience's detail panel (colored targeting tags) opens directly.
 *
 *    Its destination is built from the AUDIENCE's own `offerId`, never from the route
 *    the reader is on. Audiences live under the offer, so a route-built link had no
 *    offer segment to insert on the brand Leads page and pointed at
 *    `/brands/:id/audiences`, which is not a route — the card's one affordance was a
 *    404 there. An audience filed under no offer (rows predating the offer level) has
 *    no page at all, so it renders NO link rather than one that 404s.
 *
 * 2. The email value is copy-to-clipboard, NOT a link. It shipped styled as one
 *    (`text-brand-600` + `hover:underline`), which promises a `mailto:` and then does
 *    something else on click. The copy intent is carried by a persistent copy glyph
 *    that darkens on hover plus a Copy/Copied tooltip, the way Stripe, PatternFly and
 *    Shoelace carry it; the address itself stays plain text.
 *
 * Source-substring guards: the component pulls Clerk/api through the `@` alias vitest
 * does not resolve here, matching the repo's other page guards. Both are scoped to
 * their own function body — `text-brand-600` and `hover:underline` are legitimate
 * elsewhere in this file (the audience link itself, the tab bar).
 */
describe("Leads right panel — audience card and email copy", () => {
  const filePath = path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx");
  const src = fs.readFileSync(filePath, "utf-8");

  // Measured from `function AudienceSection(`: `audienceOfferId` at 986, the gated
  // link at 2460, its copy at 2639, and the next function at 3308. A `toContain`
  // guard fails when the slice is too SHORT, so 3000 is measured against the file,
  // never guessed — re-measure when the block grows.
  const sliceFrom = (marker: string, length = 3000) => {
    const at = src.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    return src.slice(at, at + length);
  };

  it("audience card drops Size / Remaining and links to the audience detail panel", () => {
    const body = sliceFrom("function AudienceSection(");
    expect(body).not.toContain("Size:");
    expect(body).not.toContain("Remaining:");
    expect(body).toContain("/audiences?audienceId=${inline.id}");
    expect(body).toContain("View audience details");
  });

  it("audience link is built from the audience's own offer, and is absent when it has none", () => {
    const body = sliceFrom("function AudienceSection(");
    // The audience states its offer; the route's is only the fallback for a lookup miss.
    expect(body).toContain("const audienceOfferId = full?.offerId ?? routeOfferId ?? null;");
    expect(body).toContain("tenantBasePath(orgId, brandId, audienceOfferId)");
    // Never the route's offer alone — that is what 404'd on the brand Leads page.
    expect(body).not.toContain("tenantBasePath(orgId, brandId, offerId)");
    // No offer resolvable ⟹ no link at all, rather than one pointing at a 404.
    expect(body).toContain("{detailHref && (");
    expect(body).toContain("href={detailHref}");
  });

  it("the audience reader declares offerId, so the link has something to read", () => {
    // A field the producer serves as required must be required here too: declared
    // `.optional()` (or absent) it would read `undefined` forever and every link
    // would silently vanish, which is indistinguishable from "this audience has no
    // offer". human-service marks `offerId` required + nullable on every audience
    // response (list, status, avatar).
    const api = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");
    const at = api.indexOf("const AudienceSchema = z.object({");
    expect(at, "AudienceSchema not found").toBeGreaterThan(-1);
    expect(api.slice(at, at + 900)).toContain("offerId: z.string().nullable(),");
  });

  it("email copy control is not styled as a link and names the copy action", () => {
    const body = sliceFrom("function CopyableEmail(");
    expect(body).not.toContain("text-brand-600");
    expect(body).not.toContain("hover:underline");
    expect(body).toContain('title={copied ? "Copied" : "Copy"}');
    expect(body).toContain("aria-label={`Copy email address ${email}`}");
    expect(body).toContain("group-hover:text-gray-500");
  });
});
