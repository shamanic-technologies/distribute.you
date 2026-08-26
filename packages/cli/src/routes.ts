/**
 * The named commands. Each one is a thin label over a real operation, and the
 * method and path here are the whole binding: `tests/spec-conformance.test.ts`
 * reads the live OpenAPI document and fails if any route below is not in it, so
 * this table cannot drift into offering a command the API does not have.
 *
 * Anything not named here is still reachable: `distribute call` invokes any of
 * the API's operations, and `distribute ops` lists them.
 */
export interface QueryBinding {
  /** The CLI flag a caller types. */
  flag: string;
  /** The query parameter it becomes. */
  param: string;
}

export interface Route {
  group: string;
  action: string;
  method: string;
  path: string;
  summary: string;
  /** Positional arguments, in order, filling the `{...}` segments of `path`. */
  pathParams: string[];
  query: QueryBinding[];
  /** Whether a body may be passed with --body / --data. */
  acceptsBody: boolean;
  /** Ask before doing it. */
  destructive: boolean;
}

const route = (r: Partial<Route> & Pick<Route, "group" | "action" | "method" | "path" | "summary">): Route => ({
  pathParams: [],
  query: [],
  acceptsBody: false,
  destructive: false,
  ...r,
});

export const ROUTES: Route[] = [
  route({ group: "whoami", action: "", method: "GET", path: "/v1/me", summary: "Show the identity behind the current key" }),

  route({ group: "brands", action: "list", method: "GET", path: "/v1/brands", summary: "List the org's brands" }),
  route({
    group: "brands",
    action: "get",
    method: "GET",
    path: "/v1/brands/{id}",
    summary: "Read one brand",
    pathParams: ["id"],
  }),
  route({
    group: "brands",
    action: "runs",
    method: "GET",
    path: "/v1/brands/{id}/runs",
    summary: "List a brand's runs",
    pathParams: ["id"],
  }),

  route({
    group: "campaigns",
    action: "list",
    method: "GET",
    path: "/v1/campaigns",
    summary: "List campaigns",
    query: [
      { flag: "brand", param: "brandId" },
      { flag: "status", param: "status" },
      { flag: "feature", param: "featureSlug" },
      { flag: "workflow", param: "workflowSlug" },
    ],
  }),
  route({
    group: "campaigns",
    action: "get",
    method: "GET",
    path: "/v1/campaigns/{id}",
    summary: "Read one campaign",
    pathParams: ["id"],
  }),
  route({
    group: "campaigns",
    action: "stats",
    method: "GET",
    path: "/v1/campaigns/{id}/stats",
    summary: "Read one campaign's stats",
    pathParams: ["id"],
  }),
  route({
    group: "campaigns",
    action: "stop",
    method: "POST",
    path: "/v1/campaigns/{id}/stop",
    summary: "Stop a campaign",
    pathParams: ["id"],
    destructive: true,
  }),

  route({
    group: "leads",
    action: "list",
    method: "GET",
    path: "/v1/leads",
    summary: "List leads",
    query: [
      { flag: "brand", param: "brandId" },
      { flag: "campaign", param: "campaignId" },
      { flag: "limit", param: "limit" },
      { flag: "offset", param: "offset" },
      { flag: "view", param: "view" },
    ],
  }),
  route({
    group: "leads",
    action: "stats",
    method: "GET",
    path: "/v1/leads/stats",
    summary: "Lead counts without the leads",
    query: [
      { flag: "brand", param: "brandId" },
      { flag: "campaign", param: "campaignId" },
      { flag: "group-by", param: "groupBy" },
    ],
  }),
  route({
    group: "leads",
    action: "get",
    method: "GET",
    path: "/v1/leads/{id}",
    summary: "Read one lead's full record",
    pathParams: ["id"],
  }),

  route({
    group: "audiences",
    action: "list",
    method: "GET",
    path: "/v1/orgs/audiences",
    summary: "List audiences",
    query: [
      { flag: "brand", param: "brandId" },
      { flag: "status", param: "status" },
      { flag: "limit", param: "limit" },
      { flag: "offset", param: "offset" },
    ],
  }),
  route({
    group: "audiences",
    action: "get",
    method: "GET",
    path: "/v1/orgs/audiences/{id}",
    summary: "Read one audience",
    pathParams: ["id"],
  }),
  route({
    group: "audiences",
    action: "delete",
    method: "DELETE",
    path: "/v1/orgs/audiences/{id}",
    summary: "Delete an audience and its members",
    pathParams: ["id"],
    destructive: true,
  }),

  route({
    group: "workflows",
    action: "list",
    method: "GET",
    path: "/v1/workflows",
    summary: "List workflows",
    query: [
      { flag: "feature", param: "featureSlug" },
      { flag: "dynasty", param: "workflowDynastySlug" },
      { flag: "workflow", param: "workflowSlug" },
    ],
  }),
  route({
    group: "workflows",
    action: "get",
    method: "GET",
    path: "/v1/workflows/{id}",
    summary: "Read one workflow",
    pathParams: ["id"],
  }),

  route({
    group: "runs",
    action: "list",
    method: "GET",
    path: "/v1/runs",
    summary: "List runs",
    query: [
      { flag: "brand", param: "brandId" },
      { flag: "campaign", param: "campaignId" },
      { flag: "status", param: "status" },
      { flag: "service", param: "serviceName" },
      { flag: "limit", param: "limit" },
      { flag: "offset", param: "offset" },
    ],
  }),

  route({ group: "billing", action: "balance", method: "GET", path: "/v1/billing/accounts/balance", summary: "Read the org's credit balance" }),
  route({ group: "billing", action: "account", method: "GET", path: "/v1/billing/accounts", summary: "Read the org's billing account" }),

  route({ group: "keys", action: "list", method: "GET", path: "/v1/keys", summary: "List stored provider keys" }),
  route({
    group: "keys",
    action: "delete",
    method: "DELETE",
    path: "/v1/keys/{provider}",
    summary: "Delete a stored provider key",
    pathParams: ["provider"],
    destructive: true,
  }),
];

export function findRoute(group: string, action: string): Route | undefined {
  return ROUTES.find((r) => r.group === group && r.action === action);
}

export function groupNames(): string[] {
  return [...new Set(ROUTES.map((r) => r.group))];
}

export function routesInGroup(group: string): Route[] {
  return ROUTES.filter((r) => r.group === group);
}

/** Substitutes positional values into `{...}` segments, left to right. */
export function fillPath(route: Route, values: string[]): string {
  let index = 0;
  return route.path.replace(/\{[^}]+\}/g, () => encodeURIComponent(values[index++]));
}
