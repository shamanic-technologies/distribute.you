import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiContent = fs.readFileSync(
  path.resolve(__dirname, "../src/lib/api.ts"),
  "utf-8",
);
const componentContent = fs.readFileSync(
  path.resolve(__dirname, "../src/components/admin/welcome-gift-admin.tsx"),
  "utf-8",
);
const homePageContent = fs.readFileSync(
  path.resolve(__dirname, "../src/app/(authed)/(dashboard)/page.tsx"),
  "utf-8",
);

describe("api.ts welcome-promo helpers", () => {
  it("getWelcomePromo GETs /promo-codes/welcome and safeParses the wire shape", () => {
    const fn = apiContent.match(
      /export async function getWelcomePromo[\s\S]*?^}/m,
    );
    expect(fn).toBeTruthy();
    const body = fn![0];
    expect(body).toContain("/promo-codes/welcome");
    expect(body).toContain("WelcomePromoSchema.safeParse");
    // Fail loud on shape mismatch — no silent fallback.
    expect(body).toContain("throw new Error");
  });

  it("setWelcomePromo PATCHes /promo-codes/welcome with { amountCents }", () => {
    const fn = apiContent.match(
      /export async function setWelcomePromo[\s\S]*?^}/m,
    );
    expect(fn).toBeTruthy();
    const body = fn![0];
    expect(body).toContain("/promo-codes/welcome");
    expect(body).toMatch(/method:\s*"PATCH"/);
    expect(body).toContain("body: { amountCents }");
    expect(body).toContain("WelcomePromoSchema.safeParse");
    expect(body).toContain("throw new Error");
  });

  it("WelcomePromoSchema declares amount_cents as the integer-cents wire field", () => {
    expect(apiContent).toMatch(/amount_cents:\s*z\.number\(\)/);
    // No silent defaults on the schema.
    expect(apiContent).not.toMatch(/amount_cents:[^,]*\.default\(/);
  });
});

describe("WelcomeGiftAdmin component", () => {
  it("displays the amount in dollars (amount_cents / 100)", () => {
    expect(componentContent).toContain("/ 100");
  });

  it("converts dollars to non-negative integer cents before PATCH", () => {
    expect(componentContent).toContain("Math.round(parsed * 100)");
    expect(componentContent).toMatch(/parsed\s*<\s*0/);
    expect(componentContent).toContain("Number.isFinite");
  });

  it("writes the saved value back to the cache (not just invalidate)", () => {
    expect(componentContent).toContain("queryClient.setQueryData");
  });

  it("surfaces query and mutation errors — no silent fallback", () => {
    expect(componentContent).toContain("queryErrorMessage");
    expect(componentContent).toContain("mutationErrorMessage");
    expect(componentContent).toContain("text-red-600");
    // No `?? fallback` default-value swallowing on the amount.
    expect(componentContent).not.toMatch(/amountCents\s*\?\?/);
  });

  it("keeps the in-flight Save label full-opacity (gates the fade on !isSaving)", () => {
    expect(componentContent).toMatch(/isSaving\s*\?\s*"cursor-wait"/);
    expect(componentContent).toContain("Saving…");
  });
});

describe("staff home wires the control behind the staff gate", () => {
  it("renders WelcomeGiftAdmin only after the publicMetricsOk redirect", () => {
    expect(homePageContent).toContain("<WelcomeGiftAdmin />");
    const gateIdx = homePageContent.indexOf("if (!publicMetricsOk) redirect");
    const renderIdx = homePageContent.indexOf("<WelcomeGiftAdmin />");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(renderIdx).toBeGreaterThan(gateIdx);
  });
});
