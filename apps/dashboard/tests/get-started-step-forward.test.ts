import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("../src/components/v2/get-started/get-started.tsx", import.meta.url), "utf8");
const journal = readFileSync(new URL("../src/components/v2/get-started/journal.tsx", import.meta.url), "utf8");

describe("/get-started: a step opened to look back has a way forward (owner 2026-10-12)", () => {
  it("the stage provides Next whenever a finished step is focused", () => {
    expect(src).toContain("<NextContext.Provider value={focus ? () => goForward(focus) : null}>");
  });

  it("the stepper's marks only show where the walk is: moving is Back and Continue (owner 2026-10-24)", () => {
    const at = src.indexOf("function Stepper(");
    const body = src.slice(at, src.indexOf("function StepMark(", at));
    expect(body).not.toContain("<button");
    expect(body).not.toContain("onClick");
    expect(src).not.toContain("Back to the live step");
  });

  it("Next goes to the following step, or back to the live one", () => {
    const at = src.indexOf("function goForward(");
    const body = src.slice(at, src.indexOf("function openStep(", at));
    expect(body).toContain("next >= stageIdx ? null : GET_STARTED_STEPS[next].key");
  });

  it("every step card draws Next when it has no Continue of its own", () => {
    const at = src.indexOf("function StepCard(");
    const body = src.slice(at, src.indexOf("function NextButton(", at));
    expect(body).toContain("useContext(NextContext)");
    expect(body).toContain("footer ?? (onNext && <NextButton onNext={onNext} />)");
    // Companies and Emails draw their own sections: both carry Next too.
    expect(src.match(/onNext && \(\s*<div className="ml-auto">\s*<NextButton onNext=\{onNext\} \/>/g)?.length).toBe(2);
  });
});

describe("/get-started rail: competitors open in a new tab", () => {
  it("links each competitor with a domain to its site", () => {
    expect(journal).toContain("href={`https://${c.domain}`}");
    expect(journal).toContain('target="_blank"');
    expect(journal).toContain('rel="noopener noreferrer"');
  });
});
