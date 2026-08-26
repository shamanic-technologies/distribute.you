import { describe, expect, it } from "vitest";
import { ROUTES, fillPath, findRoute, groupNames, routesInGroup } from "../../src/routes.js";
import { commandName } from "../../src/commands/resource.js";

describe("route table", () => {
  it("has no duplicate command names", () => {
    const names = ROUTES.map(commandName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("declares one path parameter per template segment", () => {
    for (const route of ROUTES) {
      const segments = route.path.match(/\{[^}]+\}/g) ?? [];
      expect(`${commandName(route)}:${segments.length}`).toBe(`${commandName(route)}:${route.pathParams.length}`);
    }
  });

  it("marks every DELETE as destructive", () => {
    for (const route of ROUTES.filter((r) => r.method === "DELETE")) {
      expect(route.destructive).toBe(true);
    }
  });

  it("only names paths under the versioned API", () => {
    for (const route of ROUTES) expect(route.path.startsWith("/v1/")).toBe(true);
  });

  it("fills path parameters in order and escapes them", () => {
    const route = findRoute("campaigns", "get");
    expect(route).toBeDefined();
    expect(fillPath(route!, ["a/b"])).toBe("/v1/campaigns/a%2Fb");
  });

  it("groups every route", () => {
    expect(groupNames()).toContain("brands");
    expect(routesInGroup("brands").length).toBeGreaterThan(0);
  });
});
