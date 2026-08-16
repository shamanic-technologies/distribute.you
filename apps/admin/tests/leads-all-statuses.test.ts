import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The staff leads views group leads by consolidated status and expose Skipped,
 * Buffered, Claimed and Served tabs. lead-service's leads list now defaults to
 * the actionable population (`buffered,claimed,served`), so those tabs only stay
 * whole while the admin reads ask for `status=all`.
 *
 * The customer dashboard must NOT ask for it: it buckets purely on engagement
 * evidence, so a skipped lead can never appear under one of its tabs, and
 * dropping those rows is the point of the producer change.
 */
describe('Admin leads reads ask for every lifecycle status', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, p), 'utf-8');
  const adminApi = read('../src/lib/api.ts');
  const reportApi = read('../src/lib/report-api.ts');

  it('names the parameter once in the admin api client', () => {
    expect(adminApi).toContain('const ALL_LEAD_STATUSES = "status=all";');
  });

  it('asks for every status on the brand read', () => {
    expect(adminApi).toContain('`/leads?brandId=${brandId}&${ALL_LEAD_STATUSES}`');
  });

  it('asks for every status on the campaign read', () => {
    expect(adminApi).toContain('`/leads?campaignId=${campaignId}&${ALL_LEAD_STATUSES}`');
  });

  it('asks for every status on the report read, which renders a Skipped state', () => {
    expect(reportApi).toContain('&status=all');
  });

  it('leaves the customer dashboard reads without a status parameter', () => {
    const dashboardApi = read('../../dashboard/src/lib/api.ts');
    const leadsReads = dashboardApi
      .split('\n')
      .filter((line) => line.includes('apiCall<unknown>(`/leads?'));
    expect(leadsReads.length).toBeGreaterThan(0);
    for (const line of leadsReads) {
      expect(line).not.toContain('status=');
    }
  });
});

/**
 * lead-service v0.52.0 started honouring `limit` on the leads list, which turned
 * the report's decorative `limit=50` into a real first page under a heading that
 * says "Every prospect considered". The bound is off that call for good; sizing
 * this page properly is a slim list plus a per-lead read for the panel.
 */
describe('The public report leads read is not bounded', () => {
  const reportApi = fs.readFileSync(path.join(__dirname, '../src/lib/report-api.ts'), 'utf-8');
  const at = reportApi.indexOf('export async function fetchLeads(');
  const body = reportApi.slice(at, reportApi.indexOf('\n}', at));

  it('sends no limit on the leads call', () => {
    expect(at).toBeGreaterThan(-1);
    expect(body).toContain('`/leads?brandId=${brandId}&status=all`');
    expect(body).not.toContain('limit=');
  });
});
