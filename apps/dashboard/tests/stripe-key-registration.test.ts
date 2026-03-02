import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: distribute-frontend must register its Stripe key
 * with key-service at cold start so downstream services can resolve it.
 */
describe("Stripe app key registration at cold start", () => {
  const instrumentationPath = path.join(
    __dirname,
    "../instrumentation.ts"
  );

  const content = fs.readFileSync(instrumentationPath, "utf-8");

  it("should call POST /internal/app-keys on key-service", () => {
    expect(content).toContain("/internal/app-keys");
    expect(content).toContain("POST");
  });

  it("should use appId 'distribute-frontend'", () => {
    expect(content).toContain('distribute-frontend');
  });

  it("should register the stripe provider", () => {
    expect(content).toContain('"stripe"');
  });

  it("should authenticate with x-api-key header", () => {
    expect(content).toContain("x-api-key");
    expect(content).toContain("KEY_SERVICE_API_KEY");
  });

  it("should read STRIPE_SECRET_KEY from env", () => {
    expect(content).toContain("STRIPE_SECRET_KEY");
  });

  it("should read KEY_SERVICE_URL from env", () => {
    expect(content).toContain("KEY_SERVICE_URL");
  });
});
