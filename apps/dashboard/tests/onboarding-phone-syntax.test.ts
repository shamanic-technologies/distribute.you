import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The RULE lives in `src/lib/phone-syntax.ts` and has real unit tests of its own
// (`phone-syntax.test.ts`). These pin the CALL SITES: a module perfectly able to
// refuse an impossible number is the feature entirely absent if the step never
// asks it, and a step that blocks Continue is a display decision that a caller
// posting straight at the route goes around.

const root = join(__dirname, "..");
const STEP = readFileSync(join(root, "src/components/onboarding/onboarding.tsx"), "utf8");
const INPUT = readFileSync(join(root, "src/components/onboarding/phone-input.tsx"), "utf8");
const ROUTE = readFileSync(
  join(root, "src/app/(authed)/api/onboarding/phone/route.ts"),
  "utf8",
);

describe("the onboarding step refuses a number that cannot be a number", () => {
  it("asks the shared module, rather than carrying a rule of its own", () => {
    expect(STEP).toContain('from "@/lib/phone-syntax"');
    expect(STEP).toContain("phoneSyntaxProblem({ dialCode: phone.dialCode, national: phone.national })");
  });

  it("declares the problem ABOVE the handler that reads it", () => {
    // An index compare, not a substring: declaration ORDER is the whole point
    // and a `const` read by a consumer declared earlier throws at render time,
    // which `tsc` cannot see.
    const decl = STEP.indexOf("const phoneProblem = phoneSyntaxProblem(");
    const consumer = STEP.indexOf("async function savePhoneAndContinue()");
    expect(decl).toBeGreaterThan(-1);
    expect(consumer).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(consumer);
  });

  it("does not advance while the number is impossible", () => {
    const at = STEP.indexOf("async function savePhoneAndContinue()");
    const body = STEP.slice(at, STEP.indexOf("setStep(\"funnelStats\");", at));
    expect(body).toContain("if (phoneProblem)");
    expect(body).toContain("setPhoneProblemRevealed(true)");
    expect(body).toContain("return;");
  });

  it("greys Continue only while the reason is on screen", () => {
    // A greyed primary button with no reason beside it reads as a dead control,
    // so the disabled state is gated on the message being revealed.
    expect(STEP).toContain("disabled={phoneProblemRevealed && phoneProblem !== null}");
  });

  it("reveals the problem on blur and hides it again on the next keystroke", () => {
    expect(STEP).toContain("onBlur={() => setPhoneProblemRevealed(true)}");
    expect(STEP).toContain("problem={phoneProblemRevealed ? phoneProblem : null}");
  });
});

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
