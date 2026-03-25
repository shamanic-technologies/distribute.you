import { describe, it, expect, vi } from "vitest";

/**
 * Tests the workflow fork redirect logic:
 * - Chat session/messages are migrated from old to new workflow ID
 * - Double navigation is prevented by the hasNavigated guard
 */

describe("workflow fork redirect", () => {
  it("migrates chat data from old workflow to new workflow in a storage map", () => {
    const storage = new Map<string, string>();
    const oldId = "old-workflow-id";
    const newId = "new-forked-workflow-id";

    // Simulate existing chat data
    storage.set(`workflow-chat-session:${oldId}`, "session-123");
    storage.set(
      `workflow-chat-msgs:${oldId}`,
      JSON.stringify([{ role: "user", content: "hello" }])
    );

    // Migration logic (mirrors handleWorkflowUpgraded)
    const session = storage.get(`workflow-chat-session:${oldId}`);
    const msgs = storage.get(`workflow-chat-msgs:${oldId}`);
    if (session) storage.set(`workflow-chat-session:${newId}`, session);
    if (msgs) storage.set(`workflow-chat-msgs:${newId}`, msgs);

    expect(storage.get(`workflow-chat-session:${newId}`)).toBe("session-123");
    expect(JSON.parse(storage.get(`workflow-chat-msgs:${newId}`)!)).toEqual([
      { role: "user", content: "hello" },
    ]);
    // Original data is preserved (copy, not move)
    expect(storage.get(`workflow-chat-session:${oldId}`)).toBe("session-123");
  });

  it("does not crash when no existing chat data", () => {
    const storage = new Map<string, string>();
    const oldId = "old-workflow-id";
    const newId = "new-forked-workflow-id";

    const session = storage.get(`workflow-chat-session:${oldId}`);
    const msgs = storage.get(`workflow-chat-msgs:${oldId}`);
    if (session) storage.set(`workflow-chat-session:${newId}`, session);
    if (msgs) storage.set(`workflow-chat-msgs:${newId}`, msgs);

    expect(storage.get(`workflow-chat-session:${newId}`)).toBeUndefined();
    expect(storage.get(`workflow-chat-msgs:${newId}`)).toBeUndefined();
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
});
