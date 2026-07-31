import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Campaign-level Strategy + Audiences (v2 staff preview).
 *
 * The campaign sidebar used to link Strategy and Audiences to the BRAND pages,
 * leaving the campaign context entirely. They now live under the campaign and
 * read campaign-scoped data wherever campaign-service stores a per-campaign
 * value: the goal (`campaign.goal`), the targeted audience subset
 * (`campaign.audienceIds`) and the per-audience stats (`?campaignId=`). Every
 * other surface on those pages is brand config the campaign inherits, so it
 * keeps rendering the brand's value.
 *
 * The one that needs a guard is the Hormozi offer: there is NO per-campaign
 * column for the 7 user-fields, so the campaign view is a PREVIEW. Saving from
 * there would write the BRAND's offer from a campaign screen — a control that
 * lies about what it touches.
 */

const read = (p: string) => fs.readFileSync(path.join(__dirname, p), 'utf-8');

const CAMPAIGN_BASE = '../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/[id]';
const BRAND_BASE = '../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]';

describe('campaign-level Strategy + Audiences routes', () => {
  it('the campaign strategy route scopes to the campaign in the path', () => {
    const src = read(`${CAMPAIGN_BASE}/strategy/page.tsx`);
    expect(src).toContain('params.id as string');
    expect(src).toContain('<StrategyPage campaignId={campaignId} />');
  });

  it('the campaign audiences route scopes to the campaign in the path', () => {
    const src = read(`${CAMPAIGN_BASE}/audiences/page.tsx`);
    expect(src).toContain('params.id as string');
    expect(src).toContain('<CustomerAudiencesPage campaignId={campaignId} />');
  });

  it('the BRAND routes stay brand-wide — no campaign scope', () => {
    const strategy = read(`${BRAND_BASE}/strategy/page.tsx`);
    const audiences = read(`${BRAND_BASE}/audiences/page.tsx`);
    expect(strategy).toContain('<StrategyPage />');
    expect(strategy).not.toContain('campaignId');
    expect(audiences).toContain('<CustomerAudiencesPage />');
    expect(audiences).not.toContain('campaignId');
  });

  it('the campaign sidebar keeps Strategy + Audiences inside the campaign', () => {
    const src = read('../src/components/context-sidebar.tsx');
    const at = src.indexOf('function CampaignLevelSidebar(');
    expect(at).toBeGreaterThan(-1);
    // Measured: the item list ends well inside 1600 chars of the signature.
    const body = src.slice(at, at + 1600);
    expect(body).toContain('href: `${campaignBase}/strategy`');
    expect(body).toContain('href: `${campaignBase}/audiences`');
    expect(body).not.toContain('href: `${basePath}/strategy`');
    expect(body).not.toContain('href: `${basePath}/audiences`');
  });
});

describe('Strategy page under a campaign', () => {
  const src = read('../src/components/strategy/strategy-page.tsx');

  it('takes an optional campaignId and reads the campaign on the shared key', () => {
    expect(src).toContain('campaignId?: string');
    // Byte-equal to the campaign Overview + the header page context, so React
    // Query serves all three from one poll.
    expect(src).toContain('["campaign", campaignId ?? "none"]');
  });

  it('prefers the campaign goal over the brand goal', () => {
    expect(src).toContain('optimizationGoalForRuntimeGoal(campaign.goal)');
  });

  it('lists only the audiences the campaign targets', () => {
    expect(src).toContain('campaign?.audienceIds ?? null');
  });

  it('the offer is a PREVIEW under a campaign — it never writes the brand', () => {
    const at = src.indexOf('const saveOffer = () => {');
    expect(at).toBeGreaterThan(-1);
    // Measured: the function body closes 318 chars from the signature.
    const body = src.slice(at, at + 360);
    expect(body).toContain('campaignScoped');
    expect(src).toContain('Preview only. Nothing here is saved yet.');
  });

  it('the Save button is not rendered under a campaign', () => {
    expect(src).toContain('offerDirty && !campaignScoped');
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
    // Measured: the query key + the fetch call fit in 520 chars.
    const body = src.slice(at, at + 520);
    expect(body).toContain('campaignScopeKey');
    expect(body).toContain('campaignId,');
  });

  it('says the audiences are the brand shared set, not the campaign own', () => {
    expect(src).toContain('shared by every campaign');
  });
});
