const DISTRIBUTE_API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL;
const DISTRIBUTE_API_KEY = process.env.ADMIN_DISTRIBUTE_API_KEY;

function getHeaders(): HeadersInit {
  if (!DISTRIBUTE_API_URL) {
    throw new Error("[admin] NEXT_PUBLIC_DISTRIBUTE_API_URL is not configured");
  }
  if (!DISTRIBUTE_API_KEY) {
    throw new Error("[admin] ADMIN_DISTRIBUTE_API_KEY is not configured");
  }
  return {
    "x-api-key": DISTRIBUTE_API_KEY,
    "Content-Type": "application/json",
  };
}

function baseUrl(): string {
  if (!DISTRIBUTE_API_URL) {
    throw new Error("[admin] NEXT_PUBLIC_DISTRIBUTE_API_URL is not configured");
  }
  return `${DISTRIBUTE_API_URL}/internal/admin`;
}

export interface ServiceInfo {
  name: string;
  tableCount: number;
}

export interface TableInfo {
  name: string;
  rowCount: number;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface RowsResponse {
  rows: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchServices(): Promise<ServiceInfo[]> {
  const res = await fetch(`${baseUrl()}/services`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`[admin] Failed to fetch services: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.services;
}

export async function fetchTables(serviceName: string): Promise<TableInfo[]> {
  const res = await fetch(`${baseUrl()}/services/${encodeURIComponent(serviceName)}/tables`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`[admin] Failed to fetch tables for ${serviceName}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.tables)) {
    throw new Error(`[admin] Expected tables array for ${serviceName}, got: ${JSON.stringify(data)}`);
  }
  for (const item of data.tables) {
    if (typeof item.name !== "string") {
      throw new Error(`[admin] Table item missing valid name for ${serviceName}, got: ${JSON.stringify(item)}`);
    }
    if (typeof item.rowCount !== "number") {
      throw new Error(`[admin] Table item missing valid rowCount for ${serviceName}, got: ${JSON.stringify(item)}`);
    }
  }
  return data.tables as TableInfo[];
}

export async function fetchTableSchema(serviceName: string, tableName: string): Promise<ColumnSchema[]> {
  const res = await fetch(
    `${baseUrl()}/services/${encodeURIComponent(serviceName)}/tables/${encodeURIComponent(tableName)}/schema`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`[admin] Failed to fetch schema for ${serviceName}/${tableName}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.columns)) {
    throw new Error(`[admin] Expected columns array for ${serviceName}/${tableName}, got: ${JSON.stringify(data)}`);
  }
  return data.columns;
}

export async function fetchRows(
  serviceName: string,
  tableName: string,
  params: {
    limit?: number;
    offset?: number;
    sort?: string;
    order?: "asc" | "desc";
    search?: string;
  }
): Promise<RowsResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params.offset !== undefined) searchParams.set("offset", String(params.offset));
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.order) searchParams.set("order", params.order);
  if (params.search) searchParams.set("search", params.search);

  const res = await fetch(
    `${baseUrl()}/services/${encodeURIComponent(serviceName)}/tables/${encodeURIComponent(tableName)}/rows?${searchParams.toString()}`,
    {
      headers: getHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`[admin] Failed to fetch rows for ${serviceName}/${tableName}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.rows)) {
    throw new Error(`[admin] Expected rows array for ${serviceName}/${tableName}, got keys: ${JSON.stringify(Object.keys(data))}`);
  }
  if (typeof data.total !== "number") {
    throw new Error(`[admin] Expected numeric total for ${serviceName}/${tableName}, got: ${JSON.stringify({ total: data.total })}`);
  }
  if (typeof data.limit !== "number") {
    throw new Error(`[admin] Expected numeric limit for ${serviceName}/${tableName}, got: ${JSON.stringify({ limit: data.limit })}`);
  }
  if (typeof data.offset !== "number") {
    throw new Error(`[admin] Expected numeric offset for ${serviceName}/${tableName}, got: ${JSON.stringify({ offset: data.offset })}`);
  }
  return data as RowsResponse;
}
