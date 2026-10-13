-- The article's case: one client's ICP screen on one Apollo audience, read-only, read 2026-10-13.
-- 1) lead_service: docker exec -i distribute-postgres-1 psql -U postgres -d lead_service < case.sql
SELECT count(*) AS screened, count(*) FILTER (WHERE verdict = 'pass') AS kept,
       count(*) FILTER (WHERE verdict = 'pass' AND yes_probability >= 0.8) AS kept_sure
FROM candidate_screenings WHERE audience_id = '729e06f0-26ee-4950-8c71-54d5b7e42b27';
-- the ICP sentence Jev read, and each person's verdict and probability of fit
SELECT DISTINCT target_text FROM candidate_screenings WHERE audience_id = '729e06f0-26ee-4950-8c71-54d5b7e42b27';
SELECT candidate_id, verdict, round(yes_probability::numeric, 2), company_name FROM candidate_screenings WHERE audience_id = '729e06f0-26ee-4950-8c71-54d5b7e42b27';
-- 2) human_service (run separately, -d human_service): the Apollo filters on the audience, and each
-- candidate's title, joined to the verdicts above on candidate_id = audience_candidates.id
-- SELECT name, filters FROM audiences WHERE id = '729e06f0-26ee-4950-8c71-54d5b7e42b27';
-- SELECT id, teaser->>'title', teaser->>'organizationName' FROM audience_candidates WHERE audience_id = '729e06f0-26ee-4950-8c71-54d5b7e42b27';
