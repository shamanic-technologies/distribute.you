import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");
const deprecatedStageField = "funnel" + "Stages";
const deprecatedStageType = "Brand" + "Funnel" + "Stage";
const deprecatedStageConstant = "FUNNEL" + "_STAGES" + "_BY_GOAL";

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

  it("does not expose the deprecated sales-funnel stage field", () => {
    expect(content).not.toContain(deprecatedStageType);
    expect(content).not.toContain(deprecatedStageField);
    expect(content).not.toContain('"website_purchase"');
    expect(content).not.toContain('"sales_meeting"');
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

  it("BrandSalesEconomics carries optimizationGoal without the deprecated stage field", () => {
    expect(content).toContain("optimizationGoal: BrandOptimizationGoal");
    expect(content).not.toContain(`${deprecatedStageField}:`);
  });

  it("keeps optimizationGoal optional on the input", () => {
    expect(content).toContain("optimizationGoal?: BrandOptimizationGoal");
    expect(content).not.toContain(`${deprecatedStageField}?:`);
  });

  it("the Zod schema parses optimizationGoal without the deprecated stage field", () => {
    expect(content).toContain('z.literal("sales_meetings")');
    expect(content).toContain("normalizeBrandOptimizationGoal");
    expect(content).not.toContain(`${deprecatedStageField}: z.array(`);
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

  it("PUT body sends optimizationGoal only when defined (partial-update)", () => {
    expect(content).toContain("input.optimizationGoal !== undefined");
    expect(content).toContain("serializeBrandOptimizationGoal(input.optimizationGoal)");
    expect(content).not.toContain(`input.${deprecatedStageField}`);
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

  it("writes the saved row to cache and invalidates all econ-derived data on success", () => {
    expect(content).toContain('queryClient.setQueryData(["brandSalesEconomics", brandId], res)');
    // Economics drive every server-computed metric — blanket invalidate on save.
    expect(content).toContain("queryClient.invalidateQueries();");
  });

  it("renders the goal-driven economics fields + Save", () => {
    expect(content).toContain("Customer Lifetime Revenue");
    expect(content).toContain("Positive reply → meeting");
    expect(content).toContain("Website visit → meeting");
    expect(content).toContain("Website visit → signup");
    expect(content).toContain("Signup → Paid client");
    expect(content).not.toContain("Meeting → close");
    expect(content).not.toContain("Website visit → close");
    expect(content).toContain("Save");
  });

  it("renders Signup → Paid client in the signups-goal conversion set", () => {
    expect(content).toContain('key: "signupToPaidClientPct"');
    expect(content).toContain('label: "Signup → Paid client"');
  });

  it("keeps Customer Lifetime Revenue integer-only (no decimal separator accepted)", () => {
    expect(content).toContain('inputMode="numeric"');
    expect(content).toContain('updateInteger("lifetimeRevenueUsd"');
    expect(content).toContain('normalizeIntegerInput("lifetimeRevenueUsd")');
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
    expect(content).toContain("parseLocaleNumberInput(v)");
    expect(content).toContain("visitToSignupPct: toPctOrDefault(");
    expect(content).toContain('inputMode="decimal"');
  });

  it("shows only the conversion fields relevant to the selected optimization goal", () => {
    expect(content).toContain("visiblePctFields");
    expect(content).toContain("f.goals.includes(form.optimizationGoal)");
    expect(content).toContain('goals: ["sales_meetings"]');
    expect(content).toContain('goals: ["signups"]');
  });

  it("validates the selected goal fields before saving and persists the optimization goal", () => {
    expect(content).toContain("REQUIRED_FIELDS_BY_GOAL");
    expect(content).toContain("setValidationError");
    expect(content).toContain("optimizationGoal: form.optimizationGoal");
    expect(content).not.toContain(deprecatedStageConstant);
    expect(content).not.toContain(`${deprecatedStageField}:`);
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
