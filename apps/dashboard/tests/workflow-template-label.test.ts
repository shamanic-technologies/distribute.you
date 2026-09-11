/**
 * The prompt-template label — real unit tests, because
 * `lib/workflow-template-label.ts` is alias-free (it imports nothing at all). Keep it
 * that way: a runtime `@/…` import there turns these into resolution failures.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { workflowTemplateLabel } from "../src/lib/workflow-template-label";

describe("workflowTemplateLabel", () => {
  it("drops the trailing version and title-cases the words", () => {
    expect(workflowTemplateLabel("blind-discovery-email-v26")).toEqual({
      id: "blind-discovery-email-v26",
      label: "Blind Discovery Email",
    });
  });

  it("keeps the id VERBATIM, version included — it is what tells two apart", () => {
    const a = workflowTemplateLabel("cold-email-v39");
    const b = workflowTemplateLabel("cold-email-v40");
    expect(a!.label).toBe(b!.label);
    expect(a!.id).not.toBe(b!.id);
  });

  it("reads an underscore version marker too", () => {
    expect(workflowTemplateLabel("cold_email_v2")!.label).toBe("Cold Email");
  });

  it("does NOT strip a version that is not at the end", () => {
    // `v2` here is a word in the middle of the name, not the template's version.
    expect(workflowTemplateLabel("v2-cold-email")!.label).toBe("V2 Cold Email");
  });

  it("leaves an ALL-CAPS token alone rather than inventing a spelling", () => {
    expect(workflowTemplateLabel("CTA-first-email-v3")!.label).toBe("CTA First Email");
  });

  it("normalises case in both directions", () => {
    expect(workflowTemplateLabel("COLD.email-v1")!.label).toBe("COLD Email");
    expect(workflowTemplateLabel("Cold Email")!.label).toBe("Cold Email");
  });

  it("answers NULL for a workflow that states no template", () => {
    expect(workflowTemplateLabel(null)).toBeNull();
    expect(workflowTemplateLabel(undefined)).toBeNull();
    expect(workflowTemplateLabel("   ")).toBeNull();
  });

  it("keeps the id as the label when the strip leaves nothing", () => {
    // "we could not name this" must never render blank.
    expect(workflowTemplateLabel("v9")).toEqual({ id: "v9", label: "V9" });
    expect(workflowTemplateLabel("-v9")).toEqual({ id: "-v9", label: "-v9" });
  });
});

describe("the module stays alias-free", () => {
  it("carries no runtime `@/` import", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/lib/workflow-template-label.ts"),
      "utf-8",
    );
    expect(/^import\s+(?!type\b)[^;]*from\s+"@\//m.test(src)).toBe(false);
  });
});
