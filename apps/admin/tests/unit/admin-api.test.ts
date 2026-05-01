import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock environment variables before importing the module
vi.stubEnv("NEXT_PUBLIC_DISTRIBUTE_API_URL", "http://localhost:3000");
vi.stubEnv("ADMIN_DISTRIBUTE_API_KEY", "test-key");

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Internal Server Error",
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("admin-api", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_DISTRIBUTE_API_URL", "http://localhost:3000");
    vi.stubEnv("ADMIN_DISTRIBUTE_API_KEY", "test-key");
  });

  describe("fetchTables", () => {
    it("returns tables when response shape is valid", async () => {
      mockFetchResponse({
        tables: [
          { name: "users", rowCount: 5 },
          { name: "orders", rowCount: 12 },
        ],
      });
      const { fetchTables } = await import("../../src/lib/admin-api");
      const result = await fetchTables("apollo-service");
      expect(result).toEqual([
        { name: "users", rowCount: 5 },
        { name: "orders", rowCount: 12 },
      ]);
    });

    it("throws when a table item is missing name", async () => {
      mockFetchResponse({
        tables: [{ rowCount: 5 }],
      });
      const { fetchTables } = await import("../../src/lib/admin-api");
      await expect(fetchTables("apollo-service")).rejects.toThrow("[admin]");
      await expect(fetchTables("apollo-service")).rejects.toThrow("name");
    });

    it("throws when a table item has non-number rowCount", async () => {
      mockFetchResponse({
        tables: [{ name: "users", rowCount: "five" }],
      });
      const { fetchTables } = await import("../../src/lib/admin-api");
      await expect(fetchTables("apollo-service")).rejects.toThrow("[admin]");
      await expect(fetchTables("apollo-service")).rejects.toThrow("rowCount");
    });
  });

  describe("fetchRows", () => {
    it("returns rows when response shape is valid", async () => {
      const validResponse = { rows: [{ id: 1 }], total: 1, limit: 10, offset: 0 };
      mockFetchResponse(validResponse);
      const { fetchRows } = await import("../../src/lib/admin-api");
      const result = await fetchRows("apollo-service", "users", {});
      expect(result).toEqual(validResponse);
    });

    it("throws when data.rows is not an array", async () => {
      mockFetchResponse({ rows: "not-array", total: 1, limit: 10, offset: 0 });
      const { fetchRows } = await import("../../src/lib/admin-api");
      await expect(fetchRows("apollo-service", "users", {})).rejects.toThrow("[admin]");
      await expect(fetchRows("apollo-service", "users", {})).rejects.toThrow("rows");
    });

    it("throws when data.total is not a number", async () => {
      mockFetchResponse({ rows: [], total: "many", limit: 10, offset: 0 });
      const { fetchRows } = await import("../../src/lib/admin-api");
      await expect(fetchRows("apollo-service", "users", {})).rejects.toThrow("[admin]");
      await expect(fetchRows("apollo-service", "users", {})).rejects.toThrow("total");
    });

    it("throws when data.limit is not a number", async () => {
      mockFetchResponse({ rows: [], total: 0, limit: null, offset: 0 });
      const { fetchRows } = await import("../../src/lib/admin-api");
      await expect(fetchRows("apollo-service", "users", {})).rejects.toThrow("[admin]");
    });

    it("throws when data.offset is not a number", async () => {
      mockFetchResponse({ rows: [], total: 0, limit: 10, offset: undefined });
      const { fetchRows } = await import("../../src/lib/admin-api");
      await expect(fetchRows("apollo-service", "users", {})).rejects.toThrow("[admin]");
    });
  });

  describe("fetchTableSchema", () => {
    it("returns columns when response shape is valid", async () => {
      const columns = [{ name: "id", type: "integer", nullable: false, isPrimaryKey: true }];
      mockFetchResponse({ columns });
      const { fetchTableSchema } = await import("../../src/lib/admin-api");
      const result = await fetchTableSchema("apollo-service", "users");
      expect(result).toEqual(columns);
    });

    it("throws when data.columns is not an array", async () => {
      mockFetchResponse({ columns: "not-array" });
      const { fetchTableSchema } = await import("../../src/lib/admin-api");
      await expect(fetchTableSchema("apollo-service", "users")).rejects.toThrow("[admin]");
      await expect(fetchTableSchema("apollo-service", "users")).rejects.toThrow("columns");
    });

    it("throws when data.columns is undefined", async () => {
      mockFetchResponse({});
      const { fetchTableSchema } = await import("../../src/lib/admin-api");
      await expect(fetchTableSchema("apollo-service", "users")).rejects.toThrow("[admin]");
    });
  });
});
