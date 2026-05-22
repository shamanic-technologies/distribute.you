import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const landingPagePath = path.resolve(__dirname, "../../src/app/page.tsx");
const pricingPagePath = path.resolve(__dirname, "../../src/app/pricing/page.tsx");
const performancePagePath = path.resolve(__dirname, "../../src/app/performance/page.tsx");
const featuresPath = path.resolve(__dirname, "../../../../shared/content/src/features.ts");
const portfolioDashboardPath = path.resolve(
  __dirname,
  "../../src/components/portfolio-dashboard.tsx"
);
const gmailInboxPath = path.resolve(__dirname, "../../src/components/gmail-inbox.tsx");
const freeVsCloudPath = path.resolve(__dirname, "../../src/components/free-vs-cloud.tsx");
const workflowRecipePath = path.resolve(__dirname, "../../src/components/workflow-recipe.tsx");
const toolsMarqueePath = path.resolve(__dirname, "../../src/components/tools-marquee.tsx");

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

  it("renders the new PortfolioDashboard component", () => {
    expect(page).toMatch(/<PortfolioDashboard/);
    expect(page).toMatch(/from\s+["']@\/components\/portfolio-dashboard["']/);
  });

  it("renders the GmailInbox component instead of phone push", () => {
    expect(page).toMatch(/<GmailInbox/);
    expect(page).toMatch(/from\s+["']@\/components\/gmail-inbox["']/);
  });

  it("renders the FreeVsCloud 2-tier component", () => {
    expect(page).toMatch(/<FreeVsCloud/);
    expect(page).toMatch(/from\s+["']@\/components\/free-vs-cloud["']/);
  });

  it("renders the WorkflowRecipe component", () => {
    expect(page).toMatch(/<WorkflowRecipe/);
    expect(page).toMatch(/from\s+["']@\/components\/workflow-recipe["']/);
  });

  it("includes 'For builders, not businesses' section", () => {
    expect(page).toMatch(/For builders,\s+not businesses/i);
  });

  it("includes 'What you don't have to do' email-infra section", () => {
    expect(page).toMatch(/What you don'?t have to do/i);
  });

  it("mentions $2 welcome credits in hero or CTA", () => {
    expect(page).toMatch(/\$2.*credit|credit.*\$2/i);
  });

  it("computes liveCount from features and renders 'channels live' line + Stripe analogy", () => {
    expect(page).toMatch(/liveCount/);
    expect(page).toMatch(/channels live/);
    expect(page).toMatch(/Stripe of Distribution/);
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

  it("shows a CAC / $-per-reply column", () => {
    expect(content).toMatch(/\$\/.*reply|CAC|cost.*per/i);
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

  it("renders both Free (self-host) and Cloud (pay-as-you-go) tiers", () => {
    expect(content).toMatch(/Self-host|self.host/i);
    expect(content).toMatch(/Pay-as-you-go|pay.as.you.go|\$2.*credit/i);
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

describe("Performance page: cost-per-reply framing", () => {
  const content = fs.readFileSync(performancePagePath, "utf-8");
  const loadingPath = path.resolve(__dirname, "../../src/app/performance/loading.tsx");
  const loading = fs.readFileSync(loadingPath, "utf-8");

  it("hero frames the leaderboard by cost per reply (no bare 'CAC')", () => {
    expect(content).toMatch(/cost per (qualified )?reply/i);
    expect(content).not.toMatch(/\bCAC\b/);
  });

  it("loading.tsx hero copy stays in sync with page.tsx hero (no visual flash)", () => {
    expect(loading).toMatch(/Cost per qualified reply/);
    expect(loading).toMatch(/Workflows ranked by[\s\S]*real cost per reply/);
    expect(loading).toMatch(/Every workflow ranked by cost per qualified reply/);
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
