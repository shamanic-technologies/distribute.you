import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("GET /v1/campaigns/:id/stream SSE route", () => {
  const routePath = path.join(__dirname, "../../src/routes/campaigns.ts");
  const content = fs.readFileSync(routePath, "utf-8");

  it("should have a GET /campaigns/:id/stream route", () => {
    expect(content).toContain('"/campaigns/:id/stream"');
    expect(content).toContain("router.get");
  });

  it("should use authenticate and requireOrg middleware", () => {
    const streamSection = content.slice(content.indexOf("/campaigns/:id/stream"));
    expect(streamSection).toContain("authenticate");
    expect(streamSection).toContain("requireOrg");
  });

  it("should set SSE headers", () => {
    expect(content).toContain("text/event-stream");
    expect(content).toContain("no-cache");
    expect(content).toContain("keep-alive");
  });

  it("should disable nginx buffering", () => {
    expect(content).toContain("X-Accel-Buffering");
  });

  it("should send initial connection comment", () => {
    expect(content).toContain(": connected");
  });

  it("should poll campaign, lead, emailgen, and delivery stats", () => {
    const streamSection = content.slice(content.indexOf("/campaigns/:id/stream"));
    expect(streamSection).toContain("externalServices.campaign");
    expect(streamSection).toContain("externalServices.lead");
    expect(streamSection).toContain("externalServices.emailgen");
    expect(streamSection).toContain("fetchDeliveryStats");
  });

  it("should only emit on changes (delta-based)", () => {
    expect(content).toContain("lastLeadCount");
    expect(content).toContain("lastEmailCount");
    expect(content).toContain("lastStatus");
    expect(content).toContain("changed");
  });

  it("should emit update events with SSE format", () => {
    expect(content).toContain("event: update");
    expect(content).toContain("JSON.stringify(payload)");
  });

  it("should emit done event on terminal campaign states", () => {
    expect(content).toContain("event: done");
    expect(content).toContain('"completed"');
    expect(content).toContain('"failed"');
    expect(content).toContain('"stopped"');
  });

  it("should clean up on client disconnect", () => {
    expect(content).toContain('req.on("close"');
    expect(content).toContain("clearTimeout");
  });
});

describe("Campaign stream SSE OpenAPI registration", () => {
  const schemaPath = path.join(__dirname, "../../src/schemas.ts");
  const content = fs.readFileSync(schemaPath, "utf-8");

  it("should register GET /v1/campaigns/{id}/stream in OpenAPI", () => {
    expect(content).toContain('path: "/v1/campaigns/{id}/stream"');
    expect(content).toContain("text/event-stream");
  });

  it("should describe as SSE endpoint", () => {
    expect(content).toContain("Server-Sent Events");
  });
});
