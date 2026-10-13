-- The article's case: one client's ICP screen (lead-service, read-only), read 2026-10-13.
-- Run on the box: docker exec -i distribute-postgres-1 psql -U postgres -d lead_service < case.sql
SELECT count(*) AS screened, count(*) FILTER (WHERE verdict = 'pass') AS matched
FROM candidate_screenings
WHERE org_id = '5fefaf5a-8d50-4c5f-aa4b-3d35bcd1de93'
  AND target_text LIKE 'Owners, clinic owners, founders and co-founders of chiropractic clinics%';
