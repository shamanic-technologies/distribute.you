import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: all chat components must persist messages continuously
 * (debounced), not only in onFinish.
 *
 * Previously, messages were only saved to localStorage in the onFinish callback.
 * If the useChat `id` changed (e.g. during a workflow fork/upgrade) before
 * onFinish fired, the in-memory messages were lost. The fix adds a debounced
 * useEffect that saves messages on every change.
 */

const chatComponents = [
  {
    name: "workflow-chat",
    file: "../src/components/workflows/workflow-chat.tsx",
  },
  {
    name: "feature-creator-chat",
    file: "../src/components/features/feature-creator-chat.tsx",
  },
  {
    name: "campaign-prefill-chat",
    file: "../src/components/campaigns/campaign-prefill-chat.tsx",
  },
  {
    name: "press-kit-chat",
    file: "../src/components/press-kits/press-kit-chat.tsx",
  },
];

for (const { name, file } of chatComponents) {
  describe(`${name} — continuous message persistence`, () => {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, "utf-8");

    it("should have a debounced save effect that watches messages", () => {
      // Must have a saveTimerRef for debouncing
      expect(content).toContain("saveTimerRef");
      // Must call saveMessages inside a setTimeout (debounced)
      expect(content).toContain("setTimeout(() =>");
      expect(content).toContain("saveMessages(");
    });

    it("should still save in onFinish as an immediate flush", () => {
      // onFinish should still call saveMessages for immediate persistence
      expect(content).toContain("onFinish:");
      expect(content).toContain("saveMessages(");
    });

    it("should flush messages on unmount via a ref (not stale closure)", () => {
      // Must use a ref to hold latest messages so the unmount effect
      // saves current data, not a stale first-render snapshot
      expect(content).toContain("latestRef");
      expect(content).toContain("latestRef.current =");
      // The unmount-only effect must have an empty dependency array
      expect(content).toContain("}, []);");
    });
  });
}
