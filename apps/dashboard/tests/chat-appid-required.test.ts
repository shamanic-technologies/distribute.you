import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test for https://github.com/shamanic-technologies/mcpfactory/issues/190
 *
 * chat-service POST /chat requires `appId` in the request body.
 * Without it, the request fails with a 400 validation error.
 */
describe("chat-service appId requirement", () => {
  const useChatPath = path.join(
    __dirname,
    "../src/components/chat/use-chat.ts"
  );

  it("should include appId: 'mcpfactory' in the POST /chat request body", () => {
    const content = fs.readFileSync(useChatPath, "utf-8");

    // The file must contain appId in the body sent to /chat
    expect(content).toContain('appId: "mcpfactory"');
  });
});
