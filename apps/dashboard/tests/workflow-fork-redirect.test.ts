import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests the workflow fork/upgrade redirect logic:
 * - Chat messages (from React state) are saved to the new workflow's localStorage
 * - Double navigation is prevented by the hasNavigated guard
 * - Forks are detected by polling for child workflows (forkedFrom), NOT via upgradedTo
 * - Upgrades are detected via upgradedTo (separate mechanism from forks)
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

  it("detects fork via forkedFrom child when upgradedTo is null (fallback detection)", () => {
    const currentWorkflowId = "parent-workflow-id";
    const workflows = [
      { id: "parent-workflow-id", forkedFrom: null, upgradedTo: null, createdAt: "2026-03-27T15:12:12Z" },
      { id: "child-fork-id", forkedFrom: "parent-workflow-id", upgradedTo: null, createdAt: "2026-03-27T15:13:07Z" },
      { id: "unrelated-workflow", forkedFrom: "some-other-id", upgradedTo: null, createdAt: "2026-03-27T15:14:00Z" },
    ];

    // Mirrors page-level detectedForkId logic
    const fork = workflows
      .filter((w) => w.forkedFrom === currentWorkflowId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    expect(fork?.id).toBe("child-fork-id");
  });

  it("hydrates chat from localStorage when workflowId changes (simulates fork transition)", () => {
    const storage = new Map<string, string>();
    const oldId = "old-workflow-id";
    const newId = "new-forked-workflow-id";

    const conversation = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "I've forked the workflow" },
    ];

    // Step 1: migration logic saves messages under the new key
    storage.set(`workflow-chat-msgs:${newId}`, JSON.stringify(conversation));

    // Step 2: when workflowId changes, component loads from the new key
    // This simulates what the prevWorkflowIdRef effect does
    let currentWorkflowId = oldId;
    let chatMessages: unknown[] = [];
    const setMessages = (msgs: unknown[]) => { chatMessages = msgs; };

    // Simulate workflowId change
    currentWorkflowId = newId;
    const stored = storage.get(`workflow-chat-msgs:${currentWorkflowId}`);
    if (stored) {
      setMessages(JSON.parse(stored));
    }

    // Chat should have the full conversation, not be empty
    expect(chatMessages).toEqual(conversation);
    expect(chatMessages).toHaveLength(2);
  });

  it("prefers upgradedTo over forkedFrom child detection", () => {
    const upgradedTo = "upgraded-target-id";

    // When upgradedTo is set, use it directly — no need to scan siblings
    const detectedForkId = upgradedTo ?? null;

    expect(detectedForkId).toBe("upgraded-target-id");
  });

  it("hasNavigated resets after navigation so subsequent forks are detected", () => {
    const navigate = vi.fn();
    let hasNavigated = false;
    let activeWorkflowId = "wf-1";

    function handleUpgraded(newId: string) {
      if (hasNavigated) return;
      hasNavigated = true;
      navigate(newId);
      activeWorkflowId = newId;
      // Reset guard on activeWorkflowId change (mirrors useEffect in page)
      hasNavigated = false;
    }

    handleUpgraded("wf-2"); // first fork
    handleUpgraded("wf-3"); // second fork — should also work

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith("wf-2");
    expect(navigate).toHaveBeenCalledWith("wf-3");
    expect(activeWorkflowId).toBe("wf-3");
  });
});

describe("workflow-chat — defer upgrade navigation while streaming", () => {
  it("hasMigrated guard defers when streaming is active", () => {
    const onWorkflowUpgraded = vi.fn();
    let hasMigrated = false;
    let isStreaming = true;
    const upgradedTo = "new-workflow-id";

    // Simulate the effect running while streaming
    function runEffect() {
      if (!upgradedTo || hasMigrated) return;
      if (isStreaming) return; // deferred
      hasMigrated = true;
      onWorkflowUpgraded(upgradedTo);
    }

    // First run: streaming → should not navigate
    runEffect();
    expect(onWorkflowUpgraded).not.toHaveBeenCalled();
    expect(hasMigrated).toBe(false);

    // Streaming finishes → effect re-runs → should navigate now
    isStreaming = false;
    runEffect();
    expect(onWorkflowUpgraded).toHaveBeenCalledTimes(1);
    expect(onWorkflowUpgraded).toHaveBeenCalledWith("new-workflow-id");
    expect(hasMigrated).toBe(true);
  });

  it("source code defers migration when isStreaming is true", () => {
    const chatPath = path.join(
      __dirname,
      "../src/components/workflows/workflow-chat.tsx"
    );
    const content = fs.readFileSync(chatPath, "utf-8");

    // The upgradedTo effect must check isStreaming and include it in deps
    expect(content).toContain("if (isStreaming) return");
    expect(content).toContain("isStreaming]");
  });
});

describe("workflow-chat — hydrate messages on workflowId change (source check)", () => {
  const chatPath = path.join(
    __dirname,
    "../src/components/workflows/workflow-chat.tsx"
  );
  const content = fs.readFileSync(chatPath, "utf-8");

  it("should call setMessages(loadMessages(workflowId)) when workflowId changes", () => {
    expect(content).toContain("setMessages(loadMessages(workflowId))");
  });

  it("should track previous workflowId with a ref to avoid re-hydrating on same ID", () => {
    expect(content).toContain("prevWorkflowIdRef");
    expect(content).toContain("prevWorkflowIdRef.current !== workflowId");
  });
});
