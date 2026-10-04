import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The RULE lives in `src/lib/phone-syntax.ts` and has real unit tests of its own
// (`phone-syntax.test.ts`). These pin the CALL SITES: a module perfectly able to
// refuse an impossible number is the feature entirely absent if nothing asks it,
// and a step that blocks Continue is a display decision that a caller posting
// straight at the route goes around. The v1 onboarding phone STEP is deleted; the
// v2 get-started phone stage carries its own guard.

const root = join(__dirname, "..");
const INPUT = readFileSync(join(root, "src/components/onboarding/phone-input.tsx"), "utf8");
const ROUTE = readFileSync(
  join(root, "src/app/(authed)/api/onboarding/phone/route.ts"),
  "utf8",
);

describe("the input renders the sentence it is handed and decides nothing", () => {
  it("carries no rule of its own", () => {
    expect(INPUT).not.toContain("phoneSyntaxProblem");
    expect(INPUT).not.toMatch(/\/\^\[2-9\]/);
  });

  it("marks the field invalid and names the message for a screen reader", () => {
    expect(INPUT).toContain("aria-invalid={problem ? true : undefined}");
    expect(INPUT).toContain('aria-describedby={problem ? "onboarding-phone-problem" : undefined}');
    expect(INPUT).toContain('role="alert"');
  });

  it("colours the message with weights the dark theme remaps", () => {
    // `text-red-600` and `border-red-300` both carry an `html.dark` rule; a
    // weight without one renders near-black on the dark surface.
    expect(INPUT).toContain("text-red-600");
    expect(INPUT).toContain("border-red-300");
  });
});

describe("the route refuses it again", () => {
  it("runs the same check before writing to Clerk", () => {
    expect(ROUTE).toContain('from "@/lib/phone-syntax"');
    const check = ROUTE.indexOf("phoneSyntaxProblem({");
    const write = ROUTE.indexOf("updateUserMetadata");
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(write);
  });

  it("answers 400 with the sentence, not a bare invalid", () => {
    expect(ROUTE).toContain("NextResponse.json({ error: problem }, { status: 400 })");
  });

  it("stores strict E.164 through the shared helper, never a hand-rolled join", () => {
    expect(ROUTE).toContain("toE164({ dialCode: body.dialCode, national })");
  });
});
