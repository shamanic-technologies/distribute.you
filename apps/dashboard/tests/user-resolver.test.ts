import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const resolverPath = path.resolve(
  __dirname,
  "../src/components/user-resolver.tsx"
);
const layoutPath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/layout.tsx"
);
const apiPath = path.resolve(__dirname, "../src/lib/api.ts");

describe("UserResolver component", () => {
  it("should exist", () => {
    expect(fs.existsSync(resolverPath)).toBe(true);
  });

  it("should use Clerk useUser hook to get email, firstName, lastName", () => {
    const content = fs.readFileSync(resolverPath, "utf-8");
    expect(content).toContain("useUser");
    expect(content).toContain("primaryEmailAddress");
    expect(content).toContain("firstName");
    expect(content).toContain("lastName");
  });

  it("should use Clerk useOrganization hook to get org id", () => {
    const content = fs.readFileSync(resolverPath, "utf-8");
    expect(content).toContain("useOrganization");
    expect(content).toContain("organization.id");
  });

  it("should call resolveUser from api.ts", () => {
    const content = fs.readFileSync(resolverPath, "utf-8");
    expect(content).toContain("resolveUser");
    expect(content).toContain("externalOrgId");
    expect(content).toContain("externalUserId");
  });

  it("should send imageUrl alongside contact info", () => {
    const content = fs.readFileSync(resolverPath, "utf-8");
    expect(content).toContain("imageUrl");
  });

  it("should fire only once per visit (hasFired ref)", () => {
    const content = fs.readFileSync(resolverPath, "utf-8");
    expect(content).toContain("hasFired");
    expect(content).toContain("useRef(false)");
  });

  it("should be best-effort (catch errors silently)", () => {
    const content = fs.readFileSync(resolverPath, "utf-8");
    expect(content).toContain(".catch(");
  });
});

describe("resolveUser in api.ts", () => {
  it("should export a resolveUser function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function resolveUser");
  });

  it("should call POST /users/resolve", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    // Find the resolveUser function body
    const fnStart = content.indexOf("export async function resolveUser");
    const fnBody = content.slice(fnStart, fnStart + 500);
    expect(fnBody).toContain('"/users/resolve"');
    expect(fnBody).toContain('"POST"');
  });
});

describe("Dashboard layout includes UserResolver", () => {
  it("should import UserResolver", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("UserResolver");
    expect(content).toContain("@/components/user-resolver");
  });

  it("should render <UserResolver /> in the layout", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("<UserResolver");
  });
});
