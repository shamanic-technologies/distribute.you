import { CliError, EXIT, authError } from "./errors.js";

export interface RequestOptions {
  method: string;
  path: string;
  apiUrl: string;
  apiKey?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export type Fetcher = typeof fetch;

export function buildUrl(apiUrl: string, path: string, query?: Record<string, string>): string {
  const base = apiUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${suffix}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * One request, one answer. A non-2xx status raises a CliError carrying the
 * upstream body verbatim: the API writes error messages for people, and
 * rewriting them here would lose the only explanation the caller gets.
 */
export async function request(options: RequestOptions, fetcher: Fetcher = fetch): Promise<ApiResponse> {
  const url = buildUrl(options.apiUrl, options.path, options.query);
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": userAgent(),
    ...(options.headers ?? {}),
  };
  if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetcher(url, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    throw new CliError({
      code: "network_error",
      message: `Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`,
      exitCode: EXIT.network,
    });
  }

  const raw = await response.text();
  const body = parseBody(raw, response.headers.get("content-type"));

  if (response.ok) {
    return { status: response.status, headers: headerMap(response.headers), body };
  }

  if (response.status === 401 || response.status === 403) {
    throw authError(`The API rejected this request with ${response.status}.`, body);
  }

  throw new CliError({
    code: response.status === 404 ? "not_found" : "api_error",
    message: `${options.method} ${options.path} returned ${response.status}.`,
    exitCode: response.status === 404 ? EXIT.notFound : EXIT.api,
    details: body,
  });
}

function parseBody(raw: string, contentType: string | null): unknown {
  if (raw.length === 0) return null;
  if (contentType && !contentType.includes("json")) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    // Not JSON despite the header. Hand back what actually arrived.
    return raw;
  }
}

function headerMap(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export function userAgent(): string {
  return `distribute-cli/${VERSION} node/${process.versions.node}`;
}

/** Kept in step with package.json by tests/unit/version.test.ts. */
export const VERSION = "0.1.0";
