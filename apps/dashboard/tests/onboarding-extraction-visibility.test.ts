import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A step that is WAITING on an extraction must say so, and a step whose extraction
 * FAILED must say that instead of rendering its "we drafted these" copy over an
 * empty box. Both were silent: `createBrandAndFetchServices` swallowed the extract
 * failure into `null`, so a new brand landed on the services step with no chips,
 * no spinner and no error — indistinguishable from "your site sells nothing" — and
 * the background hydrate then dropped the real list in ~28s later, under the
 * cursor of whoever had started typing.
 *
 * Same shape one step over: the audience step's ICP seed read `prompt` out of a
 * MOUNT-TIME closure, so its "never clobber what the user edited" guard tested a
 * stale empty string and overwrote live text whenever the prewarm settled late —
 * which is exactly what a failing ICP call makes it do.
 *
 * Source-substring guards: `onboarding.tsx` imports through the `@` alias, which
 * vitest does not resolve in this repo, so these read the source rather than
 * calling in. Every slice length below is MEASURED, not guessed.
 */

const SRC = readFileSync(
  join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf8",
);

function sliceFrom(marker: string, len: number): string {
  const at = SRC.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return SRC.slice(at, at + len);
}

describe("services extraction is visible while it runs and when it fails", () => {
  it("tracks the extract failure and the hydrate window as state", () => {
    expect(SRC).toContain("const [servicesExtractFailed, setServicesExtractFailed] = useState(false)");
    expect(SRC).toContain("const [servicesHydrating, setServicesHydrating] = useState(false)");
  });

  it("records the loading-screen extract outcome instead of only logging it", () => {
    // The `.catch(() => null)` stays (a failed extract must not strand a paid
    // signup on the loading screen) but the outcome now reaches the UI.
    expect(SRC).toContain("setServicesExtractFailed(!serviceFields)");
  });

  it("marks the hydrate window so the step can render a pending state", () => {
    expect(SRC).toContain("setServicesHydrating(true)");
    expect(SRC).toContain("setServicesHydrating(false)");
  });

  it("never lets a late hydrate replace a list that already has entries", () => {
    // Both writers go through the same functional guard: `servicesEditedRef` covers
    // a list the user curated, `prev.length` covers one already filled by the
    // sibling writer — a hydrate landing after the loading-screen extract already
    // succeeded must not swap the list out from under the step.
    const hydrateWrite = sliceFrom("if (!servicesEditedRef.current && nextServices.length > 0) setServices(", 140);
    expect(hydrateWrite).toContain("prev.length ? prev : nextServices");
  });

  it("states the pending and failed cases on the services step", () => {
    // JSX entity form — the apostrophe in the rendered copy is `&apos;` in source.
    expect(SRC).toContain("Still reading");
    expect(SRC).toContain("We couldn&apos;t read your site");
    expect(SRC).toContain("retryServicesExtract");
  });

  it("does not claim it drafted a list it failed to fetch", () => {
    // The "We drafted these from <host>" line is a claim about a successful
    // extraction, so it is gated on there being something to show. The gate sits
    // BEFORE the copy, so slice from the gate forward — measured at 70 chars to the
    // copy, so 200 covers the ternary's first branch and stops well short of the
    // `: (` alternative.
    const gated = sliceFrom("{servicesDrafted ?", 200);
    expect(gated).toContain("We drafted these from");
  });
});

describe("audience seed reads live state, not a mount-time closure", () => {
  it("mirrors the prompt into a ref so the guard tests the current value", () => {
    expect(SRC).toContain("const promptRef = useRef(prompt)");
    expect(SRC).toContain("promptRef.current = prompt");
    expect(SRC).toContain("const fallbackPromptRef = useRef(fallbackPrompt)");
    expect(SRC).toContain("fallbackPromptRef.current = fallbackPrompt");
  });

  it("no longer guards the seed on the captured prompt", () => {
    // The stale form. `prompt.trim() ? prompt : …` inside the effect reads the
    // render the effect was created in, so it clobbers a live edit.
    expect(SRC).not.toContain("onPromptChange(prompt.trim() ? prompt");
  });

  it("auto-fires the suggest when the prewarm produced no candidates", () => {
    // A dead prewarm used to leave the step looking like it merely wanted a
    // click. The non-prefetch branch already self-fired; both do now — measured
    // at 1198 chars from the anchor to the fire, so 1600 carries it with room for
    // the explanatory comments without reaching the `if (!brandId)` branch below.
    const adopt = sliceFrom("prefetch.promise", 1600);
    expect(adopt).toContain("void runSuggest(seeded)");
    // `loading` is handed to runSuggest rather than cleared under it: a shared
    // `finally` would drop the button to its idle label for the whole call it
    // just started, leaving it clickable and re-firable.
    expect(adopt).not.toContain("setIcpLoading(false);\n          setLoading(false);");
  });

  it("labels a fallback prompt as a fallback rather than a drafted ICP", () => {
    expect(SRC).toContain("const [icpFallback, setIcpFallback] = useState(false)");
    expect(SRC).toContain("setIcpFallback(true)");
    expect(SRC).toContain("couldn&apos;t read enough from");
  });
});
