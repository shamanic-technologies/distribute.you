import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

describe("api.ts — brand sales-economics businessModel wiring", () => {
  const content = read("../src/lib/api.ts");

  it("exposes a BrandBusinessModel type", () => {
    expect(content).toContain('export type BrandBusinessModel = "b2c" | "b2b"');
  });

  it("BrandSalesEconomics carries businessModel (read shape includes it)", () => {
    expect(content).toContain("businessModel: BrandBusinessModel | null");
  });

  it("the Zod schema parses businessModel as a nullable b2c/b2b literal", () => {
    expect(content).toContain(
      'businessModel: z.union([z.literal("b2c"), z.literal("b2b")]).nullable()',
    );
  });

  it("keeps businessModel optional on the input so the campaign form (5 metrics only) still typechecks", () => {
    expect(content).toContain("businessModel?: BrandBusinessModel | null");
  });

  it("PUT body sends businessModel only when defined (partial-update: omit = unchanged, null = clear)", () => {
    expect(content).toContain("input.businessModel !== undefined");
    expect(content).toContain("{ businessModel: input.businessModel }");
  });

  it("exposes a BrandFunnelStage type with the 2 funnel elements (website_signup dropped)", () => {
    expect(content).toContain(
      'export type BrandFunnelStage = "website_purchase" | "sales_meeting"',
    );
    expect(content).not.toContain('"website_signup"');
  });

  it("decomposes self-serve close into visitToSignupPct + signupToPaidClientPct (visitToClosePct stays derived on read)", () => {
    expect(content).toContain("visitToSignupPct: number");
    expect(content).toContain("signupToPaidClientPct: number");
    // visitToClosePct stays on the READ shape (derived server-side) but is omitted from the INPUT.
    expect(content).toContain('"visitToClosePct"');
    expect(content).toContain("visitToSignupPct: z.number()");
    expect(content).toContain("signupToPaidClientPct: z.number()");
  });

  it("exposes a BrandOptimizationGoal type (signups | sales_meetings)", () => {
    expect(content).toContain(
      'export type BrandOptimizationGoal = "signups" | "sales_meetings"',
    );
  });

  it("BrandSalesEconomics carries funnelStages + optimizationGoal (read shape includes them)", () => {
    expect(content).toContain("funnelStages: BrandFunnelStage[]");
    expect(content).toContain("optimizationGoal: BrandOptimizationGoal");
  });

  it("keeps funnelStages + optimizationGoal optional on the input (campaign form omits them)", () => {
    expect(content).toContain("funnelStages?: BrandFunnelStage[]");
    expect(content).toContain("optimizationGoal?: BrandOptimizationGoal");
  });

  it("the Zod schema parses funnelStages (2-value array enum) + optimizationGoal (enum)", () => {
    expect(content).toContain("funnelStages: z.array(");
    expect(content).toContain('z.literal("website_purchase")');
    expect(content).toContain('z.literal("sales_meetings")');
    expect(content).toContain("normalizeBrandOptimizationGoal");
  });

  it("normalizes legacy producer optimization goals at the API boundary", () => {
    expect(content).toContain("type BrandOptimizationGoalWire");
    expect(content).toContain('z.literal("booked_meetings")');
    expect(content).toContain('z.literal("sales")');
    expect(content).toContain("return goal === \"signups\" ? \"signups\" : \"sales_meetings\"");
  });

  it("PUT body sends the decomposed self-serve steps + omits derived visitToClosePct", () => {
    expect(content).toContain("visitToSignupPct: input.visitToSignupPct");
    expect(content).toContain("signupToPaidClientPct: input.signupToPaidClientPct");
    // visitToClosePct is derived server-side → never in the PUT body.
    expect(content).not.toContain("visitToClosePct: input.visitToClosePct");
  });

  it("PUT body sends funnelStages + optimizationGoal only when defined (partial-update)", () => {
    expect(content).toContain("input.funnelStages !== undefined");
    expect(content).toContain("{ funnelStages: input.funnelStages }");
    expect(content).toContain("input.optimizationGoal !== undefined");
    expect(content).toContain("serializeBrandOptimizationGoal(input.optimizationGoal)");
  });
});

