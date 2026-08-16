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
