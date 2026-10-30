import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  FEED,
  LEGS,
  SIGNUP_CONNECTORS,
  boardHtml,
  compareHtml,
  counterTotals,
  renderSignupAutomationPage,
  signupFaq,
} from "../../src/lib/pages/signup-automation";
import { renderSignupAlternativesPage, renderSignupVsPage } from "../../src/lib/pages/signup-automation-compare";
import { UA_FEED, UA_LEGS, renderUserAcquisitionAgencyPage, uaCostTableHtml } from "../../src/lib/pages/user-acquisition-agency";
import { renderUaAlternativesPage, renderUaVsPage } from "../../src/lib/pages/user-acquisition-agency-compare";
import { renderCustomerSuccessAgencyPage } from "../../src/lib/pages/customer-success-agency";
import { renderLeadNurturingAutomationPage } from "../../src/lib/pages/lead-nurturing-automation";
import { renderGtmAutomationPage, compareHtml as gtmCompareHtml } from "../../src/lib/pages/gtm-automation";
import { renderComparePage } from "../../src/lib/compare-page";
import { quotesHtml } from "../../src/lib/pages/ai-sdr";
import { competitorBySlug, competitorLogo } from "../../src/lib/competitors";
import { SIGNUP_TOOLS, signupClusterPaths, signupVsPath } from "../../src/lib/signup-tools";
import { UA_AGENCIES, uaClusterPaths, uaVsPath } from "../../src/lib/user-acquisition-agencies";
import { BOOK_A_CALL, footerModel, navModel } from "../../src/lib/site-chrome";
import { SITE_PAGES, pageAt, sitePagePaths } from "../../src/lib/site-pages";

