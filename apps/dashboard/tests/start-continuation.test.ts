import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { landingUrlCookieString } from "../src/lib/landing-url-cookie";
import {
  funnelKeysFromSelection,
  startContinuation,
} from "../src/lib/start-continuation";
import {
  encodeStartSelection,
  START_SELECTION_COOKIE,
} from "../src/lib/start-selection-cookie";

// Arriving from /start CONTINUES the wizard. It used to open on the welcome
// pitch and ask for the website again, and the owner read that as being sent
// back to the beginning. These are real unit tests on the join of the two
// cookies, then call-site pins on the wizard and the button that leads into it.

const picks = (funnels: string[]) =>
  `${START_SELECTION_COOKIE}=${encodeStartSelection({
    outcomes: ["meeting_booked"],
    channels: ["sales-cold-email-outreach"],
    funnels,
    paid: [],
  })}`;

const landing = (url: string) => {
  const assignment = landingUrlCookieString(url);
  if (!assignment) throw new Error(`test setup: ${url} is not a website`);
  return assignment.split(";")[0];
};

describe("startContinuation", () => {
  it("joins the picks and the landing website into one continuation", () => {
    const c = startContinuation(
      `${picks(["sales_meetings_from_conversation::sales-cold-email-outreach"])}; ${landing("https://linear.app")}`,
    );
    expect(c).toEqual({
      website: "https://linear.app/",
      funnelKeys: ["sales_meetings_from_conversation"],
    });
  });

  it("is null with no picks: an empty selection is somebody who answered nothing", () => {
    expect(startContinuation(landing("https://linear.app"))).toBeNull();
    expect(startContinuation(picks([]))).toBeNull();
    expect(startContinuation("")).toBeNull();
    expect(startContinuation(null)).toBeNull();
  });

  it("continues WITHOUT a website when the landing carried none: the website is asked, the pitch is not", () => {
    const c = startContinuation(picks(["form_magnet::sales-cold-email-outreach"]));
    expect(c).toEqual({ website: null, funnelKeys: ["form_magnet"] });
  });

  it("refuses a malformed or foreign-version selection rather than half-reading it", () => {
    expect(startContinuation(`${START_SELECTION_COOKIE}=%7B%22v%22%3A99%2C%22f%22%3A%5B%22x%22%5D%7D`)).toBeNull();
    expect(startContinuation(`${START_SELECTION_COOKIE}=not-json`)).toBeNull();
  });

  it("never expires the landing cookie: that is the wizard's own job", () => {
    const src = readFileSync(join(__dirname, "../src/lib/start-continuation.ts"), "utf8");
    expect(src).not.toContain("clearLandingUrlCookieString");
    expect(src).not.toContain("clearStartSelectionCookieAssignment");
    expect(src).not.toMatch(/document\.cookie\s*=/);
  });
});

describe("funnelKeysFromSelection", () => {
  it("takes the funnel half of a pair key and keeps a bare funnel key", () => {
    expect(
      funnelKeysFromSelection([
        "sales_meetings_from_conversation::sales-cold-email-outreach",
        "form_magnet",
      ]),
    ).toEqual(["sales_meetings_from_conversation", "form_magnet"]);
  });

  it("dedupes a funnel picked through two channels, order kept", () => {
    expect(
      funnelKeysFromSelection([
        "form_magnet::a",
        "sales_meetings_from_website::b",
        "form_magnet::c",
      ]),
    ).toEqual(["form_magnet", "sales_meetings_from_website"]);
  });

  it("drops an empty funnel half", () => {
    expect(funnelKeysFromSelection(["::channel", ""])).toEqual([]);
  });
});

describe("salesFunnelKeyOrNull", () => {
  // Source-pinned: `sales-funnels.ts` carries a runtime `@/lib/api` type import
  // and vitest does not resolve the alias.
  const src = readFileSync(join(__dirname, "../src/lib/sales-funnels.ts"), "utf8");

  it("is the tolerant twin of the throwing collapse, and says why", () => {
    expect(src).toContain("export function salesFunnelKeyOrNull(key: string): SalesFunnelKey | null {");
    const body = src.slice(src.indexOf("export function salesFunnelKeyOrNull("));
    expect(body.slice(0, 400)).toContain("normalizeSalesFunnelKey(key as SalesFunnelKeyWire)");
    expect(body.slice(0, 400)).toContain("return null;");
  });
});

