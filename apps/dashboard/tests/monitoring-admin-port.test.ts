import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";

/**
 * MONITORING-ADMIN-PORT-1019: the admin cold-email pages live in Monitoring > Emails (owner
 * 2026-10-19: one home for our monitoring charts). Each ported page is routed, listed on the hub,
 * mounted, and reachable from the tenant-free `/v2/monitoring/<page>` entry the old admin URLs
 * redirect to.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const PORTED = ["emails/capacity", "emails/blocklists", "emails/threads", "emails/rules"] as const;

describe("Monitoring > Emails: pages ported from the admin cold-email audit", () => {
  const page = read("components/v2/monitoring-page.tsx");

  it("every ported page is a Monitoring page, chipped on the hub and mounted", () => {
    for (const p of PORTED) {
      expect(MONITORING_PAGES).toContain(p);
      expect(parseMonitoringPath(`/${p}`)).toEqual({ view: "page", page: p });
      expect(page).toContain(`href={href("${p}")}`);
      expect(page).toContain(`view.page === "${p}" &&`);
    }
    expect(page).toContain("<DomainsEstate base={base} />");
    expect(page).toContain("<MailboxesSummary />");
  });

  it("an entity page carries its details blocks under the facts", () => {
    const drill = read("components/v2/monitoring-drilldown.tsx");
    expect(drill).toContain('kind === "domain" ? <DomainDetails base={base} id={id} />');
    expect(drill).toContain("<MailboxDetails base={base} id={id} />");
    expect(drill).toContain("<AccountDetails base={base} id={id} />");
  });

  it("the tenant-free entry lands on the same Monitoring page under the last brand", () => {
    const entry = read("app/(authed)/v2/monitoring/[[...path]]/page.tsx");
    expect(entry).toContain("lastBrandCookieName(orgId)");
    expect(entry).toContain("/monitoring${rest ? `/${rest}` : \"\"}");
  });

  it("every new staff read stays off disk", () => {
    const persist = read("lib/persist-cache.ts");
    for (const r of ["staffDomainBlocklist", "staffLeadSourceYield", "staffOpsThreads", "staffOpsThreadMessages", "staffOpsInfra", "staffSendForecast", "staffCapacityHistory", "staffReconcile", "staffInfraSpend"]) {
      expect(persist).toContain(`"${r}",`);
    }
  });
});