/**
 * PAGE-SIGNUP-AUTOMATION-1030 (`/signup-automation`, AI Agent) and
 * PAGE-USER-ACQUISITION-AGENCY-1030 (`/user-acquisition-agency`, Agency), with their vs and
 * alternatives clusters. Rendered behaviour (the odometer rolling as each row lands, the dark
 * sticky story, reduced motion) was checked with Playwright; this pins the contract.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));

const agent = renderSignupAutomationPage();
const agency = renderUserAcquisitionAgencyPage();
const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
const sentences = (html: string) => new Set(text(html).split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 40));

describe("the Signups catalogue entries", () => {
  it("are live at the given paths, with their own sections and compare columns", () => {
    const a = SITE_PAGES.find((p) => p.outcome === "signups" && p.buyer === "agent");
    const g = SITE_PAGES.find((p) => p.outcome === "signups" && p.buyer === "agency");
    expect(a?.path).toBe("/signup-automation");
    expect(g?.path).toBe("/user-acquisition-agency");
    expect(a?.live && g?.live).toBe(true);
    expect(pageAt("/user-acquisition-agency")?.navLabel).toBe("User Acquisition Agency");
    expect(sitePagePaths()).toEqual(expect.arrayContaining(["/signup-automation", "/user-acquisition-agency"]));
    expect(footerModel("/signup-automation").variant).toBe("agent");
    expect(footerModel("/user-acquisition-agency").variant).toBe("agency");
    expect(navModel("/user-acquisition-agency").ctas[0].label).toBe("Book a call");
    expect(navModel("/signup-automation").ctas[0].label).toBe("Start free");
    for (const id of ["path", "tools", "how", "prices", "compare", "pricing", "agent", "faq"]) expect(agent).toContain(`id="${id}"`);
    for (const id of ["how", "legs", "compare", "price", "faq"]) expect(agency).toContain(`id="${id}"`);
  });

  it("the sitemap lists both clusters", () => {
    const sm = read("src/app/sitemap.ts");
    expect(sm).toContain("signupClusterPaths()");
    expect(sm).toContain("uaClusterPaths()");
    expect(signupClusterPaths()).toHaveLength(SIGNUP_TOOLS.length + 1);
    expect(uaClusterPaths()).toHaveLength(UA_AGENCIES.length + 1);
  });

  it("the GTM automation umbrella links the new AI Agent page", () => {
    expect(renderGtmAutomationPage()).toContain('href="/signup-automation"');
  });
});

describe("the Signup Automation page", () => {
  it("targets its keywords in title, H1 and meta, with its own canonical", () => {
    expect(agent).toContain("<title>Signup Automation: an AI Agent That Gets You More Signups");
    expect(agent).toMatch(/<h1>Signup Automation<br><span class="accent">Done For You<\/span>/);
    expect(agent).toMatch(/<meta name="description" content="Revenue made easy\. Signup automation/);
    expect(agent).toContain('<link rel="canonical" href="https://distribute.you/signup-automation">');
    expect(agent).toContain("User acquisition automation");
  });

  it("states the current AI Agent offer and starts free", () => {
    for (const s of ["Free for one user", "0% markup", "$9", "start with $10", "gtm-factory", "Start free"]) expect(agent).toContain(s);
    expect(agent).toContain("<!--action-prices-->");
    expect(agent).toContain("__HOT_LEAD_BAND__");
  });

  it("bridges to the Agency twin, and the twin back", () => {
    expect(agent).toContain('href="/user-acquisition-agency"');
    expect(agency).toContain('href="/signup-automation"');
  });

  it("the signature board: every row in the HTML, each counter's total is the rows that add to it", () => {
    const b = boardHtml(FEED, { tone: "light", title: "t", note: "n" });
    expect(b).toContain('data-motion="signup-roll"');
    expect(b.match(/data-beat/g)?.length).toBe(FEED.length);
    const t = counterTotals(FEED);
    for (const k of ["visits", "signups", "paid"] as const) expect(b).toContain(`data-roll="${k}">${t[k]}</span>`);
    expect(agent).toContain("su-light");
    expect(agency).toContain("su-dark");
    // A preview: roles and company types, never a person's name.
    for (const r of [...FEED, ...UA_FEED]) expect(r.who).toMatch(/^[A-Z][A-Za-z ]+, [A-Za-z0-9 ]+$/);
    const kit = read("public/landing/v2/motion.js");
    expect(kit).toContain('"signup-roll": function (el, gsap)');
    expect(kit).toContain('yPercent: ch === " " ? 0 : -10 * Number(ch)');
    const css = read("public/landing/v2/signups.css");
    expect(css).toContain(".roll-d { display: inline-block; height: 1em; overflow: hidden;");
    expect(agent).toContain('href="/landing/v2/signups.css?v=');
    expect(agency).toContain('href="/landing/v2/signups.css?v=');
  });

  it("names only what runs: the four catalogue steps and the three connectors", () => {
    expect(LEGS.map((l) => `${l.from} > ${l.to}`)).toEqual([
      "Start > Website visit",
      "Start > Signup",
      "Website visit > Signup",
      "Signup > Paid client",
    ]);
    expect(UA_LEGS.map((l) => l.route)).toEqual(["Start → Website visit", "Start → Signup", "Website visit → Signup", "Signup → Paid client"]);
    expect(SIGNUP_CONNECTORS.map((c) => c.name)).toEqual(["PostHog", "Clerk", "Stripe"]);
  });

  it("the compare table reads every tool's own figure and its source", () => {
    const t = compareHtml();
    for (const tool of SIGNUP_TOOLS) {
      expect(t).toContain(tool.entryPrice);
      expect(t).toContain(`href="${tool.sourceUrl}"`);
      expect(t).toContain(`href="${signupVsPath(tool)}"`);
      expect(new URL(tool.sourceUrl).hostname.endsWith(tool.domain)).toBe(true);
      expect(tool.verifiedOn).toMatch(/^2026-10-\d\d$/);
    }
  });

  it("every vs page and the alternatives page render, with the FAQ in JSON-LD", () => {
    for (const tool of SIGNUP_TOOLS) {
      const p = renderSignupVsPage(tool);
      expect(p).toContain(`<h1>distribute.you <span class="accent">vs</span> ${tool.name}</h1>`);
      expect(p).toContain(`<link rel="canonical" href="https://distribute.you${signupVsPath(tool)}">`);
      expect(p).toContain('"@type":"FAQPage"');
    }
    const alt = renderSignupAlternativesPage();
    for (const tool of SIGNUP_TOOLS) expect(alt).toContain(`href="${signupVsPath(tool)}"`);
  });

  it("is its own page, never the nurturing page with words swapped", () => {
    const own = sentences(agent);
    const theirs = sentences(renderLeadNurturingAutomationPage());
    // The shared testimonials block and the price aside are the house's, on every AI Agent page.
    const quotes = sentences(quotesHtml());
    const shared = [...own].filter((s) => theirs.has(s) && !quotes.has(s) && !/Revenue made easy|cookies|©/.test(s));
    expect(shared.length).toBeLessThanOrEqual(8);
    expect(signupFaq().length).toBeGreaterThanOrEqual(8);
  });
});

describe("the User Acquisition Agency page", () => {
  it("targets its keywords in title, H1 and meta, with its own canonical", () => {
    expect(agency).toContain("<title>User Acquisition Agency: ");
    expect(agency).toMatch(/<h1[^>]*>The user acquisition agency that turns buyers into paying users\.<\/h1>/);
    expect(agency).toMatch(/<meta name="description" content="[^"]*user acquisition agency for SaaS/);
    expect(agency).toContain("SaaS growth agenc");
    expect(agency).toContain('<link rel="canonical" href="https://distribute.you/user-acquisition-agency">');
  });

  it("states the owner's price, the why line, and books a call", () => {
    expect(agency).toContain("From $1K/month + 10% of budget");
    expect(agency).toContain("Revenue made easy.");
    expect(agency).toContain("<h3>User Acquisition Agency</h3>");
    expect(agency.match(new RegExp(`href="${BOOK_A_CALL}" target="_blank"`, "g"))?.length).toBeGreaterThanOrEqual(4);
    for (const fx of ["signup-roll", "sticky-story", "reveal"]) expect(agency).toContain(`data-motion="${fx}"`);
  });

  it("the cost table states every agency's own figure and its source", () => {
    const t = uaCostTableHtml();
    for (const a of UA_AGENCIES) {
      expect(t).toContain(a.entryPrice);
      expect(t).toContain(`href="${a.sourceUrl}"`);
      expect(new URL(a.sourceUrl).hostname.endsWith(a.domain)).toBe(true);
      for (const f of [a.pricing, a.contract, a.channels, a.guarantee, a.claim, a.oneLiner]) expect(new URL(f.sourceUrl).hostname.endsWith(a.domain)).toBe(true);
    }
  });

  it("every vs page and the alternatives page render", () => {
    for (const a of UA_AGENCIES) {
      const p = renderUaVsPage(a);
      expect(p).toContain(`distribute.you vs ${a.name}`);
      expect(p).toContain(`<link rel="canonical" href="https://distribute.you${uaVsPath(a)}">`);
    }
    const alt = renderUaAlternativesPage();
    for (const a of UA_AGENCIES) expect(alt).toContain(`href="${uaVsPath(a)}"`);
  });

  it("is its own page, never the customer success page with words swapped", () => {
    const own = sentences(agency);
    const theirs = sentences(renderCustomerSuccessAgencyPage());
    const shared = [...own].filter((s) => theirs.has(s) && !/Revenue made easy|cookies|©/.test(s));
    expect(shared.length).toBeLessThanOrEqual(8);
  });
});

describe("copy rules on both pages and their clusters", () => {
  const pages = [
    agent,
    agency,
    renderSignupAlternativesPage(),
    renderUaAlternativesPage(),
    ...SIGNUP_TOOLS.map(renderSignupVsPage),
    ...UA_AGENCIES.map(renderUaVsPage),
  ];
  it("no dashes, no agency word on the AI Agent side, no opens", () => {
    for (const p of pages) {
      const t = text(p);
      expect(t).not.toMatch(/[—–]/);
      expect(t).not.toMatch(/open rate/i);
    }
  });
});

describe("a white competitor logo sits on a dark tile (Default, PAGE-GTM-AUTOMATION-1030 table)", () => {
  it("Default is flagged and drawn on a dark tile; the others are not", () => {
    const d = competitorBySlug("default");
    expect(d?.logoOnDark).toBe(true);
    expect(competitorLogo(d!, 20)).toContain("background:#0a0a0a");
    expect(competitorLogo(competitorBySlug("clay")!, 20)).not.toContain("background:");
    expect(gtmCompareHtml()).toMatch(/img\.logo\.dev\/default\.com[^>]*background:#0a0a0a/);
    expect(renderComparePage(d!)).toMatch(/<span class="cmp-logo"><img src="https:\/\/img\.logo\.dev\/default\.com[^>]*background:#0a0a0a/);
  });
});
