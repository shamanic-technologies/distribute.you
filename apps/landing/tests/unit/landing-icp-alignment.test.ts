import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const landingPagePath = path.resolve(__dirname, "../../src/app/page.tsx");
const pricingPagePath = path.resolve(__dirname, "../../src/app/pricing/page.tsx");
const performancePagePath = path.resolve(__dirname, "../../src/app/performance/page.tsx");
const investorsPagePath = path.resolve(__dirname, "../../src/app/investors/page.tsx");
const featuresPath = path.resolve(__dirname, "../../../../shared/content/src/features.ts");
const portfolioDashboardPath = path.resolve(
  __dirname,
  "../../src/components/portfolio-dashboard.tsx"
);
const gmailInboxPath = path.resolve(__dirname, "../../src/components/gmail-inbox.tsx");
const freeVsCloudPath = path.resolve(__dirname, "../../src/components/free-vs-cloud.tsx");
const workflowRecipePath = path.resolve(__dirname, "../../src/components/workflow-recipe.tsx");
const toolsMarqueePath = path.resolve(__dirname, "../../src/components/tools-marquee.tsx");
const sourcedStatsDataPath = path.resolve(__dirname, "../../src/data/sourced-stats.ts");
const sourcedStatsCmpPath = path.resolve(__dirname, "../../src/components/sourced-stats.tsx");
const providerAvatarPath = path.resolve(__dirname, "../../src/components/provider-avatar.tsx");
const featureProvidersPath = path.resolve(__dirname, "../../src/data/feature-providers.ts");
const benchmarksContentPath = path.resolve(__dirname, "../../src/data/benchmarks-content.ts");

