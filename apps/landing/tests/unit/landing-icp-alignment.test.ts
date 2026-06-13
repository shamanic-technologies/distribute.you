import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const landingPagePath = path.resolve(__dirname, "../../public/landing/index.html");
const performancePagePath = path.resolve(
  __dirname,
  "../../public/landing/performance.html"
);
const landingRoutePath = path.resolve(__dirname, "../../src/app/route.ts");
const performanceRoutePath = path.resolve(__dirname, "../../src/app/performance/route.ts");
const staticHtmlPath = path.resolve(__dirname, "../../src/lib/static-html.ts");
const nextConfigPath = path.resolve(__dirname, "../../next.config.ts");
const benchmarksPagePath = path.resolve(__dirname, "../../src/app/benchmarks/page.tsx");
const benchmarksLayoutPath = path.resolve(__dirname, "../../src/app/benchmarks/layout.tsx");
const benchmarksSlugRoutePath = path.resolve(
  __dirname,
  "../../src/app/benchmarks/[...slug]/route.ts",
);
const pricingHtmlPath = path.resolve(__dirname, "../../public/landing/pricing.html");
const privacyPagePath = path.resolve(__dirname, "../../src/app/privacy/page.tsx");
const globalsPath = path.resolve(__dirname, "../../src/app/globals.css");
const rootLayoutPath = path.resolve(__dirname, "../../src/app/layout.tsx");
const investorsPagePath = path.resolve(__dirname, "../../src/app/investors/page.tsx");
const termsPagePath = path.resolve(__dirname, "../../src/app/terms/page.tsx");
const blogPagePath = path.resolve(__dirname, "../../src/app/blog/page.tsx");
const blogSlugPagePath = path.resolve(__dirname, "../../src/app/blog/[slug]/page.tsx");
const seoPath = path.resolve(__dirname, "../../src/lib/seo.ts");
const featuresPath = path.resolve(__dirname, "../../../../shared/content/src/features.ts");
const sourcedStatsDataPath = path.resolve(__dirname, "../../src/data/sourced-stats.ts");
const sourcedStatsCmpPath = path.resolve(__dirname, "../../src/components/sourced-stats.tsx");
const providerAvatarPath = path.resolve(__dirname, "../../src/components/provider-avatar.tsx");
const benchmarksContentPath = path.resolve(__dirname, "../../src/data/benchmarks-content.ts");
const navbarPath = path.resolve(__dirname, "../../src/components/navbar.tsx");
const footerPath = path.resolve(__dirname, "../../src/components/footer.tsx");

describe("Landing page: ICP-only alignment", () => {
  const page = fs.readFileSync(landingPagePath, "utf-8");

  it("does NOT contain large 'Without distribute.you / With distribute.you' Claude Code section", () => {
    const withoutCount = (page.match(/Without distribute\.you/g) || []).length;
    const withCount = (page.match(/With distribute\.you/g) || []).length;
    expect(withoutCount).toBeLessThan(2);
    expect(withCount).toBeLessThan(2);
  });

  it("does NOT contain phone notification iPhone mockup", () => {
    expect(page).not.toMatch(/phone notification/i);
    expect(page).not.toMatch(/rounded-3xl[^"]*p-2[^"]*shadow-2xl/);
  });

  it("serves the exact static HTML through the root route", () => {
    const route = fs.readFileSync(landingRoutePath, "utf-8");
    expect(route).toMatch(/staticResponse\("index\.html"\)/);
  });

  it("includes the exact CSS, JS, and logo asset references", () => {
    expect(page).toMatch(/href="css\/styles\.css"/);
    expect(page).toMatch(/src="js\/main\.js"/);
    expect(page).toMatch(/src="logo\/logo-distribute\.svg"/);
  });

  it("does NOT celebrate staying solo in the aspiration paragraph", () => {
    expect(page).not.toMatch(/\$1M MRR\s*[—-]\s*solo/);
    expect(page).not.toMatch(/staying solo/i);
  });

  it("includes the 'full-time GTM job you skip' section", () => {
    expect(page).toMatch(/The full-time GTM job you skip/i);
  });

  it("mentions the 50 free prospects offer in hero or CTA", () => {
    expect(page).toMatch(/50 free prospects/i);
  });

  it("renders the autopilot sales hero copy (no multi-channel grid)", () => {
    expect(page).toMatch(/Sales Automation Platform/);
    expect(page).toMatch(/100 sales/);
    expect(page).toMatch(/in 30 days\./);
    expect(page).not.toMatch(/channels live/);
    expect(page).not.toMatch(/DISTRIBUTION_FEATURES/);
  });

  it("does not render legacy sourced stats, leaderboard, or tools marquee sections on the home", () => {
    expect(page).not.toMatch(/<ColdEmailPainStats/);
    expect(page).not.toMatch(/<LeaderboardSectionAsync/);
    expect(page).not.toMatch(/<ToolsMarquee/);
    expect(page).not.toMatch(/Why most cold email never gets read/);
    expect(page).not.toMatch(/Built to slot into your stack/);
  });
});

