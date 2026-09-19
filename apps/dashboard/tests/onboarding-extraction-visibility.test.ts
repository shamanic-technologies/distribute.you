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

describe("the services are read on the loading screen, and the services step never waits", () => {
  function fn(name: string): string {
    const at = SRC.indexOf(`async function ${name}(`);
    expect(at, `function not found: ${name}`).toBeGreaterThan(-1);
    const next = SRC.indexOf("\n  async function ", at + 1);
    const nextSync = SRC.indexOf("\n  function ", at + 1);
    const stop = [next, nextSync].filter((i) => i > -1).sort((a, b) => a - b)[0] ?? SRC.length;
    return SRC.slice(at, stop);
  }

  it("tracks the extract failure as state, and has no hydrating state to wait on", () => {
    expect(SRC).toContain("const [servicesExtractFailed, setServicesExtractFailed] = useState(false)");
    expect(SRC).not.toContain("servicesHydrating");
    expect(SRC).not.toContain("servicesPending");
  });

  it("walks the whole site when the landing page yields no services, before the loading screen ends", () => {
    const create = fn("createBrandAndFetchServices");
    const landing = create.indexOf('extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { urlStrategy: "landing", mode: "suggest" })');
    const mapped = create.indexOf('extractBrandFields([newBrandId], SERVICES_PROFILE_FIELDS, { urlStrategy: "url_map", mode: "suggest" })');
    const done = create.indexOf("fetchDoneRef.current = true;");
    expect(landing).toBeGreaterThan(-1);
    expect(mapped).toBeGreaterThan(landing);
    expect(done).toBeGreaterThan(mapped);
    // The second read is gated on the first producing NOTHING, and both are awaited.
    expect(create).toContain("if (extractedServices.length === 0) {");
    expect(create).toContain("const mappedFields = await extractBrandFields");
  });

  it("records the outcome off the LIST, not off the response object", () => {
    // A 200 carrying no services is a failure to read the site, the same as a throw.
    const create = fn("createBrandAndFetchServices");
    expect(create).toContain("setServicesExtractFailed(extractedServices.length === 0)");
    expect(create).not.toContain("setServicesExtractFailed(!serviceFields)");
    const noSite = fn("createBrandNoWebsiteAndFetchServices");
    expect(noSite).toContain("setServicesExtractFailed(extractedServices.length === 0)");
  });

  it("the background hydrate never writes the services list", () => {
    const hydrate = fn("hydrateOnboardingInBackground");
    expect(hydrate).not.toContain("setServices(");
    expect(hydrate).not.toContain("applyExtractedServices(");
  });

  it("every extraction writes the list through the one guarded applier", () => {
    expect(fn("createBrandAndFetchServices")).toContain("applyExtractedServices(extractedServices)");
    expect(fn("createBrandNoWebsiteAndFetchServices")).toContain("applyExtractedServices(extractedServices)");
    expect(fn("retryServicesExtract")).toContain("applyExtractedServices(next)");
    const apply = SRC.slice(SRC.indexOf("function applyExtractedServices("), SRC.indexOf("async function hydrateOnboardingInBackground("));
    expect(apply).toContain("prev.length ? prev : nextServices");
    expect(apply).toContain("servicesEditedRef.current");
  });

  it("states only the failed case on the services step, with a retry", () => {
    expect(SRC).not.toContain("Still reading");
    // JSX entity form — the apostrophe in the rendered copy is `&apos;` in source.
    expect(SRC).toContain("We couldn&apos;t read your site");
    expect(SRC).toContain("retryServicesExtract");
    expect(SRC).toContain("const servicesUnread = !servicesDrafted && servicesExtractFailed;");
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
  });

  it("no longer guards the seed on the captured prompt", () => {
    // The stale form. `prompt.trim() ? prompt : …` inside the effect reads the
    // render the effect was created in, so it clobbers a live edit.
    expect(SRC).not.toContain("onPromptChange(prompt.trim() ? prompt");
    expect(SRC).toContain("if (!promptRef.current.trim() && drafted) onPromptChange(drafted);");
  });

  it("adopts the prewarm's ICP draft and fires no suggest", () => {
    // The audience step is one target-audience box now; the audiences are built
    // by hand after payment, so nothing is searched from here.
    const adopt = SRC.slice(SRC.indexOf("prefetch.promise"), SRC.indexOf("if (!brandId) {", SRC.indexOf("prefetch.promise")));
    expect(adopt).toContain("adopt(p, icpFailed)");
    expect(adopt).not.toContain("runSuggest");
  });

  it("labels a fallback prompt as a fallback rather than a drafted ICP", () => {
    expect(SRC).toContain("const [icpFallback, setIcpFallback] = useState(false)");
    expect(SRC).toContain("setIcpFallback(true)");
    expect(SRC).toContain("couldn&apos;t read enough from");
  });
});
