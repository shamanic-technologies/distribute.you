import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CliError, EXIT } from "./errors.js";
import { type Fetcher, request } from "./client.js";
import { cachePath } from "./config.js";

export const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface Operation {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: OperationParameter[];
  requestBody?: unknown;
  destructive: boolean;
}

export interface OperationParameter {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  schema?: unknown;
}

export interface OpenApiDocument {
  info?: { title?: string; version?: string };
  servers?: { url?: string }[];
  paths?: Record<string, Record<string, unknown>>;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheFile {
  fetchedAt: number;
  apiUrl: string;
  document: OpenApiDocument;
}

/**
 * The command surface is read from the LIVE document at run time, never from a
 * copy committed here. The API grows and its operations get renamed; a snapshot
 * baked into this package would start lying the day after it shipped, and the
 * one thing a CLI must not do is offer a command the API no longer has.
 */
export async function loadSpec(options: {
  apiUrl: string;
  refresh: boolean;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  fetcher?: Fetcher;
  now?: number;
}): Promise<{ document: OpenApiDocument; source: "cache" | "network"; fetchedAt: number }> {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const path = cachePath(env);

  if (!options.refresh && existsSync(path)) {
    const cached = readCache(path);
    if (cached && cached.apiUrl === options.apiUrl && now - cached.fetchedAt < CACHE_TTL_MS) {
      return { document: cached.document, source: "cache", fetchedAt: cached.fetchedAt };
    }
  }

  const response = await request(
    { method: "GET", path: "/openapi.json", apiUrl: options.apiUrl, timeoutMs: options.timeoutMs },
    options.fetcher ?? fetch,
  );
  const document = response.body;
  if (typeof document !== "object" || document === null || !("paths" in document)) {
    throw new CliError({
      code: "invalid_spec",
      message: `${options.apiUrl}/openapi.json did not return an OpenAPI document.`,
      exitCode: EXIT.api,
      details: document,
    });
  }

  writeCache(path, { fetchedAt: now, apiUrl: options.apiUrl, document: document as OpenApiDocument });
  return { document: document as OpenApiDocument, source: "network", fetchedAt: now };
}

function readCache(path: string): CacheFile | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Partial<CacheFile>;
    if (typeof candidate.fetchedAt !== "number" || typeof candidate.apiUrl !== "string") return null;
    if (typeof candidate.document !== "object" || candidate.document === null) return null;
    return candidate as CacheFile;
  } catch {
    // A corrupt cache is not an error the caller can act on: it is refetched.
    return null;
  }
}

function writeCache(path: string, cache: CacheFile): void {
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, JSON.stringify(cache));
  } catch {
    // Caching is an optimisation. Failing to write it must not fail a command
    // whose real work already succeeded.
  }
}

/** Flattens the document into one entry per operation, in document order. */
export function listOperations(document: OpenApiDocument): Operation[] {
  const operations: Operation[] = [];
  for (const [path, item] of Object.entries(document.paths ?? {})) {
    if (typeof item !== "object" || item === null) continue;
    const shared = readParameters((item as Record<string, unknown>).parameters);
    for (const method of HTTP_METHODS) {
      const raw = (item as Record<string, unknown>)[method];
      if (typeof raw !== "object" || raw === null) continue;
      const op = raw as Record<string, unknown>;
      operations.push({
        method: method.toUpperCase(),
        path,
        operationId: typeof op.operationId === "string" ? op.operationId : undefined,
        summary: typeof op.summary === "string" ? op.summary : undefined,
        description: typeof op.description === "string" ? op.description : undefined,
        tags: Array.isArray(op.tags) ? op.tags.filter((t): t is string => typeof t === "string") : [],
        parameters: [...shared, ...readParameters(op.parameters)],
        requestBody: op.requestBody,
        destructive: isDestructive(method),
      });
    }
  }
  return operations;
}

function readParameters(raw: unknown): OperationParameter[] {
  if (!Array.isArray(raw)) return [];
  const out: OperationParameter[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const param = entry as Record<string, unknown>;
    if (typeof param.name !== "string" || typeof param.in !== "string") continue;
    out.push({
      name: param.name,
      in: param.in,
      required: param.required === true,
      description: typeof param.description === "string" ? param.description : undefined,
      schema: param.schema,
    });
  }
  return out;
}

/** DELETE removes something. Everything else, the caller can undo or repeat. */
export function isDestructive(method: string): boolean {
  return method.toUpperCase() === "DELETE";
}

/**
 * Finds the operation a method and path name, tolerating a path written with
 * real ids in place of the template segments (`/v1/brands/abc` matches
 * `/v1/brands/{id}`), so a caller can paste a URL they already have.
 */
export function findOperation(operations: Operation[], method: string, path: string): Operation | undefined {
  const wanted = method.toUpperCase();
  const normalisedPath = normalisePath(path);
  const exact = operations.find((op) => op.method === wanted && op.path === normalisedPath);
  if (exact) return exact;
  return operations.find((op) => op.method === wanted && templateMatches(op.path, normalisedPath));
}

export function normalisePath(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

export function templateMatches(template: string, concrete: string): boolean {
  const a = template.split("/");
  const b = concrete.split("/");
  if (a.length !== b.length) return false;
  return a.every((segment, i) => (segment.startsWith("{") && segment.endsWith("}") ? b[i].length > 0 : segment === b[i]));
}

export function filterOperations(
  operations: Operation[],
  filters: { tag?: string; method?: string; search?: string },
): Operation[] {
  const tag = filters.tag?.toLowerCase();
  const method = filters.method?.toUpperCase();
  const search = filters.search?.toLowerCase();
  return operations.filter((op) => {
    if (method && op.method !== method) return false;
    if (tag && !op.tags.some((t) => t.toLowerCase() === tag)) return false;
    if (search) {
      const haystack = `${op.method} ${op.path} ${op.operationId ?? ""} ${op.summary ?? ""} ${op.tags.join(" ")}`;
      if (!haystack.toLowerCase().includes(search)) return false;
    }
    return true;
  });
}
