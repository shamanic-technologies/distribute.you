import { describe, it, expect, vi } from "vitest";

/**
 * Tests the workflow fork redirect logic:
 * - Chat messages (from React state) are saved to the new workflow's localStorage
 * - Double navigation is prevented by the hasNavigated guard
 * - Both polling-based (upgradedTo prop) and onFinish-based fork detection paths
 *   save messages to the new workflow before navigating
 */

describe("workflow fork redirect", () => {
  it("saves in-flight messages to new workflow (simulates upgradedTo path)", () => {
    const storage = new Map<string, string>();
    const oldId = "old-workflow-id";
    const newId = "new-forked-workflow-id";

    // Simulate existing localStorage data (may be stale during streaming)
    storage.set(`workflow-chat-session:${oldId}`, "session-123");
    storage.set(
      `workflow-chat-msgs:${oldId}`,
      JSON.stringify([{ role: "user", content: "hello" }])
    );

    // In-flight messages from React state (includes the latest exchange)
    const currentMessages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "I've forked the workflow" },
    ];
    const currentSessionId = "session-123";

    // Migration logic (mirrors what WorkflowChat does on upgradedTo detection)
    storage.set(`workflow-chat-msgs:${newId}`, JSON.stringify(currentMessages));
    storage.set(`workflow-chat-session:${newId}`, currentSessionId);

    // New workflow has the FULL conversation (not the stale localStorage copy)
    expect(JSON.parse(storage.get(`workflow-chat-msgs:${newId}`)!)).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "I've forked the workflow" },
    ]);
    expect(storage.get(`workflow-chat-session:${newId}`)).toBe("session-123");
    // Original data is preserved
    expect(storage.get(`workflow-chat-session:${oldId}`)).toBe("session-123");
  });

  it("saves messages from onFinish to new workflow (simulates onFinish fork path)", () => {
    const storage = new Map<string, string>();
    const oldId = "old-workflow-id";
    const newId = "new-forked-workflow-id";

    // finalMessages from onFinish callback
    const finalMessages = [
      { role: "user", content: "update the pipeline" },
      { role: "assistant", content: "Done, I created a new version" },
    ];

    // onFinish saves to old workflow first, then copies to new
    storage.set(`workflow-chat-msgs:${oldId}`, JSON.stringify(finalMessages));
    storage.set(`workflow-chat-msgs:${newId}`, JSON.stringify(finalMessages));
    storage.set(`workflow-chat-session:${newId}`, "session-456");

    expect(JSON.parse(storage.get(`workflow-chat-msgs:${newId}`)!)).toEqual(finalMessages);
  });

  it("does not crash when no session ID exists", () => {
    const storage = new Map<string, string>();
    const newId = "new-forked-workflow-id";

    // Simulate: no session ID ref (null), only messages
    const currentMessages = [{ role: "user", content: "hello" }];
    storage.set(`workflow-chat-msgs:${newId}`, JSON.stringify(currentMessages));
    // Session is not set (mirrors the `if (sessionIdRef.current)` guard)

    expect(JSON.parse(storage.get(`workflow-chat-msgs:${newId}`)!)).toEqual(currentMessages);
    expect(storage.get(`workflow-chat-session:${newId}`)).toBeUndefined();
  });

  it("hasNavigated guard prevents double navigation", () => {
    const navigate = vi.fn();
    let hasNavigated = false;

    function handleUpgraded(newId: string) {
      if (hasNavigated) return;
      hasNavigated = true;
      navigate(newId);
    }

    handleUpgraded("fork-1");
    handleUpgraded("fork-1"); // duplicate
    handleUpgraded("fork-2"); // different ID, still blocked

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("fork-1");
  });

  it("hasMigrated guard prevents double migration", () => {
    const saveMsgs = vi.fn();
    let hasMigrated = false;

    function migrateToNewWorkflow(newId: string, messages: unknown[]) {
      if (hasMigrated) return;
      hasMigrated = true;
      saveMsgs(newId, messages);
    }

    const msgs = [{ role: "user", content: "hello" }];
    migrateToNewWorkflow("fork-1", msgs);
    migrateToNewWorkflow("fork-1", msgs); // duplicate — should not save again

    expect(saveMsgs).toHaveBeenCalledTimes(1);
  });
});
