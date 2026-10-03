import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { BRAND_WHY } from "../src/lib/brand-why";
import { EMAIL_TEMPLATES } from "../src/instrumentation";

// Owner 2026-10-03: the why is ONE frozen sentence on every customer surface.
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

describe("the why: Revenue made easy.", () => {
  it("is the exact frozen sentence", () => {
    expect(BRAND_WHY).toBe("Revenue made easy.");
  });

  // Each surface renders the constant (never a retyped copy that could drift).
  const surfaces: [string, string][] = [
    ["get-started first screen (Hero)", "src/components/v2/get-started/get-started.tsx"],
    ["get-started last screen (wall)", "src/components/v2/get-started/account-card-wall.tsx"],
    ["v1 onboarding first screen (welcome)", "src/components/start/start-picks.tsx"],
    ["v1 onboarding confirmation (celebrate)", "src/components/onboarding/onboarding.tsx"],
    ["v2 shell sidebar", "src/components/v2/v2-shell.tsx"],
  ];
  for (const [label, file] of surfaces) {
    it(`renders on the ${label}`, () => {
      expect(read(file)).toContain("{BRAND_WHY}");
    });
  }

  it("sits on the Hero beside the step's own title, not instead of it", () => {
    const src = read("src/components/v2/get-started/get-started.tsx");
    const hero = src.slice(src.indexOf("function Hero("), src.indexOf("function Hero(") + 1200);
    expect(hero).toContain("{BRAND_WHY}");
    expect(hero).toContain("See who we would sell to for you.");
  });

  it("sits on the celebrate step beside its title", () => {
    const src = read("src/components/onboarding/onboarding.tsx");
    const at = src.indexOf('if (step === "celebrate")');
    const block = src.slice(at, src.indexOf('if (step === "phone")', at));
    expect(block).toContain("{BRAND_WHY}");
    expect(block).toContain("You're in. Welcome aboard.");
  });

  it("closes every customer email, HTML and plain text; staff/admin mails skip it", () => {
    const internal = new Set(["signup_notification", "signin_notification", "user_active", "staff-daily-digest"]);
    const customer = EMAIL_TEMPLATES.filter((t) => !internal.has(t.name) && t.htmlBody.includes("<!DOCTYPE html>"));
    expect(customer.length).toBe(13);
    for (const t of customer) {
      expect(t.htmlBody, t.name).toContain(BRAND_WHY);
      expect(t.textBody, t.name).toContain(BRAND_WHY);
    }
  });
});
