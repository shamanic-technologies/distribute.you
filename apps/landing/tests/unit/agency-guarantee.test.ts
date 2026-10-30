import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { AGENCY_GUARANTEE, GUARANTEE_FAQ, renderGtmAgencyPage } from "../../src/lib/pages/gtm-agency";
import { renderColdEmailAgencyPage } from "../../src/lib/pages/cold-email-agency";
import { renderAppointmentSettingAgencyPage } from "../../src/lib/pages/appointment-setting-agency";
import { renderLeadGenerationAgencyPage } from "../../src/lib/pages/lead-generation-agency";
import { renderPpcAgencyPage } from "../../src/lib/pages/ppc-agency";
import { renderDatabaseReactivationAgencyPage } from "../../src/lib/pages/database-reactivation-agency";
import { renderCustomerSuccessAgencyPage } from "../../src/lib/pages/customer-success-agency";

/**
 * AGENCY-GUARANTEE-1030 (owner 2026-10-30, option A): the Agency offer carries the owner's
 * guarantee, "6 booked meetings in 3 months or your paid media budget back" (wording
 * owner-approved 2026-10-13). /terms states it for Agency plans started on or after
 * 2026-10-29; the pages that sell meetings show it on the price card and in the FAQ. The
 * pages whose outcome is not meetings (PPC, reactivation, customer success) do not.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

vi.mock("@/lib/blog/db", () => ({ listArticles: vi.fn(async () => []) }));

const WORDS = "6 booked meetings in 3 months or your paid media budget back.";

describe("the Agency guarantee", () => {
  it("is the owner's wording, verbatim", () => {
    expect(AGENCY_GUARANTEE).toBe(WORDS);
    expect(GUARANTEE_FAQ.a).toContain(WORDS);
  });

  const meetings: [string, () => string][] = [
    ["/gtm-agency", () => renderGtmAgencyPage(null, null)],
    ["/cold-email-agency", () => renderColdEmailAgencyPage(null, null)],
    ["/appointment-setting-agency", () => renderAppointmentSettingAgencyPage(null)],
    ["/lead-generation-agency", () => renderLeadGenerationAgencyPage(null, null)],
  ];
  for (const [p, render] of meetings) {
    it(`${p} shows it on the price card and in the FAQ`, () => {
      const html = render();
      const card = html.slice(html.indexOf('id="price"'), html.indexOf("data-agency-calc"));
      expect(card).toContain('class="ag-guar"');
      expect(card).toContain("<b>6 booked meetings in 3 months</b> or your paid media budget back.");
      expect(card).toContain('href="/terms"');
      expect(html).toContain(`<summary>${GUARANTEE_FAQ.q}</summary>`);
    });
  }

  const others: [string, () => string][] = [
    ["/ppc-agency", () => renderPpcAgencyPage(null, null)],
    ["/database-reactivation-agency", () => renderDatabaseReactivationAgencyPage(null)],
    ["/customer-success-agency", () => renderCustomerSuccessAgencyPage()],
  ];
  for (const [p, render] of others) {
    it(`${p} does not show it: its outcome is not meetings`, () => {
      const html = render();
      expect(html).not.toContain('class="ag-guar"');
      expect(html).not.toContain("paid media budget back");
    });
  }

  it("/terms states it for Agency plans started on or after 2026-10-29, with the managed plan's conditions", () => {
    const terms = read("src/app/terms/page.tsx");
    expect(terms).toContain("<strong>GTM agency guarantee.</strong> On a GTM agency plan started");
    expect(terms).toContain("on or after October 29, 2026, we promise 6 booked meetings in 3\n          months or your paid media budget back.");
    expect(terms).toContain("and we refund 100% of the campaign budget you paid (your paid media\n          budget). Service fees are not refunded.");
    expect(terms).toContain("offer carries no guarantee.");
    expect(terms).toContain("Payments are final and are not");
  });
});
