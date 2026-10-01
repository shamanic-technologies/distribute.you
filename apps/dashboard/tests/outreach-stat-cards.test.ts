import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

describe("goal-steps single source", () => {
  it("binds the Form submissions/CPFS outcome for the form_submissions goal", () => {
    // The form_submissions outcome (label + count/cost fields) lives in the
    // goal-steps single source, not a hardcoded branch in a component.
    const steps = read("../src/lib/goal-steps.ts");
    expect(steps).toContain('label: "Form submissions"');
    expect(steps).toContain('countField: "formSubmissionsCount"');
    expect(steps).toContain('costField: "cpfsCents"');
    expect(steps).toContain('costLabel: "CPFS"');
  });
});
