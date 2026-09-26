import channels from "./public-channels.json";
import campaigns from "./campaigns.json";
import budgets from "./budgets.json";
import econ from "./econ.json";
import features from "./features.json";
import projection from "./projection.json";
const routes: [RegExp, unknown][] = [
  [/workflow-projection/, projection],
  [/\/brands\/[^/]+\/offers(\?|$)/, { offers: [{ id: "d5ecba00-783a-4939-b5bd-f85b9e6b7d9e", name: "Doc Dinners" }] }],
  [/\/api\/public\/catalogue/, { channels, founders: 70, proof: { hotLeads: { hotLeads: 881, companies: 23, medianCostUsd: 6 }, medianReturnPerDollar: 5.2, showcase: [] } }],
  [/\/public\/channels/, channels],
  [/\/brands\/by-ids/, { brands: [{ id: "75d7e3e8-6926-4f85-a557-976895400666", name: "Doc Dinners", domain: "docdinners.com", url: "https://docdinners.com" }] }],
  [/\/campaign-budgets/, budgets],
  [/\/offers\/[^/]+\/economics/, econ],
  [/\/features\/stats\/registry|stats-registry|\/registry/, { registry: {} }],
  [/\/campaigns\?|\/campaigns$/, campaigns],
  [/\/features(\?|$)/, features],
  [/\/brands\/[^/?]+(\?|$)/, { brand: { id: "75d7e3e8-6926-4f85-a557-976895400666", name: "Doc Dinners", domain: "docdinners.com" } }],
];
(globalThis as any).fetch = async (input: RequestInfo, init?: RequestInit) => {
  const url = typeof input === "string" ? input : (input as Request).url;
  for (const [re, body] of routes) if (re.test(url)) return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  console.warn("UNSTUBBED", init?.method ?? "GET", url);
  return new Response(JSON.stringify({ error: "not stubbed" }), { status: 404, headers: { "content-type": "application/json" } });
};
