// The welcome-gift amount is pinned at boot by the DASHBOARD's instrumentation, which is
// the single registrar for everything in the shared platform stores. Admin registers nothing,
// so the boot-pin assertions live in apps/dashboard/tests/welcome-gift-pinned.ts. What stays
// here is the rule that no admin surface may edit the amount.
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
