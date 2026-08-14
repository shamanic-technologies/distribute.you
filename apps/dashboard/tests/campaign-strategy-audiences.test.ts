import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Campaign-level Audiences (v2 staff preview).
 *
 * The campaign sidebar used to link Strategy and Audiences to the BRAND pages,
 * leaving the campaign context entirely. The Strategy page was retired (its offer
 * card moved to Brand Settings), so the campaign sidebar keeps only the Audiences
 * view under the campaign, reading campaign-scoped data wherever campaign-service
 * stores a per-campaign value: the targeted audience subset
 * (`campaign.audienceIds`) and the per-audience stats (`?campaignId=`). Every
 * other surface on those pages is brand config the campaign inherits, so it
 * keeps rendering the brand's value.
 */

const read = (p: string) => fs.readFileSync(path.join(__dirname, p), 'utf-8');

const CAMPAIGN_BASE = '../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]';
const BRAND_BASE = '../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]';

describe('campaign-level Audiences route', () => {
  it('the campaign audiences route scopes to the campaign in the path', () => {
    const src = read(`${CAMPAIGN_BASE}/audiences/page.tsx`);
    expect(src).toContain('params.id as string');
    expect(src).toContain('<CustomerAudiencesPage campaignId={campaignId} />');
  });

  it('the BRAND audiences route stays brand-wide — no campaign scope', () => {
    const audiences = read(`${BRAND_BASE}/audiences/page.tsx`);
    expect(audiences).toContain('<CustomerAudiencesPage />');
    expect(audiences).not.toContain('campaignId');
  });

  it('the campaign sidebar keeps Audiences inside the campaign and has no Strategy', () => {
    const src = read('../src/components/context-sidebar.tsx');
    const at = src.indexOf('function CampaignLevelSidebar(');
    expect(at).toBeGreaterThan(-1);
    // Measured: the item list ends well inside 1600 chars of the signature.
    const body = src.slice(at, at + 1600);
    expect(body).toContain('href: `${campaignBase}/audiences`');
    expect(body).not.toContain('href: `${campaignBase}/strategy`');
    expect(body).not.toContain('href: `${basePath}/strategy`');
    expect(body).not.toContain('href: `${basePath}/audiences`');
  });
});

describe('Audiences page under a campaign', () => {
  const src = read('../src/components/audiences/customer-audiences-page.tsx');

  it('takes an optional campaignId and reads the campaign on the shared key', () => {
    expect(src).toContain('campaignId?: string');
    expect(src).toContain('["campaign", campaignId ?? "none"]');
  });

  it('prefers the campaign goal over the brand goal', () => {
    expect(src).toContain('optimizationGoalForRuntimeGoal(campaign.goal)');
  });

  it('filters every status list to the campaign audience subset', () => {
    expect(src).toContain('campaign?.audienceIds ?? null');
    expect(src).toContain('scopeToCampaign');
  });

  it('asks features-service for THIS campaign outreach, on its own cache key', () => {
    const at = src.indexOf('"featureAudienceStats"');
    expect(at).toBeGreaterThan(-1);
    // Measured: 823 chars from the query key to the end of `campaignId,`. The block
    // grew when the brand read stopped naming a goal — a `toContain` fails when the
    // slice is too SHORT (the target gets cut out), so this is measured, not guessed.
    const body = src.slice(at, at + 900);
    expect(body).toContain('campaignScopeKey');
    expect(body).toContain('campaignId,');
    // A campaign names its FUNNEL; the brand-level read names neither it nor a goal.
    expect(body).toContain('funnel: campaignFunnelKey');
    expect(body).toContain('brandLevelMoney');
  });

  it('says the audiences are the brand shared set, not the campaign own', () => {
    expect(src).toContain('shared by every campaign');
  });
});
