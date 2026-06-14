import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("WorkflowDetailPanel", () => {
  const panelPath = path.join(
    __dirname,
    "../src/components/workflows/workflow-detail-panel.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(panelPath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should fetch workflow summary", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("getWorkflowSummary");
    expect(content).toContain("workflow-summary");
  });

  it("should fetch workflow key status", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("getWorkflowKeyStatus");
    expect(content).toContain("workflow-key-status");
  });

  it("should display AI summary with steps", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("summary.summary");
    expect(content).toContain("summary.steps");
  });

  it("should show key status with configured/missing indicators", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("k.configured");
    expect(content).toContain("k.maskedKey");
    expect(content).toContain("Not configured");
  });

  it("should show key source badge (own key vs platform)", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("k.keySource");
    expect(content).toContain("own key");
    expect(content).toContain("platform");
  });

  it("should show ready/missing badge", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("keyStatus.ready");
    expect(content).toContain("Ready");
    expect(content).toContain("missing");
  });

  it("should link to provider keys page when keys are missing", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("provider-keys");
    expect(content).toContain("Configure Keys");
  });

  it("should use org context for provider keys link", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("useOrg");
    expect(content).toContain("org.id");
  });

  it("should still show DAG visualization", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("DAGVisualization");
    expect(content).toContain("Pipeline");
  });

  it("should close on Escape key and backdrop click", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("Escape");
    expect(content).toContain("onClose");
    expect(content).toContain("bg-black/30");
  });

  it("should show loading skeletons for summary and key status", () => {
    const content = fs.readFileSync(panelPath, "utf-8");
    expect(content).toContain("summaryLoading");
    expect(content).toContain("keyStatusLoading");
    expect(content).toContain("animate-pulse");
  });
});