describe("Landing static pages", () => {
  const performance = fs.readFileSync(performancePagePath, "utf-8");

  it("serves the exact designer performance page at /performance", () => {
    const route = fs.readFileSync(performanceRoutePath, "utf-8");
    expect(route).toMatch(/staticResponse\("performance\.html"\)/);
    expect(performance).toMatch(/Public campaign data,<br>updated from production\./);
    expect(performance).toMatch(/id="proofTrack"/);
    expect(performance).toMatch(/funnel-bar-fill/);
    expect(performance).toMatch(/<script src="js\/main\.js" defer><\/script>/);
  });

  it("keeps /benchmarks as the existing benchmark page, not a performance redirect", () => {
    const config = fs.readFileSync(nextConfigPath, "utf-8");
    const benchmarksRedirectBlock = config.match(
      /source:\s*"\/benchmarks",[\s\S]*?destination:\s*"([^"]+)"/,
    );
    expect(benchmarksRedirectBlock).toBeNull();
    expect(config).not.toMatch(/source:\s*"\/benchmarks\/:slug\*"/);
    expect(fs.existsSync(benchmarksPagePath)).toBe(true);
    expect(fs.existsSync(benchmarksLayoutPath)).toBe(true);
    expect(fs.existsSync(benchmarksSlugRoutePath)).toBe(true);
    const page = fs.readFileSync(benchmarksPagePath, "utf-8");
    expect(page).toMatch(/const PAGE_URL = `\$\{PROD_URLS\.landing\}\/benchmarks`/);
    const slugRoute = fs.readFileSync(benchmarksSlugRoutePath, "utf-8");
    expect(slugRoute).toMatch(/NextResponse\.redirect\(new URL\("\/benchmarks"/);
  });


  it("rewrites static designer links that would otherwise 404 on landing", () => {
    const helper = fs.readFileSync(staticHtmlPath, "utf-8");
    expect(helper).toMatch(/href="\/docs\/api"/);
    expect(helper).toMatch(/URLS\.apiDocs/);
    expect(helper).toMatch(/href="\/docs\/mcp"/);
    expect(helper).toMatch(/URLS\.mcp/);
    expect(helper).toMatch(/href="\/sign-in"/);
    expect(helper).toMatch(/URLS\.signIn/);
    expect(helper).toMatch(/href="\/sign-up"/);
    expect(helper).toMatch(/URLS\.signUp/);
    expect(helper).toMatch(/github\.com\/distribute-you/);
    expect(helper).toMatch(/URLS\.github/);
  });

  it("keeps the local landing legal links routable", () => {
    expect(fs.existsSync(privacyPagePath)).toBe(true);
    const page = fs.readFileSync(privacyPagePath, "utf-8");
    expect(page).toMatch(/Privacy Policy/);
    expect(page).toMatch(/support@distribute\.you/);
  });

  it("maps React chrome links to the same landing routes", () => {
    const navbar = fs.readFileSync(navbarPath, "utf-8");
    const footer = fs.readFileSync(footerPath, "utf-8");
    expect(navbar).toMatch(/\{ label: "Performance", href: urls\.performance \}/);
    expect(navbar).toMatch(/\{ label: "Benchmarks", href: urls\.benchmarks \}/);
    expect(navbar).toMatch(/landing\/logo\/logo-distribute\.svg/);
    expect(navbar).not.toMatch(/logo-head\.jpg/);
    expect(footer).toMatch(/\{ label: "Performance", href: "\/performance" \}/);
    expect(footer).toMatch(/\{ label: "Benchmarks", href: "\/benchmarks" \}/);
    expect(footer).toMatch(/landing\/logo\/logo-distribute\.svg/);
    expect(footer).not.toMatch(/logo-head\.jpg/);
  });

  it("uses the visual system on React landing pages", () => {
    const globals = fs.readFileSync(globalsPath, "utf-8");
    const benchmarks = fs.readFileSync(benchmarksPagePath, "utf-8");
    const privacy = fs.readFileSync(privacyPagePath, "utf-8");
    expect(globals).toMatch(/--dy-bg:/);
    expect(globals).toMatch(/JetBrains\+Mono/);
    expect(globals).not.toMatch(/Fredoka/);
    expect(benchmarks).toMatch(/<main className="dy-page">/);
    expect(benchmarks).toMatch(/dy-title/);
    expect(privacy).toMatch(/<main className="dy-page">/);
  });

  it("keeps OpenGraph, Twitter, and JSON-LD aligned to the brand assets", () => {
    const files = [
      landingPagePath,
      performancePagePath,
      rootLayoutPath,
      benchmarksPagePath,
      investorsPagePath,
      privacyPagePath,
      termsPagePath,
      blogPagePath,
      blogSlugPagePath,
      seoPath,
    ];
    const combined = files.map((file) => fs.readFileSync(file, "utf-8")).join("\n");

    expect(fs.existsSync(path.resolve(__dirname, "../../src/app/benchmarks/opengraph-image.tsx"))).toBe(true);
    expect(combined).toMatch(/\/landing\/logo\/logo-distribute\.svg/);
    expect(combined).toMatch(/logo:\s*BRAND_LOGO_URL|\"logo\":\"https:\/\/distribute\.you\/landing\/logo\/logo-distribute\.svg\"/);
    expect(combined).toMatch(/\/opengraph-image/);
    expect(combined).toMatch(/\/benchmarks\/opengraph-image/);
    expect(combined).toMatch(/\/investors\/opengraph-image/);
    expect(combined).not.toMatch(/\/og-image\.jpg/);

    const landing = fs.readFileSync(landingPagePath, "utf-8");
    const performance = fs.readFileSync(performancePagePath, "utf-8");
    for (const page of [landing, performance]) {
      expect(page).toMatch(/property="og:image" content="https:\/\/distribute\.you\/opengraph-image"/);
      expect(page).toMatch(/name="twitter:image" content="https:\/\/distribute\.you\/opengraph-image"/);
      expect(page).toMatch(/rel="icon" href="\/landing\/logo\/logo-distribute\.svg"/);
      expect(page).toMatch(/"@type":"Organization"/);
      expect(page).toMatch(/"logo":"https:\/\/distribute\.you\/landing\/logo\/logo-distribute\.svg"/);
    }
  });
});

describe("Landing page: tools marquee section", () => {
  const page = fs.readFileSync(landingPagePath, "utf-8");

  it("does not render the ToolsMarquee component in the home", () => {
    expect(page).not.toMatch(/<ToolsMarquee/);
    expect(page).not.toMatch(/from\s+["']@\/components\/tools-marquee["']/);
  });
});

describe("Pricing page: budget calculator (static pricing.html)", () => {
  const content = fs.readFileSync(pricingHtmlPath, "utf-8");

  it("serves the pay-per-email budget calculator", () => {
    expect(content).toMatch(/calculator/i);
    expect(content).toMatch(/0\.07/);
    expect(content).toMatch(/px-calc/);
  });

  it("uses the shared nav/footer + main asset bundle", () => {
    expect(content).toMatch(/id="site-nav"/);
    expect(content).toMatch(/id="site-footer"/);
    expect(content).toMatch(/href="css\/styles\.css"/);
  });
});

describe("Landing page: industry stats section", () => {
  const page = fs.readFileSync(landingPagePath, "utf-8");

  it("does not render the legacy industry stats section in the home", () => {
    expect(page).not.toMatch(/Why most cold email never gets read/);
    expect(page).not.toMatch(/Why distribution kills most solo products/);
  });

  it("keeps the pricing section immediately after the skipped-work section", () => {
    expect(page).toMatch(/The full-time GTM job you skip/);
    expect(page).toMatch(/Pay per email\. Stop anytime\./);
    expect(page).not.toMatch(/Lemlist, Saleshandy, Adobe, and Gartner/);
  });
});

describe("sourced-stats data: 4 new ICP-aligned picks with provider logos", () => {
  const content = fs.readFileSync(sourcedStatsDataPath, "utf-8");

  it("extends SourcedStat with providerDomain", () => {
    expect(content).toMatch(/providerDomain:\s*string/);
  });

  it("uses Lemlist warmup as stat 1", () => {
    expect(content).toMatch(/3.5 weeks/);
    expect(content).toMatch(/lemlist\.com/);
  });

  it("uses Saleshandy follow-up lift as stat 2", () => {
    expect(content).toMatch(/8\.3% vs 4\.1%/);
    expect(content).toMatch(/saleshandy\.com/);
  });

  it("uses Adobe GenAI referral as stat 3", () => {
    expect(content).toMatch(/\+1,200%/);
    expect(content).toMatch(/adobe\.com/);
  });

  it("uses Gartner search decline as stat 4", () => {
    expect(content).toMatch(/.25%/);
    expect(content).toMatch(/gartner\.com/);
  });
});

describe("sourced-stats component: renders provider logo via shared ProviderAvatar", () => {
  const content = fs.readFileSync(sourcedStatsCmpPath, "utf-8");

  it("imports the shared ProviderAvatar", () => {
    expect(content).toMatch(/from\s+["']@\/components\/provider-avatar["']/);
    expect(content).toMatch(/<ProviderAvatar/);
  });
});

describe("ProviderAvatar shared helper", () => {
  it("exists at src/components/provider-avatar.tsx", () => {
    expect(fs.existsSync(providerAvatarPath)).toBe(true);
  });

  const content = fs.existsSync(providerAvatarPath)
    ? fs.readFileSync(providerAvatarPath, "utf-8")
    : "";

  it("exports a ProviderAvatar component using logo.dev", () => {
    expect(content).toMatch(/export function ProviderAvatar/);
    expect(content).toMatch(/img\.logo\.dev/);
    expect(content).toMatch(/NEXT_PUBLIC_LOGO_DEV_TOKEN/);
  });
});

describe("Investors page: dream quote reframed (CAC/scale, not staying solo)", () => {
  const content = fs.readFileSync(investorsPagePath, "utf-8");

  it("contains the new CAC-actionable scale framing", () => {
    expect(content).toMatch(/CAC because I am looking for my marketing channel to scale/);
    expect(content).toMatch(/whether I stay 1 person or grow/);
  });

  it("removes the 'while staying solo' phrasing from the dream", () => {
    expect(content).not.toMatch(/while staying solo/i);
  });
});

describe("benchmarks-content: SALES ctaClosing rewritten", () => {
  const content = fs.readFileSync(benchmarksContentPath, "utf-8");

  it("replaces 'Stay solo. Go big.' with 'Ship more. Scale what works.' for sales-cold-email", () => {
    expect(content).not.toMatch(/headline:\s*"Stay solo\. Go big\.",/);
    expect(content).toMatch(/headline:\s*"Ship more\. Scale what works\.",/);
  });
});

describe("shared/content/src/features.ts: sales-cold-email only", () => {
  const content = fs.readFileSync(featuresPath, "utf-8");

  it("exposes exactly one feature: sales-outreach", () => {
    const matches = content.match(/id:\s*["'][a-z-]+["']/g) || [];
    expect(matches).toHaveLength(1);
    expect(content).toMatch(/id:\s*"sales-outreach"/);
  });

  it("dropped every off-message channel", () => {
    expect(content).not.toMatch(/journalist-outreach/);
    expect(content).not.toMatch(/vc-outreach/);
    expect(content).not.toMatch(/hiring-outreach/);
    expect(content).not.toMatch(/accelerator/i);
    expect(content).not.toMatch(/press-kit/i);
    expect(content).not.toMatch(/influencer|linkedin-outreach/i);
    expect(content).not.toMatch(/status:\s*"coming-soon"/);
  });
});
