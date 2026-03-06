import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const proxyPath = path.resolve(
  __dirname,
  "../src/app/api/v1/[...path]/route.ts"
);

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const useAuthQueryPath = path.resolve(__dirname, "../src/lib/use-auth-query.ts");

describe("API proxy route", () => {
  it("should exist at app/api/v1/[...path]/route.ts", () => {
    expect(fs.existsSync(proxyPath)).toBe(true);
  });

  it("should use ADMIN_DISTRIBUTE_API_KEY via X-API-Key header", () => {
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).toContain("ADMIN_DISTRIBUTE_API_KEY");
    expect(content).toContain('"X-API-Key"');
  });

  it("should verify Clerk session via auth() and currentUser()", () => {
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).toContain("@clerk/nextjs/server");
    expect(content).toContain("await auth()");
    expect(content).toContain("currentUser");
    expect(content).toContain("userId");
  });

  it("should export GET, POST, PUT, DELETE handlers", () => {
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).toContain("export async function GET");
    expect(content).toContain("export async function POST");
    expect(content).toContain("export async function PUT");
    expect(content).toContain("export async function DELETE");
  });

  it("should forward to API_URL/v1/ path", () => {
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).toContain("/v1/");
    expect(content).toContain("path.join");
  });

  it("should forward Clerk IDs as x-external-org-id and x-external-user-id headers", () => {
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).toContain('"x-external-org-id"');
    expect(content).toContain('"x-external-user-id"');
    expect(content).toContain("clerkOrgId");
    expect(content).toContain("clerkUserId");
  });

  it("should forward user contact info as x-email, x-first-name, x-last-name headers", () => {
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).toContain('"x-email"');
    expect(content).toContain('"x-first-name"');
    expect(content).toContain('"x-last-name"');
  });

  it("should not call client-service directly", () => {
    const content = fs.readFileSync(proxyPath, "utf-8");
    expect(content).not.toContain("CLIENT_SERVICE_URL");
    expect(content).not.toContain("CLIENT_SERVICE_API_KEY");
    expect(content).not.toContain("/resolve");
  });
});

describe("api.ts client routing", () => {
  it("should route client calls through /api/v1 proxy (no token)", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("/api/v1");
  });

  it("should make token optional in apiCall", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("token?: string");
  });

  it("should use direct URL with token for server-side calls", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    // When token is provided, use the external API URL with X-API-Key
    expect(content).toContain("if (token)");
    expect(content).toContain('headers["X-API-Key"]');
  });
});

describe("useAuthQuery no longer uses Clerk getToken", () => {
  it("should not import useAuth from Clerk", () => {
    const content = fs.readFileSync(useAuthQueryPath, "utf-8");
    expect(content).not.toContain("from \"@clerk");
    expect(content).not.toContain("getToken");
  });

  it("should accept queryFn without token parameter", () => {
    const content = fs.readFileSync(useAuthQueryPath, "utf-8");
    expect(content).toContain("queryFn: () => Promise<T>");
  });
});

describe("no client component sends Clerk JWT to external API", () => {
  const srcDir = path.resolve(__dirname, "../src");

  function findTsFiles(dir: string): string[] {
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findTsFiles(full));
      } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
        files.push(full);
      }
    }
    return files;
  }

  it("should not pass getToken() result to api.ts functions", () => {
    const violations: string[] = [];
    for (const file of findTsFiles(srcDir)) {
      // Skip the proxy route itself and instrumentation
      if (file.includes("[...path]/route.ts")) continue;
      if (file.includes("instrumentation")) continue;
      if (file.includes("use-chat.ts")) continue; // chat uses session key directly
      const content = fs.readFileSync(file, "utf-8");
      // Check for pattern: apiFunction(token, ...) where token comes from getToken
      if (
        content.includes("getToken") &&
        content.includes("apiCall") &&
        !content.includes("// server-side")
      ) {
        // This is the api.ts file itself which defines apiCall
        if (file.endsWith("api.ts")) continue;
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});
