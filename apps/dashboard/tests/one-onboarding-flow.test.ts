import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { funnelKeysFromSelection } from "../src/lib/start-selection-cookie";

// ONE ONBOARDING FLOW. The three sell-first screens (goal, path, results) used
// to be their own route, `/start`, handing off to the wizard through a cookie
// and a full navigation; the owner read the seam as two products ("I want both
// merged into one seamless onboarding flow"). They are the wizard's own first
// steps now, in one shell, on one stepper, with no reload. These pin the join.

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");
const wizard = read("src/components/onboarding/onboarding.tsx");
const picks = read("src/components/start/start-picks.tsx");
const shell = read("src/components/start/start-shell.tsx");

describe("funnelKeysFromSelection", () => {
  it("takes the funnel half of a pair key, deduped, order kept", () => {
    expect(
      funnelKeysFromSelection([
        "sales_meetings_from_conversation::sales-cold-email-outreach",
        "form_magnet::sales-cold-email-outreach",
        "sales_meetings_from_conversation::feedback-request-cold-email-outreach",
      ]),
    ).toEqual(["sales_meetings_from_conversation", "form_magnet"]);
  });

  it("tolerates the older funnel-only shape", () => {
    expect(
      funnelKeysFromSelection([
        "form_magnet",
        "sales_meetings_from_website::sales-cold-email-outreach",
      ]),
    ).toEqual(["form_magnet", "sales_meetings_from_website"]);
  });

  it("drops an entry with no funnel half", () => {
    expect(funnelKeysFromSelection(["::channel", ""])).toEqual([]);
  });
});

describe("/start is the wizard", () => {
  it("redirects to /onboarding with the query, relatively, and hosts no page of its own", () => {
    const route = read("src/app/start/route.ts");
    expect(route).toContain("status: 308");
    expect(route).toContain("Location: `/onboarding${search}`");
    // `request.url` on a self-hosted Next server is the bind address, so an
    // absolute Location built from it points at the container.
    expect(route).not.toContain("NextResponse.redirect(");
    expect(() => read("src/app/start/page.tsx")).toThrow();
    expect(() => read("src/app/start/layout.tsx")).toThrow();
    // The cookie join that let the wizard "continue" from a separate route is
    // gone with the route.
    expect(() => read("src/lib/start-continuation.ts")).toThrow();
    expect(wizard).not.toContain("start-continuation");
  });
});

describe("the sell-first screens are wizard steps", () => {
  it("names them in the step union and appends them to the parse allowlist", () => {
    expect(wizard).toMatch(/type Step =[\s\S]*\| "outcome"\n\s*\| "path"\n\s*\| "returns"/);
    // Appended, never inserted: ALL_STEPS is what an older snapshot parses
    // against, and a bump strands an in-flight checkout.
    expect(wizard).toContain('"built",\n  "outcome", "path", "returns",\n];');
  });

  it("opens a fresh visitor on the welcome, then the picks", () => {
    const init = wizard.slice(
      wizard.indexOf("const [step, setStep] = useState<Step>("),
      wizard.indexOf("const [url, setUrl] = useState("),
    );
    expect(init).toContain('"welcome",\n  );');
    expect(init).not.toContain("continuation");
  });

  it("renders the four screens through StartPicks, controlled by the wizard's own state", () => {
    const at = wizard.indexOf('if (step === "welcome" || step === "outcome" || step === "path" || step === "returns") {');
    expect(at).toBeGreaterThan(-1);
    const render = wizard.slice(at, at + 900);
    expect(render).toContain("<StartPicks");
    expect(render).toContain("outcomes={startOutcomes}");
    expect(render).toContain("funnels={startFunnels}");
    expect(render).toContain("onOutcomesChange={setStartOutcomes}");
    expect(render).toContain("onFunnelsChange={setStartFunnels}");
    expect(render).toContain("onContinue={continueAfterPicks}");
    expect(render).toContain("brandHost={domain}");
    // The picks component owns no state of its own and no navigation.
    expect(picks).not.toContain("useState<string[]>");
    expect(picks).not.toContain("window.location.href");
  });

  it("persists the picks with the snapshot, tolerantly, with no version bump", () => {
    expect(wizard).toContain("startOutcomes?: string[];");
    expect(wizard).toContain("startFunnels?: string[];");
    expect(wizard).toContain("!(p.startOutcomes === undefined || isStringList(p.startOutcomes))");
    expect(wizard).toContain("restored?.startOutcomes ?? []");
    expect(wizard).toContain("restored?.startFunnels ?? []");
    expect(wizard).toContain("const ONBOARDING_STATE_VERSION = 8;");
  });

  it("still writes the selection cookie the proxy and the payment screens read", () => {
    const at = wizard.indexOf("document.cookie = startSelectionCookieAssignment({");
    expect(at).toBeGreaterThan(-1);
    const effect = wizard.slice(at - 200, at + 300);
    expect(effect).toContain('if (flowKey !== "signup") return;');
    expect(effect).toContain("channels: [DEFAULT_CHANNEL_SLUG]");
    expect(effect).toContain("paid: [],");
  });

  it("pre-selects the funnel step from the picks and skips it when they answer it", () => {
    const at = wizard.indexOf("const pickedFunnelKeys = funnelKeysFromSelection(startFunnels)");
    expect(at).toBeGreaterThan(-1);
    const block = wizard.slice(at, at + 900);
    expect(block).toContain(".map((key) => salesFunnelKeyOrNull(key))");
    expect(block).toContain("offeredFunnels.some((f) => f.key === key)");
    expect(block).toContain("const funnelsStepSkipped = pickedFunnelKeys.length > 0;");
    expect(block).toContain("setSelectedFunnelKeys((current) => (current.length > 0 ? current : pickedFunnelKeys));");
    expect(block).not.toContain("normalizeSalesFunnelKey(");
  });

  it("after the results, asks the website only when the landing did not carry one", () => {
    const at = wizard.indexOf("function continueAfterPicks()");
    expect(at).toBeGreaterThan(-1);
    const fn = wizard.slice(at, at + 300);
    expect(fn).toContain("if (!url.trim() || !domain || websiteProblem !== null) {");
    expect(fn).toContain('setStep("url")');
    expect(fn).toContain("void startAnalyze();");
    // The setup runs against the SAME field the landing-url effect fills.
    expect(wizard.indexOf("const landingUrlSeedRef = useRef(false);")).toBeLessThan(at);
  });
});

