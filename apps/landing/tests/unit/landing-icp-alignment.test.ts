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

  it("renders the GmailInbox component instead of phone push", () => {
    expect(page).toMatch(/<GmailInbox/);
    expect(page).toMatch(/from\s+["']@\/components\/gmail-inbox["']/);
  });

  it("renders the FreeVsCloud 2-tier component", () => {
    expect(page).toMatch(/<FreeVsCloud/);
    expect(page).toMatch(/from\s+["']@\/components\/free-vs-cloud["']/);
  });

  it("does NOT celebrate staying solo in the aspiration paragraph", () => {
    expect(page).not.toMatch(/\$1M MRR\s*[—-]\s*solo/);
    expect(page).not.toMatch(/staying solo/i);
  });

  it("includes 'What you don't have to do' email-infra section", () => {
    expect(page).toMatch(/What you don'?t have to do/i);
  });

  it("mentions $25 welcome credits in hero or CTA", () => {
    expect(page).toMatch(/\$25.*credit|credit.*\$25/i);
  });

  it("renders the cold-email hero + Sales Automation tag (no multi-channel grid)", () => {
    expect(page).toMatch(/Cold Email Outreach,/);
    expect(page).toMatch(/Sales Automation/);
    expect(page).not.toMatch(/channels live/);
    expect(page).not.toMatch(/DISTRIBUTION_FEATURES/);
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

  it("renders the ToolsMarquee component", () => {
    expect(page).toMatch(/<ToolsMarquee/);
    expect(page).toMatch(/from\s+["']@\/components\/tools-marquee["']/);
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

  it("uses the cold-email-focused 'Why most cold email never gets read' h2", () => {
    expect(page).toMatch(/Why most cold email never gets read/);
    expect(page).not.toMatch(/Why distribution kills most solo products/);
  });

  it("cites the new source organizations in the section sub", () => {
    expect(page).toMatch(/Lemlist, Saleshandy, Adobe, and Gartner/);
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
