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

  /**
   * Both lead readers ask for the slim projection. The full projection is what
   * the campaign-scoped read used to send, back when a campaign scope meant one
   * stored campaign row and a handful of leads. lead-service now answers a
   * campaign read for the whole campaign IDENTITY, so its size matches the
   * brand's: measured 53,777 rows / 156 MB / 54s full, against 102 MB / 6.6s
   * slim, on one production brand. The page polls this every 30 seconds.
   */
  it('asks for the slim projection on BOTH the campaign and the brand read', () => {
    expect(content).toContain('/leads?campaignId=${campaignId}&view=basic');
    expect(content).toContain('/leads?brandId=${brandId}&view=basic');
  });
});
