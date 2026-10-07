import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("the first-payment email", () => {
  it("is sent once the payment settles, on both payment surfaces", () => {
    for (const f of ["src/components/v2/get-started/account-card-wall.tsx", "src/components/v2/get-started/org-launch.tsx"]) {
      const s = src(f);
      const settled = s.indexOf("setAccount(settled.account);");
      const send = s.indexOf('sendAuthNotification("first_payment")');
      expect(settled).toBeGreaterThan(-1);
      expect(send).toBeGreaterThan(settled);
    }
  });

  it("the signup still sends the short welcome", () => {
    expect(src("src/components/auth-event-tracker.tsx")).toContain('sendAuthNotification("welcome")');
  });
});
