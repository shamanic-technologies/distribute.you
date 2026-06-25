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

describe("edit-with-ai-chat — context must use ref to avoid stale closure", () => {
  const filePath = path.join(__dirname, "../src/components/ai-edit/edit-with-ai-chat.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("should store request context in a ref", () => {
    expect(content).toContain("const contextRef = useRef(requestContext)");
    expect(content).toContain("contextRef.current = requestContext");
  });

  it("should use contextRef.current inside prepareSendMessagesRequest", () => {
    expect(content).toContain("context: contextRef.current");
  });

  it("should NOT close over brandId directly in transport deps", () => {
    const transportBlock = content.match(
      /const transport = useMemo\([\s\S]*?\[([^\]]*)\]/
    );
    expect(transportBlock).toBeTruthy();
    const deps = transportBlock![1];
    expect(deps).not.toContain("brandId");
  });
});
