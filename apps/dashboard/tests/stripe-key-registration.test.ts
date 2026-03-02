import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the dashboard must register its Stripe key
 * via the API service (POST /v1/keys) at cold start.
 */
describe("Stripe app key registration at cold start", () => {
  const instrumentationPath = path.join(
    __dirname,
    "../instrumentation.ts"
  );

  const content = fs.readFileSync(instrumentationPath, "utf-8");

  it("should call POST /v1/keys on the API service", () => {
    expect(content).toContain("/v1/keys");
    expect(content).toContain("POST");
  });

  it("should use keySource 'app'", () => {
    expect(content).toContain('"app"');
  });

  it("should register the stripe provider", () => {
    expect(content).toContain('"stripe"');
  });

  it("should authenticate with Bearer token via DISTRIBUTE_API_KEY", () => {
    expect(content).toContain("DISTRIBUTE_API_KEY");
    expect(content).toContain("Authorization");
    expect(content).toContain("Bearer");
  });

  it("should read STRIPE_SECRET_KEY from env", () => {
    expect(content).toContain("STRIPE_SECRET_KEY");
  });

  it("should NOT call key-service directly", () => {
    expect(content).not.toContain("KEY_SERVICE_URL");
    expect(content).not.toContain("KEY_SERVICE_API_KEY");
    expect(content).not.toContain("/internal/app-keys");
  });
});
