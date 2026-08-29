-- Data cleanup rollback:
-- Reopening stale router campaigns would reintroduce the production defect, so
-- this rollback is intentionally a no-op. Campaign rows keep their historical
-- metadata and closed_reason for auditability.
select 1;
