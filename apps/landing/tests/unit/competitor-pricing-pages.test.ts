import { describe, expect, it } from "vitest";

import {
  comparePageDescription,
  comparePageTitle,
  renderAlternativesPage,
  renderCompareHub,
  renderComparePage,
  renderCompetitorAlternativesPage,
} from "../../src/lib/compare-page";
import { esc } from "../../src/lib/v2-shell";
import {
  COMPETITORS,
  competitorAlternativesPath,
  competitorBySlug,
  competitorPath,
  comparePaths,
  monthLabel,
  pricingAnsweredCompetitors,
} from "../../src/lib/competitors";

/**
 * SEO-COMPETITOR-PRICING-PAGES-1106: the "<name> pricing" and "<name> alternatives" searches
 * that bring signups. Each answered competitor gets its comparison page opening on a dated
 * pricing answer (title led by "<name> pricing") and its own `/alternatives/<slug>` page.
 */
const prose = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");

const ANSWERED = ["explee", "aisdr", "topo", "persana"];

describe("the competitors whose pricing searches we answer", () => {
  it("are Explee, AiSDR, Topo and Persana, and never Instantly or HeyReach (owner skipped them)", () => {
    expect(pricingAnsweredCompetitors().map((c) => c.slug).sort()).toEqual([...ANSWERED].sort());
  });

  it("were read on their own site in November 2026, the date the page prints", () => {
    for (const c of pricingAnsweredCompetitors()) {
      expect(c.verifiedOn, c.slug).toMatch(/^2026-11-\d\d$/);
      const notice = c.pricingAnswer!.notice;
      if (notice) {
        expect(new URL(notice.sourceUrl).hostname.replace(/^www\./, "")).toBe(c.domain);
        expect(notice.readOn).toMatch(/^2026-11-\d\d$/);
      }
    }
  });

  it("list alternatives that exist in the catalogue, never themselves", () => {
    for (const c of pricingAnsweredCompetitors()) {
      for (const slug of c.pricingAnswer!.alternatives) {
        expect(competitorBySlug(slug), `${c.slug} -> ${slug}`).toBeDefined();
        expect(slug).not.toBe(c.slug);
      }
    }
  });
});

describe("a pricing-answered comparison page", () => {
  for (const slug of ANSWERED) {
    const c = competitorBySlug(slug)!;
    const html = renderComparePage(c);
    const copy = prose(html);

    it(`${slug}: the title leads with "${c.name} pricing" and the month`, () => {
      expect(comparePageTitle(c, new Date("2026-11-06T09:00:00Z"))).toMatch(new RegExp(`^${c.name} pricing \\(November 2026\\)`));
      expect(comparePageDescription(c).length).toBeLessThanOrEqual(155);
    });

    it(`${slug}: opens on the direct answer with the date it was checked`, () => {
      const answerAt = html.indexOf(`${c.name} pricing, checked `);
      expect(answerAt).toBeGreaterThan(0);
      expect(answerAt).toBeLessThan(html.indexOf('id="table"'));
      expect(html).toContain(esc(c.pricingAnswer!.answer));
      expect(html).toContain('id="real-cost"');
      expect(html).toContain(`href="${competitorAlternativesPath(c)}"`);
    });

    it(`${slug}: ships no dash and no banned claim`, () => {
      expect(copy).not.toContain("—");
      expect(copy).not.toContain("–");
      expect(copy).not.toMatch(/\bno mark-?up\b|\bat cost\b|\bpass-?through\b/i);
    });
  }

  it("tells the two Explees apart", () => {
    expect(renderComparePage(competitorBySlug("explee")!)).toContain("explainer-video tool of the same name");
  });

  it("states Persana's own retirement note, linked to its blog", () => {
    const html = renderComparePage(competitorBySlug("persana")!);
    expect(html).toContain("sunsetting the Persana platform");
    expect(html).toContain('href="https://persana.ai/blogs/exciting-news-our-next-chapter"');
  });

  it("leaves every other comparison page's title as it was", () => {
    const artisan = competitorBySlug("artisan")!;
    expect(comparePageTitle(artisan, new Date("2026-11-06T09:00:00Z"))).toBe(
      "Artisan alternative: distribute.you vs Artisan pricing (November 2026)",
    );
  });
});

describe("an /alternatives/<slug> page", () => {
  for (const slug of ANSWERED) {
    const c = competitorBySlug(slug)!;
    const html = renderCompetitorAlternativesPage(c);

    it(`${slug}: title leads with "${c.name} alternatives", canonical, indexable`, () => {
      expect(html).toContain(`<title>${c.name} alternatives (${monthLabel(new Date())}):`);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you${competitorAlternativesPath(c)}">`);
      expect(html).not.toContain("noindex");
    });

    it(`${slug}: sets every alternative's price beside its source, and links its comparison page`, () => {
      for (const altSlug of c.pricingAnswer!.alternatives) {
        const o = competitorBySlug(altSlug)!;
        expect(html).toContain(`href="${competitorPath(o)}"`);
        expect(html).toContain(o.entryPrice.replaceAll("&", "&amp;"));
        expect(html).toContain(`href="${o.sourceUrl}" rel="nofollow noopener"`);
      }
      expect(html).toContain(`href="${competitorPath(c)}"`);
      expect(html).toContain('href="/alternatives"');
    });

    it(`${slug}: FAQPage, ItemList and BreadcrumbList parse`, () => {
      const types = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])["@type"]);
      expect(types).toEqual(expect.arrayContaining(["FAQPage", "ItemList", "BreadcrumbList"]));
    });

    it(`${slug}: ships no dash and never calls distribute.you an agency`, () => {
      const copy = prose(html);
      expect(copy).not.toContain("—");
      expect(copy).not.toMatch(/distribute\.you is (?:a|an)\b[^.]*\bagency\b|\bour agency\b/i);
      expect(copy).not.toMatch(/\bno mark-?up\b|\bat cost\b/i);
    });
  }
});

describe("the new pages are reachable", () => {
  it("from /alternatives and /compare in raw HTML, and in the sitemap list", () => {
    const hub = renderCompareHub();
    const alt = renderAlternativesPage();
    for (const c of pricingAnsweredCompetitors()) {
      expect(alt).toContain(`href="${competitorAlternativesPath(c)}"`);
      expect(hub).toContain(`href="${competitorAlternativesPath(c)}"`);
      expect(comparePaths()).toContain(competitorAlternativesPath(c));
    }
  });

  it("an unanswered slug is the designed 404", async () => {
    const { GET } = await import("@/app/alternatives/[slug]/route");
    const unanswered = COMPETITORS.find((c) => !c.pricingAnswer)!;
    const res = await GET(new Request(`https://distribute.you/alternatives/${unanswered.slug}`), {
      params: Promise.resolve({ slug: unanswered.slug }),
    });
    expect(res.status).toBe(404);
  });

  it("/alternatives/explee is a real page", async () => {
    const { GET } = await import("@/app/alternatives/[slug]/route");
    const res = await GET(new Request("https://distribute.you/alternatives/explee"), { params: Promise.resolve({ slug: "explee" }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Explee alternatives, <span");
  }, 20_000);
});
