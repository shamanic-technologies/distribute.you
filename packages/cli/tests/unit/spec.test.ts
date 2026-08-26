import { describe, expect, it } from "vitest";
import {
  filterOperations,
  findOperation,
  isDestructive,
  listOperations,
  normalisePath,
  templateMatches,
} from "../../src/spec.js";

const document = {
  info: { title: "distribute API", version: "1.0.0" },
  paths: {
    "/v1/brands": {
      get: { tags: ["Brand"], summary: "List brands" },
      post: { tags: ["Brand"], summary: "Upsert brand" },
    },
    "/v1/brands/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: { tags: ["Brand"], summary: "Get a brand" },
    },
    "/v1/orgs/audiences/{id}": {
      delete: { tags: ["Audiences"], summary: "Delete an audience" },
    },
  },
};

describe("listOperations", () => {
  it("returns one entry per method", () => {
    const operations = listOperations(document);
    expect(operations).toHaveLength(4);
    expect(operations.map((op) => `${op.method} ${op.path}`)).toContain("POST /v1/brands");
  });

  it("merges path level parameters into the operation", () => {
    const op = listOperations(document).find((o) => o.path === "/v1/brands/{id}");
    expect(op?.parameters.map((p) => p.name)).toEqual(["id"]);
    expect(op?.parameters[0].required).toBe(true);
  });

  it("marks DELETE as destructive and nothing else", () => {
    const operations = listOperations(document);
    expect(operations.filter((op) => op.destructive).map((op) => op.method)).toEqual(["DELETE"]);
    expect(isDestructive("get")).toBe(false);
  });
});

describe("findOperation", () => {
  const operations = listOperations(document);

  it("finds an exact path", () => {
    expect(findOperation(operations, "get", "/v1/brands")?.summary).toBe("List brands");
  });

  it("finds a templated path from a concrete one", () => {
    expect(findOperation(operations, "GET", "/v1/brands/9f3a")?.path).toBe("/v1/brands/{id}");
  });

  it("does not match a path of a different depth", () => {
    expect(findOperation(operations, "GET", "/v1/brands/9f3a/runs")).toBeUndefined();
  });

  it("does not match an empty template segment", () => {
    expect(templateMatches("/v1/brands/{id}", "/v1/brands/")).toBe(false);
  });
});

describe("filterOperations", () => {
  const operations = listOperations(document);

  it("filters by tag, method and free text", () => {
    expect(filterOperations(operations, { tag: "audiences" })).toHaveLength(1);
    expect(filterOperations(operations, { method: "get" })).toHaveLength(2);
    expect(filterOperations(operations, { search: "upsert" })).toHaveLength(1);
  });
});

describe("normalisePath", () => {
  it("adds a leading slash and drops a trailing one", () => {
    expect(normalisePath("v1/me/")).toBe("/v1/me");
    expect(normalisePath("/")).toBe("/");
  });
});
