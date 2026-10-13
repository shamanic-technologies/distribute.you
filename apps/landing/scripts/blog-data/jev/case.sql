-- The article's case: one client's ICP screen, read-only, read 2026-10-13.
-- 1) lead_service: docker exec -i distribute-postgres-1 psql -U postgres -d lead_service < case.sql
SELECT count(*) AS screened, count(*) FILTER (WHERE verdict = 'pass') AS kept
FROM candidate_screenings
WHERE org_id = '5fefaf5a-8d50-4c5f-aa4b-3d35bcd1de93'
  AND target_text LIKE 'Owners, clinic owners, founders and co-founders of chiropractic clinics%';
-- the ICP sentence Jev read (target_text), and each person's verdict and probability of fit
SELECT DISTINCT target_text FROM candidate_screenings
WHERE org_id = '5fefaf5a-8d50-4c5f-aa4b-3d35bcd1de93'
  AND target_text LIKE 'Owners, clinic owners, founders and co-founders of chiropractic clinics%';
SELECT candidate_id, verdict, round(yes_probability::numeric, 2), company_name FROM candidate_screenings
WHERE org_id = '5fefaf5a-8d50-4c5f-aa4b-3d35bcd1de93'
  AND target_text LIKE 'Owners, clinic owners, founders and co-founders of chiropractic clinics%';
-- 2) human_service (run separately, -d human_service): the Apollo filters set on the three audiences,
-- and each candidate's title, joined to the verdicts above on candidate_id = audience_candidates.id
-- SELECT id, name, filters FROM audiences WHERE id IN ('2d4e2867-96c7-45c8-adc9-08a50e3d66c9','6e94a3b5-6186-4c1f-9711-122d71f29f3d','cfaf7fd9-f32e-4a51-90ab-e655fc19f8d3');
-- SELECT id, teaser->>'title' FROM audience_candidates WHERE audience_id IN (same three ids);
