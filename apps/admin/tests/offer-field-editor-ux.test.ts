import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Both apps ship a twin of this file. The dashboard's Strategy page and the admin
// console's brand Settings render the same two editors, so an affordance fixed in one
// and not the other is how two surfaces start disagreeing about how editing works.
const APPS = ["dashboard", "admin"] as const;

const editor = (app: string) =>
  readFileSync(
    join(__dirname, "..", "..", app, "src/components/brand-profile/field-editor.tsx"),
    "utf8",
  );

describe.each(APPS)("field editor (%s) — hover reveals, click edits", (app) => {
  const src = editor(app);

  it("only shows the pencil on hover", () => {
    // A pencil printed permanently beside every value reads as a control you must
    // find and press, which is the opposite of what an inline editor is for.
    expect(src).toContain("opacity-0 group-hover:opacity-100");
    expect(src).not.toContain("text-gray-300 group-hover:text-gray-500");
  });

  it("has no visible Edit or Done button on the list editor", () => {
    // The old two-mode list forced Edit -> find a 12px x -> Done to delete one entry.
    // Scoped to the component body: the doc comment above it names both words while
    // explaining why they are gone, and a file-wide guard would fire on that.
    const listEditor = src.slice(src.indexOf("export function ListEditor"));
    expect(listEditor).not.toMatch(/>\s*Done\s*</);
    expect(listEditor).not.toMatch(/>\s*Edit\s*</);
    // The read/edit toggle and the "+N more" preview went with it.
    expect(listEditor).not.toContain("setExpanded");
    expect(listEditor).not.toContain("hiddenCount");
  });

  it("grows the textarea from measured content, not from hard newlines", () => {
    // `rows={value.split("\n").length}` counted hard newlines only, so a paragraph
    // that wraps over four visual lines but contains no \n opened at two rows.
    expect(src).not.toContain('rows={Math.max(2, value.split("\\n").length)}');
    expect(src).toContain("el.scrollHeight");
    expect(src).toContain("MAX_TEXTAREA_HEIGHT_PX");
    // Reset to auto first, or scrollHeight reports the previous height and the box
    // can only ever grow.
    expect(src).toContain('el.style.height = "auto"');
  });
});

describe.each(APPS)("field editor (%s) — chips are deletable from the keyboard", (app) => {
  const src = editor(app);
  const listEditor = src.slice(src.indexOf("export function ListEditor"));

  it("removes a focused chip on Backspace or Delete", () => {
    expect(listEditor).toContain('e.key === "Backspace" || e.key === "Delete"');
  });

  it("moves between chips with the arrow keys, Home and End", () => {
    expect(listEditor).toContain('e.key === "ArrowLeft"');
    expect(listEditor).toContain('e.key === "ArrowRight"');
    expect(listEditor).toContain('e.key === "Home"');
    expect(listEditor).toContain('e.key === "End"');
  });

  it("gives the chip group ONE tab stop, not one per chip", () => {
    // Roving tabindex: tabbing through seven services one at a time is not editing.
    expect(listEditor).toContain("tabIndex={(activeChip ?? 0) === index ? 0 : -1}");
    // The x stays for the mouse but is out of the sequence, or every stop doubles.
    expect(listEditor).toContain("tabIndex={-1}");
  });

  it("Backspace in an EMPTY add field FOCUSES the last chip instead of deleting it", () => {
    // The two-step is what stops a stray keypress silently destroying an entry.
    // Gmail and Angular Material both do this; a one-step delete does not.
    const at = listEditor.indexOf('e.key === "Backspace" && draft.length === 0');
    expect(at).toBeGreaterThan(-1);
    // 261 chars from this marker to the end of the focusChip call — measured, not
    // guessed. Do not shrink it; a short slice cuts the target out and reads as
    // "the code is missing" for code that is right there.
    const branch = listEditor.slice(at, at + 300);
    expect(branch).toContain("focusChip(values.length - 1)");
    expect(branch).not.toContain("removeAt");
  });

  it("lands focus on a neighbour after a removal, or on the add field when none remain", () => {
    const at = listEditor.indexOf("const removeAt");
    expect(at).toBeGreaterThan(-1);
    // Measured to the end of the function body (188 chars) — a longer slice runs into
    // the next function's comment and a shorter one cuts the assertion's target out.
    const body = listEditor.slice(at, at + 320);
    expect(body).toContain('values.length <= 1 ? "input"');
    expect(body).toContain("Math.min(index, values.length - 2)");
  });
});
