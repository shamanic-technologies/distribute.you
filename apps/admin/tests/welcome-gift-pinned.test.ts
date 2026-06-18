import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiContent = fs.readFileSync(
  path.resolve(__dirname, "../src/lib/api.ts"),
  "utf-8",
);
const homePageContent = fs.readFileSync(
  path.resolve(__dirname, "../src/app/(authed)/(dashboard)/page.tsx"),
  "utf-8",
);
const instrumentationContent = fs.readFileSync(
  path.resolve(__dirname, "../src/instrumentation.ts"),
  "utf-8",
);

describe("welcome gift is not front-end editable", () => {
  it("removed the staff admin component", () => {
    const componentPath = path.resolve(
      __dirname,
      "../src/components/admin/welcome-gift-admin.tsx",
    );
    expect(fs.existsSync(componentPath)).toBe(false);
  });

  it("the staff home no longer renders or imports WelcomeGiftAdmin", () => {
    expect(homePageContent).not.toContain("WelcomeGiftAdmin");
  });

  it("api.ts exposes no read/write helper for the welcome promo", () => {
    expect(apiContent).not.toContain("export async function getWelcomePromo");
    expect(apiContent).not.toContain("export async function setWelcomePromo");
    expect(apiContent).not.toContain("WelcomePromoSchema");
  });
});

describe("welcome gift is pinned at boot by instrumentation", () => {
  it("declares the code-owned grant amount constant", () => {
    expect(instrumentationContent).toMatch(
      /WELCOME_GIFT_CENTS\s*=\s*\d+/,
    );
  });

  it("PATCHes the pinned amount to /v1/promo-codes/welcome on boot", () => {
    expect(instrumentationContent).toContain("/v1/promo-codes/welcome");
    expect(instrumentationContent).toContain(
      "amountCents: WELCOME_GIFT_CENTS",
    );
    // Uses the platform key the other boot deployments use.
    const pinBlock = instrumentationContent.slice(
      instrumentationContent.indexOf("/v1/promo-codes/welcome") - 400,
      instrumentationContent.indexOf("/v1/promo-codes/welcome") + 400,
    );
    expect(pinBlock).toMatch(/method:\s*"PATCH"/);
    expect(pinBlock).toContain('"X-API-Key": apiKey');
  });
});