describe("one shell for the whole flow", () => {
  const stepShell = wizard.slice(wizard.indexOf("function StepShell("), wizard.indexOf("function BackButton("));

  it("every wizard step renders through StartShell, on the flow's one stepper", () => {
    expect(stepShell).toContain("<StartShell");
    expect(stepShell).toContain("stepLabels={START_STEP_LABELS}");
    expect(stepShell).toContain("founders={chrome.founders}");
    expect(stepShell).toContain("cardMaxWidth={maxWidth}");
    // Every call site hands the chrome over; a shell that could show the
    // stepper while no step passes its position is the feature absent.
    const calls = wizard.match(/<StepShell(?=[\s>])/g) ?? [];
    const withChrome = wizard.match(/<StepShell chrome=\{chrome\}/g) ?? [];
    expect(calls.length).toBeGreaterThan(10);
    expect(withChrome.length).toBe(calls.length);
  });

  it("places the build at step 4, the review and the money at step 5, and hides the bar after payment", () => {
    const at = wizard.indexOf("function stepperFor(step: Step)");
    expect(at).toBeGreaterThan(-1);
    const fn = wizard.slice(at, at + 700);
    expect(fn).toContain('case "services":');
    expect(fn).toContain("return { step: 4, count: START_STEP_COUNT };");
    expect(fn).toContain('case "built":');
    expect(fn).toContain('case "pricing":');
    expect(fn).toContain("return { step: 5, count: START_STEP_COUNT };");
    expect(fn).toContain("return { step: 1, count: 1 };");
  });

  it("the bar names the website the wizard holds, not only the landing cookie", () => {
    // The landing cookie is consumed the moment the URL lands in the field, so
    // a bar reading the cookie alone would go blank after the first screen.
    expect(stepShell).toContain("brand={chrome.brandHost ?");
    expect(shell).toContain("const brand = brandOverride === undefined ? landingBrand : brandOverride;");
    expect(picks).toContain("const brand = brandHost ?");
  });

  it("the shell takes an optional title and an optional footer, so a wizard step keeps its own heading", () => {
    expect(shell).toContain("title?: ReactNode;");
    expect(shell).toContain("footer?: ReactNode;");
    expect(shell).toContain("{title !== undefined && (");
    expect(shell).toContain("{footer != null && footer !== false && (");
  });

  it("the onboarding layout is as wide as the shell", () => {
    expect(read("src/app/(authed)/onboarding/layout.tsx")).toContain("max-w-6xl");
  });
});

describe("the public channels reader", () => {
  const api = read("src/lib/api.ts");

  it("reads /api/public/catalogue and parses through the ONE channels schema", () => {
    const at = api.indexOf("export async function getPublicChannelsSignedOut(");
    expect(at).toBeGreaterThan(-1);
    const fn = api.slice(at, at + 1000);
    expect(fn).toContain('fetch("/api/public/catalogue")');
    expect(fn).toContain("PublicChannelsSchema.safeParse(body.channels)");
    expect(fn).not.toContain("apiCall(");
  });
});
