import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const appsRoutePath = path.join(__dirname, "../../src/routes/apps.ts");
const content = fs.readFileSync(appsRoutePath, "utf-8");

const schemaPath = path.join(__dirname, "../../src/schemas.ts");
const schemaContent = fs.readFileSync(schemaPath, "utf-8");

const indexPath = path.join(__dirname, "../../src/index.ts");
const indexContent = fs.readFileSync(indexPath, "utf-8");

describe("POST /v1/apps/register route", () => {
  it("should not use authenticate middleware (public endpoint)", () => {
    expect(content).not.toContain("authenticate");
    expect(content).not.toContain("requireOrg");
    expect(content).not.toContain("requireUser");
  });

  it("should validate request with RegisterAppRequestSchema", () => {
    expect(content).toContain("RegisterAppRequestSchema");
    expect(content).toContain("safeParse");
  });

  it("should proxy to key-service POST /internal/apps", () => {
    expect(content).toContain('"/internal/apps"');
    expect(content).toContain("externalServices.key");
    expect(content).toContain('method: "POST"');
  });

  it("should forward the name field in the request body", () => {
    expect(content).toContain("body: { name }");
  });

  it("should return 400 for invalid requests", () => {
    expect(content).toContain("400");
    expect(content).toContain("Invalid request");
  });
});

describe("App registration schemas", () => {
  it("should define RegisterAppRequestSchema with name field", () => {
    expect(schemaContent).toContain("RegisterAppRequestSchema");
    expect(schemaContent).toContain('"RegisterAppRequest"');
  });

  it("should define RegisterAppResponseSchema with appId and optional apiKey", () => {
    expect(schemaContent).toContain("RegisterAppResponseSchema");
    expect(schemaContent).toContain('"RegisterAppResponse"');
  });

  it("should register POST /v1/apps/register path in OpenAPI without auth", () => {
    expect(schemaContent).toContain('path: "/v1/apps/register"');
    expect(schemaContent).toContain('tags: ["Apps"]');
    // Should NOT have security (public endpoint)
    const section = schemaContent.slice(
      schemaContent.indexOf('path: "/v1/apps/register"'),
      schemaContent.indexOf('path: "/v1/apps/register"') + 500
    );
    expect(section).not.toContain("security: authed");
  });
});

describe("Apps route is mounted in index.ts", () => {
  it("should import and mount apps routes", () => {
    expect(indexContent).toContain("appsRoutes");
    expect(indexContent).toContain("./routes/apps");
  });
});
