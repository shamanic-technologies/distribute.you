import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Regression test: campaign leads must use GET /leads?campaignId={id},
 * not the removed GET /campaigns/{id}/leads (deleted in PR #311).
 */
describe('Campaign leads endpoint', () => {
  const apiFile = path.join(__dirname, '../src/lib/api.ts');
  const content = fs.readFileSync(apiFile, 'utf-8');

  it('should call /leads?campaignId= instead of /campaigns/{id}/leads', () => {
    const hasOldEndpoint = /\/campaigns\/[^/]+\/leads/.test(content);
    expect(hasOldEndpoint, 'api.ts still references the removed /campaigns/{id}/leads route').toBe(false);
  });

  it('should have a listCampaignLeads that uses the query-param endpoint', () => {
    expect(content).toContain('/leads?campaignId=');
  });
});
