import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: chat transport must use a ref for context, not a direct closure.
 *
 * The Vercel AI SDK's useChat hook stores the Chat instance in a useRef and only
 * recreates it when the chat id changes — NOT when the transport changes. If the
 * transport's prepareSendMessagesRequest closure captures the context value directly,
 * the Chat instance keeps the stale initial transport and sends empty context forever.
 *
 * Fix: store context in a ref and read contextRef.current inside prepareSendMessagesRequest.
 */

const chatComponents = [
  {
    name: "feature-creator-chat",
    file: "../src/components/features/feature-creator-chat.tsx",
    contextProp: "featureContext",
  },
  {
    name: "workflow-chat",
    file: "../src/components/workflows/workflow-chat.tsx",
    contextProp: "workflowContext",
  },
  {
    name: "press-kit-chat",
    file: "../src/components/press-kits/press-kit-chat.tsx",
    contextProp: "pressKitContext",
  },
];

for (const { name, file, contextProp } of chatComponents) {
  describe(`${name} — context must use ref to avoid stale closure`, () => {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, "utf-8");

    it("should store context in a ref (contextRef)", () => {
      expect(content).toContain(`const contextRef = useRef(${contextProp})`);
      expect(content).toContain("contextRef.current =");
    });

    it("should use contextRef.current inside prepareSendMessagesRequest", () => {
      expect(content).toContain("context: contextRef.current");
    });

    it("should NOT close over context value directly in transport useMemo", () => {
      // The useMemo deps should not include the context prop
      const transportBlock = content.match(
        /const transport = useMemo\([\s\S]*?\[([^\]]*)\]/
      );
      expect(transportBlock).toBeTruthy();
      const deps = transportBlock![1];
      expect(deps).not.toContain(contextProp);
    });
  });
}
