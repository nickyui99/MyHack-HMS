-- Read-only checks for the CareLink demo database.
-- Run after 001_init.sql and 002_seed_demo.sql.

SELECT 'actors_count' AS check_name, COUNT(*)::TEXT AS value
FROM actors;

SELECT 'cases_count' AS check_name, COUNT(*)::TEXT AS value
FROM cases;

SELECT 'relationships_count' AS check_name, COUNT(*)::TEXT AS value
FROM relationships;

SELECT 'match_runs_count' AS check_name, COUNT(*)::TEXT AS value
FROM match_runs;

SELECT 'audit_logs_count' AS check_name, COUNT(*)::TEXT AS value
FROM audit_logs;

SELECT
    'expired_apc_demo_actor' AS check_name,
    CASE
        WHEN COUNT(*) = 1 THEN 'ok'
        ELSE 'missing'
    END AS value
FROM actors
WHERE name = 'Dr Expired APC Demo'
  AND apc_expiry_date < CURRENT_DATE;

SELECT
    'compliance_blocked_relationship' AS check_name,
    CASE
        WHEN COUNT(*) >= 1 THEN 'ok'
        ELSE 'missing'
    END AS value
FROM relationships
WHERE state = 'compliance_blocked'
  AND compliance_status = 'blocked';

SELECT
    'encik_zainal_relationships' AS check_name,
    COUNT(*)::TEXT AS value
FROM relationships
WHERE case_id = '10000000-0000-4000-8000-000000000001';

SELECT
    c.patient_name,
    r.relationship_type,
    source_actor.name AS actor_a,
    target_actor.name AS actor_b,
    r.state,
    r.compliance_status,
    r.match_score
FROM relationships r
JOIN cases c ON c.id = r.case_id
JOIN actors source_actor ON source_actor.id = r.actor_a_id
JOIN actors target_actor ON target_actor.id = r.actor_b_id
WHERE c.id = '10000000-0000-4000-8000-000000000001'
ORDER BY r.relationship_type, target_actor.name;
