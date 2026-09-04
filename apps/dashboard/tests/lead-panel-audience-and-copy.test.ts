import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Two right-panel affordances on the Leads page.
 *
 * 1. The audience row states WHICH audience picked this lead, and it lives INSIDE the
 *    campaign that picked them. lead-service stores the attribution on the
 *    `leads_campaigns` row, so a person contacted by several campaigns was picked by
 *    each for its own reason and a single person-level card could only state one of
 *    them. It links to the Audiences page for everything else — it used to also print
 *    Size / Remaining, which duplicated numbers that page owns while still not showing
 *    the targeting filters, the thing a reader actually wants. The link carries
 *    `?audienceId=`, the deep-link seed CustomerAudiencesPage reads on first paint.
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
 * Source-substring guards: both components pull Clerk/api through the `@` alias vitest
 * does not resolve here, matching the repo's other page guards. Each is scoped to its
 * own function body — `text-brand-600` and `hover:underline` are legitimate elsewhere
 * in both files (the audience link itself, the tab bar).
 */
describe("Leads right panel — audience row and email copy", () => {
  const page = fs.readFileSync(
    path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
    "utf-8",
  );
  const sections = fs.readFileSync(
    path.join(__dirname, "../src/components/audiences/lead-campaign-sections.tsx"),
    "utf-8",
  );

  /** Bounded to the NEXT declaration rather than a measured length: a `toContain`
   *  cannot be hurt by a slice running long, and the boundary moves with the file. */
  const sliceTo = (src: string, marker: string, next: string) => {
    const at = src.indexOf(marker);
    expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
    const end = src.indexOf(next, at);
    return src.slice(at, end > at ? end : undefined);
  };

  it("the audience sits inside its own campaign, not at person level", () => {
    // The card that decided it renders it; nothing states one audience for the person.
    expect(sections).toContain("<AudienceRow");
    expect(page).not.toContain("<AudienceSection inline=");
    const card = sliceTo(sections, "function CampaignCard(", "function AudienceRow(");
    expect(card).toContain("campaign.audience");
    // A campaign that attributed none says so rather than rendering an empty card.
    expect(card).toContain("No audience attributed");
  });

  it("audience row drops Size / Remaining and links to the audience detail panel", () => {
    const body = sliceTo(sections, "function AudienceRow(", "\n}\n");
    expect(body).not.toContain("Size:");
    expect(body).not.toContain("Remaining:");
    expect(body).toContain("/audiences?audienceId=${inline.id}");
    expect(body).toContain("View audience details");
  });

  it("audience link is built from the audience's own offer, and is absent when it has none", () => {
    const body = sliceTo(sections, "function AudienceRow(", "\n}\n");
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
    const body = sliceTo(page, "function CopyableEmail(", "\nfunction ");
    expect(body).not.toContain("text-brand-600");
    expect(body).not.toContain("hover:underline");
    expect(body).toContain('title={copied ? "Copied" : "Copy"}');
    expect(body).toContain("aria-label={`Copy email address ${email}`}");
    expect(body).toContain("group-hover:text-gray-500");
  });
});