describe("Landing page: design-system port", () => {
  const page = fs.readFileSync(landingPagePath, "utf-8");

  it("wraps the page in the DS root scope", () => {
    expect(page).toMatch(/className="dy-root"/);
  });

  it("uses the DS hero copy and type scale", () => {
    expect(page).toMatch(/You build\./);
    expect(page).toMatch(/We distribute\./);
    expect(page).toMatch(/className="t-hero/);
  });

  it("renders the inline dashboard mockup with KPIs and chart", () => {
    expect(page).toMatch(/dy-hero-ui/);
    expect(page).toMatch(/Qualified replies over time/);
    expect(page).toMatch(/\$1\.42/);
  });

  it("renders the stats band with the four DS counters", () => {
    expect(page).toMatch(/dy-stats-card/);
    expect(page).toMatch(/avg per qualified reply/);
    expect(page).toMatch(/channels live/);
    expect(page).toMatch(/free to start/);
    expect(page).toMatch(/open source/);
  });

  it("renders the 9-channel bento", () => {
    expect(page).toMatch(/dy-channels-bento/);
    expect(page).toMatch(/Sales outreach/);
    expect(page).toMatch(/Journalist outreach/);
    expect(page).toMatch(/VC outreach/);
    expect(page).toMatch(/Hiring outreach/);
    expect(page).toMatch(/Accelerator outreach/);
    expect(page).toMatch(/PR expert quotes/);
    expect(page).toMatch(/Outlet discovery/);
    expect(page).toMatch(/Press kit generation/);
    expect(page).toMatch(/AI visibility scoring/);
  });

  it("renders the compare grid (without/with distribute)", () => {
    expect(page).toMatch(/dy-compare/);
    expect(page).toMatch(/Without distribute/);
    expect(page).toMatch(/With distribute/);
  });

  it("renders the pricing card with the published unit rates", () => {
    expect(page).toMatch(/dy-price-card/);
    expect(page).toMatch(/Apollo lead enrichment/);
    expect(page).toMatch(/\$0\.036/);
  });

  it("renders the 3-tile integrations grid", () => {
    expect(page).toMatch(/dy-int-grid/);
    expect(page).toMatch(/Dashboard/);
    expect(page).toMatch(/REST API/);
    expect(page).toMatch(/MCP Server/);
  });

  it("mentions $25 free credits in the hero CTA", () => {
    expect(page).toMatch(/\$25.*credit|credit.*\$25/i);
  });

  it("uses the new DS navbar and footer components", () => {
    expect(page).toMatch(/<DyNav/);
    expect(page).toMatch(/<DyFooter/);
    expect(page).toMatch(/from\s+["']@\/components\/dy-nav["']/);
    expect(page).toMatch(/from\s+["']@\/components\/dy-footer["']/);
  });

  it("renders nothing with the deprecated GmailInbox or ToolsMarquee on the homepage", () => {
    expect(page).not.toMatch(/<GmailInbox/);
    expect(page).not.toMatch(/<ToolsMarquee/);
  });

  it("contains no em-dash in user-facing copy (AI tell)", () => {
    const stripJsxComments = page
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(stripJsxComments).not.toMatch(/—/);
  });
});

describe("PortfolioDashboard component", () => {
  it("exists at src/components/portfolio-dashboard.tsx", () => {
    expect(fs.existsSync(portfolioDashboardPath)).toBe(true);
  });

  const content = fs.existsSync(portfolioDashboardPath)
    ? fs.readFileSync(portfolioDashboardPath, "utf-8")
    : "";

  it("exports a PortfolioDashboard component", () => {
    expect(content).toMatch(/export function PortfolioDashboard/);
  });

  it("renders multiple products (multi-brand portfolio)", () => {
    expect(content).toMatch(/products/i);
  });

  it("shows a positive-reply column (CAC / $-per-reply variant)", () => {
    expect(content).toMatch(/positive reply/i);
    expect(content).toMatch(/\$\/positive reply/i);
  });
});

describe("GmailInbox component", () => {
  it("exists at src/components/gmail-inbox.tsx", () => {
    expect(fs.existsSync(gmailInboxPath)).toBe(true);
  });

  const content = fs.existsSync(gmailInboxPath)
    ? fs.readFileSync(gmailInboxPath, "utf-8")
    : "";

  it("exports a GmailInbox component", () => {
    expect(content).toMatch(/export function GmailInbox/);
  });

  it("simulates qualified-reply email subject lines", () => {
    expect(content).toMatch(/Qualified lead|qualified.*reply/i);
  });
});

describe("FreeVsCloud component", () => {
  it("exists at src/components/free-vs-cloud.tsx", () => {
    expect(fs.existsSync(freeVsCloudPath)).toBe(true);
  });

  const content = fs.existsSync(freeVsCloudPath)
    ? fs.readFileSync(freeVsCloudPath, "utf-8")
    : "";

  it("exports a FreeVsCloud component", () => {
    expect(content).toMatch(/export function FreeVsCloud/);
  });

  it("renders the single Pay-as-you-go cloud tier (self-host removed per ICP simplification)", () => {
    expect(content).toMatch(/Pay-as-you-go|pay.as.you.go|\$25.*credit/i);
    expect(content).not.toMatch(/Self-host|self.host/i);
  });
});

describe("ToolsMarquee component", () => {
  it("exists at src/components/tools-marquee.tsx", () => {
    expect(fs.existsSync(toolsMarqueePath)).toBe(true);
  });

  const content = fs.existsSync(toolsMarqueePath)
    ? fs.readFileSync(toolsMarqueePath, "utf-8")
    : "";

  it("exports a ToolsMarquee component", () => {
    expect(content).toMatch(/export function ToolsMarquee/);
  });

  it("uses logo.dev for tool icons", () => {
    expect(content).toMatch(/img\.logo\.dev/);
    expect(content).toMatch(/NEXT_PUBLIC_LOGO_DEV_TOKEN/);
  });

  it("renders 3 rows with alternating directions (ltr, rtl, ltr)", () => {
    const ltrMatches = (content.match(/direction="ltr"/g) || []).length;
    const rtlMatches = (content.match(/direction="rtl"/g) || []).length;
    expect(ltrMatches).toBe(2);
    expect(rtlMatches).toBe(1);
  });

  it("doubles the tool list for seamless infinite scroll", () => {
    expect(content).toMatch(/\[\.\.\.tools,\s*\.\.\.tools\]/);
  });
});

describe("Landing page: tools marquee section", () => {
  const page = fs.readFileSync(landingPagePath, "utf-8");

  it("does not render the old multi-tool marquee on the focused cold-email homepage", () => {
    expect(page).not.toMatch(/<ToolsMarquee/);
    expect(page).not.toMatch(/from\s+["']@\/components\/tools-marquee["']/);
  });
});

describe("GmailInbox component: real logos", () => {
  const content = fs.readFileSync(gmailInboxPath, "utf-8");

  it("loads the Gmail brand icon from logo.dev (not a hand-drawn SVG)", () => {
    expect(content).toMatch(/img\.logo\.dev\/gmail\.com/);
  });

  it("uses logo.dev for sender avatars", () => {
    expect(content).toMatch(/img\.logo\.dev\/\$\{entry\.senderDomain\}/);
  });
});

describe("WorkflowRecipe component", () => {
  it("exists at src/components/workflow-recipe.tsx", () => {
    expect(fs.existsSync(workflowRecipePath)).toBe(true);
  });

  const content = fs.existsSync(workflowRecipePath)
    ? fs.readFileSync(workflowRecipePath, "utf-8")
    : "";

  it("exports a WorkflowRecipe component", () => {
    expect(content).toMatch(/export function WorkflowRecipe/);
  });

  it("shows primitives stacking into a workflow with an outcome", () => {
    expect(content).toMatch(/primitive|stack|recipe/i);
  });
});

describe("Pricing page: ICP framing", () => {
  const content = fs.readFileSync(pricingPagePath, "utf-8");

  it("introduces the 3-layer pricing stack (primitives / workflows / outcomes)", () => {
    expect(content).toMatch(/primitive/i);
    expect(content).toMatch(/workflow/i);
    expect(content).toMatch(/outcome/i);
  });
});

describe("Landing page: industry stats section", () => {
  const page = fs.readFileSync(landingPagePath, "utf-8");

  it("does not cite non-cold-email source organizations on the homepage", () => {
    expect(page).not.toMatch(/Adobe, and Gartner/);
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

describe("Feature providers map (channels-grid logos)", () => {
  it("exists at src/data/feature-providers.ts", () => {
    expect(fs.existsSync(featureProvidersPath)).toBe(true);
  });

  const content = fs.existsSync(featureProvidersPath)
    ? fs.readFileSync(featureProvidersPath, "utf-8")
    : "";

  it("maps each live feature to a provider stack with logo.dev domains", () => {
    for (const id of [
      "sales-outreach",
      "journalist-outreach",
      "vc-outreach",
      "hiring-outreach",
      "accelerators-outreach",
      "pr-expert-quote-outreach",
      "outlet-discovery",
      "press-kit-generation",
      "ai-visibility-scoring",
    ]) {
      expect(content).toMatch(new RegExp(`"${id}"`));
    }
  });
});

describe("WorkflowRecipe trimmed copy + provider logos", () => {
  const content = fs.readFileSync(workflowRecipePath, "utf-8");

  it("drops the verbose 'Each workflow stacks priced API primitives' paragraph", () => {
    expect(content).not.toMatch(/Each workflow stacks priced API primitives/);
  });

  it("drops the 'Fork the workflow. Beat the recipe.' footer line", () => {
    expect(content).not.toMatch(/Fork the workflow\. Beat the recipe\./);
  });

  it("renders a provider logo per primitive via shared ProviderAvatar", () => {
    expect(content).toMatch(/from\s+["']@\/components\/provider-avatar["']/);
    expect(content).toMatch(/<ProviderAvatar/);
    expect(content).toMatch(/providerDomain:\s*["']apollo\.io["']/);
    expect(content).toMatch(/providerDomain:\s*["']anthropic\.com["']/);
    expect(content).toMatch(/providerDomain:\s*["']resend\.com["']/);
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

describe("Performance page: cost-per-positive-reply framing", () => {
  const content = fs.readFileSync(performancePagePath, "utf-8");

  it("hero frames the leaderboard by cost per positive reply (no bare 'CAC')", () => {
    expect(content).toMatch(/cost per positive reply/i);
    expect(content).not.toMatch(/\bCAC\b/);
  });
});

describe("shared/content/src/features.ts: backend-aligned catalog", () => {
  const content = fs.readFileSync(featuresPath, "utf-8");

  it("exposes at least 9 features (all backend channels)", () => {
    const matches = content.match(/id:\s*["'][a-z-]+["']/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(9);
  });

  it("includes the VC outreach channel", () => {
    expect(content).toMatch(/vc-(outreach|cold-email)/i);
  });

  it("includes the Accelerators outreach channel", () => {
    expect(content).toMatch(/accelerator/i);
  });

  it("includes the Press Kit channel", () => {
    expect(content).toMatch(/press-kit/i);
  });

  it("marks at least one channel as coming-soon (e.g. Influencers or LinkedIn)", () => {
    expect(content).toMatch(/coming-soon/);
    expect(content).toMatch(/influencer|linkedin/i);
  });
});