describe("BrandSalesEconomicsCard component", () => {
  const content = read("../src/components/settings/brand-sales-economics-card.tsx");

  it("is a client component", () => {
    expect(content).toContain('"use client"');
  });

  it("reads via getBrandSalesEconomics and writes via saveBrandSalesEconomics", () => {
    expect(content).toContain("getBrandSalesEconomics(brandId)");
    expect(content).toContain("saveBrandSalesEconomics(brandId, input)");
  });

  it("shares the brandSalesEconomics query key with the campaign form", () => {
    expect(content).toContain('["brandSalesEconomics", brandId]');
  });

  it("renders immediately from cache/defaults instead of blocking behind the backend read", () => {
    expect(content).toContain("queryClient.getQueryData<SalesEconomicsQueryData>");
    expect(content).toContain("useState<FormState>(() =>");
    expect(content).toContain("formFromEconomics(initialData?.salesEconomics)");
    expect(content).not.toContain("if (isPending || !form)");
  });

  it("writes the saved row to cache and invalidates the revenue overview on success", () => {
    expect(content).toContain('queryClient.setQueryData(["brandSalesEconomics", brandId], res)');
    expect(content).toContain('invalidateQueries({ queryKey: ["featureRevenue"] })');
  });

  it("renders the goal-driven economics fields + Save", () => {
    expect(content).toContain("Customer Lifetime Revenue");
    expect(content).toContain("Positive reply → meeting");
    expect(content).toContain("Website visit → meeting");
    expect(content).toContain("Website visit → signup");
    expect(content).not.toContain("Meeting → close");
    expect(content).not.toContain("Signup → paid client");
    expect(content).not.toContain("Website visit → close");
    expect(content).toContain("Save");
  });

  it("removes the business-model and Sales-funnel controls", () => {
    expect(content).not.toContain("Business model");
    expect(content).not.toContain("Sales funnel");
    expect(content).not.toContain("Website Purchase");
    expect(content).not.toContain('label: "Sales Meeting"');
    expect(content).not.toContain("Website Signup");
  });

  it("always renders the Optimization-goal single-choice (# Signups / # Sales Meetings)", () => {
    expect(content).toContain("Optimization goal");
    expect(content).toContain("# Signups");
    expect(content).toContain("# Sales Meetings");
    expect(content).not.toContain("$ Sales");
    expect(content).toContain("OPTIMIZATION_GOALS.map");
  });

  it("keeps fractional conversion percentages instead of rounding them before save", () => {
    expect(content).toContain("const toPctOrDefault = (v: string, fallback: string) =>");
    expect(content).toContain("visitToSignupPct: toPctOrDefault(");
    expect(content).toContain('step="0.1"');
  });

  it("shows only the conversion fields relevant to the selected optimization goal", () => {
    expect(content).toContain("visiblePctFields");
    expect(content).toContain("f.goals.includes(form.optimizationGoal)");
    expect(content).toContain('goals: ["sales_meetings"]');
    expect(content).toContain('goals: ["signups"]');
  });

  it("validates the selected goal fields before saving and derives funnelStages from the goal", () => {
    expect(content).toContain("REQUIRED_FIELDS_BY_GOAL");
    expect(content).toContain("setValidationError");
    expect(content).toContain("FUNNEL_STAGES_BY_GOAL");
    expect(content).toContain("funnelStages: [...FUNNEL_STAGES_BY_GOAL[form.optimizationGoal]]");
  });
});

describe("Brand Settings page", () => {
  const content = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );

  it("renders the Sales Economics section with the editor card", () => {
    expect(content).toContain("Sales Economics");
    expect(content).toContain("<BrandSalesEconomicsCard brandId={brandId} />");
  });

  it("does not render the brand transfer danger zone", () => {
    expect(content).not.toContain("Danger Zone");
    expect(content).not.toContain("Transfer brand");
    expect(content).not.toContain("Transfer History");
  });
});