describe("the wizard continues from /start", () => {
  const wizard = readFileSync(
    join(__dirname, "../src/components/onboarding/onboarding.tsx"),
    "utf8",
  );

  it("reads the continuation ONCE, on the first render, like the snapshot", () => {
    expect(wizard).toContain('import { startContinuation, type StartContinuation } from "@/lib/start-continuation";');
    expect(wizard).toMatch(/continuationRef\.current =\s+typeof document === "undefined" \? null : startContinuation\(document\.cookie\)/);
    expect(wizard).toContain("startContinuation(document.cookie)");
    // Decided on render 1, never in an effect: an effect flashes the welcome pitch first.
    const decl = wizard.indexOf("const continuation = continuationRef.current;");
    const initialStep = wizard.indexOf("const [step, setStep] = useState<Step>(");
    expect(decl).toBeGreaterThan(-1);
    expect(decl).toBeLessThan(initialStep);
  });

  it("opens on the loading screen with a website, on the URL step without one, and never on welcome", () => {
    const init = wizard.slice(
      wizard.indexOf("const [step, setStep] = useState<Step>("),
      wizard.indexOf("const [url, setUrl] = useState("),
    );
    expect(init).toContain("continuation\n            ? continuation.website\n              ? \"loading\"\n              : \"url\"\n            : \"welcome\"");
  });

  it("starts the setup itself when it opened on loading, once, and falls to URL on a refused website", () => {
    const at = wizard.indexOf("const continuationStartedRef = useRef(false);");
    expect(at).toBeGreaterThan(-1);
    const effect = wizard.slice(at, wizard.indexOf("const continuationFunnelsSeededRef"));
    // The gate is a render-1 LATCH, never a live read of `restored`: that ref
    // re-reads sessionStorage every render and the persist effect fills it
    // after render 1, so a live read closed the gate before the setup ran.
    expect(effect).toContain('if (!continuationOpensLoading || step !== "loading") return;');
    expect(effect).not.toContain("if (restored ||");
    const latch = wizard.slice(
      wizard.indexOf("const continuationOpensLoadingRef = useRef<boolean | undefined>(undefined);"),
      wizard.indexOf("const continuationOpensLoading = continuationOpensLoadingRef.current;"),
    );
    expect(latch).toContain("!restored && !resumeBrandIdParam && !fromAdd && continuation?.website != null");
    expect(wizard.indexOf("const continuationOpensLoading = ")).toBeLessThan(at);
    expect(effect).toContain("continuationStartedRef.current = true;");
    expect(effect).toContain("if (!domain || websiteProblem !== null) {\n      setStep(\"url\");");
    expect(effect).toContain("void startAnalyze();");
    // The setup runs against the SAME field the landing-url effect fills, so the
    // start effect is declared after that seeding effect.
    expect(wizard.indexOf("const landingUrlSeedRef = useRef(false);")).toBeLessThan(at);
  });

  it("seeds the picked funnels through the tolerant collapse, against the offered set, without overriding a pick", () => {
    const at = wizard.indexOf("const continuationFunnelsSeededRef = useRef(false);");
    expect(at).toBeGreaterThan(-1);
    const effect = wizard.slice(at, at + 1400);
    expect(effect).toContain(".map((key) => salesFunnelKeyOrNull(key))");
    expect(effect).toContain("offered.has(key)");
    expect(effect).toContain("setSelectedFunnelKeys((current) => (current.length > 0 ? current : picked));");
    expect(effect).not.toContain("normalizeSalesFunnelKey(");
  });

  it("reads the channels' terms through the PUBLIC route: the wizard runs signed out", () => {
    const at = wizard.indexOf("const [channelMinimums, setChannelMinimums]");
    const effect = wizard.slice(at, at + 900);
    expect(effect).toContain("getPublicChannelsSignedOut()");
    expect(effect).not.toContain("getPublicChannels()");
  });
});

describe("the public channels reader", () => {
  const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");

  it("reads /api/public/catalogue and parses through the ONE channels schema", () => {
    const at = api.indexOf("export async function getPublicChannelsSignedOut(");
    expect(at).toBeGreaterThan(-1);
    const fn = api.slice(at, at + 1000);
    expect(fn).toContain('fetch("/api/public/catalogue")');
    expect(fn).toContain("PublicChannelsSchema.safeParse(body.channels)");
    expect(fn).not.toContain("apiCall(");
  });
});
