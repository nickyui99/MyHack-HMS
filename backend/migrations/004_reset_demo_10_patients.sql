-- CareLink demo reset: wipe patient-side data and reseed 10 patients,
-- each with a DIFFERENT recommended doctor (match_run).
-- Actors are kept intact (50 staff seeded by 002_seed_demo.sql).
-- Safe to rerun.

BEGIN;

-- DELETE (not TRUNCATE) so it works under DML-only grants for the runtime IAM user.
-- Order respects FKs: audit_logs -> relationships, relationships -> cases, match_runs -> cases.
DELETE FROM audit_logs;
DELETE FROM match_runs;
DELETE FROM relationships;
DELETE FROM cases;

-- 10 patient cases
INSERT INTO cases (id, patient_name, patient_age, patient_gender, diagnosis, case_stage, payer, location, urgency, clinical_context, created_by)
VALUES
    ('10000000-0000-4000-8000-000000000001', 'Encik Zainal Abidin',   58, 'male',   'NSTEMI progressing to CABG',          'referral', 'Prudential BSN', 'Puchong',       'urgent',      '{"troponin":"elevated","risk_factors":["diabetes","hypertension"],"procedure":"CABG"}', 'local.member2@carelink.test'),
    ('10000000-0000-4000-8000-000000000002', 'Puan Mariam Yusof',     66, 'female', 'Heart failure exacerbation',          'referral', 'AIA',            'Subang Jaya',   'semi_urgent', '{"symptoms":["dyspnoea","ankle swelling"],"preferred_language":"Malay"}', 'local.member2@carelink.test'),
    ('10000000-0000-4000-8000-000000000003', 'Mr Tan Kok Wai',        49, 'male',   'Atrial fibrillation with RVR',        'referral', 'Great Eastern',  'Kelana Jaya',   'urgent',      '{"ecg":"AF rate 142","needs":"electrophysiology review"}', 'local.member2@carelink.test'),
    ('10000000-0000-4000-8000-000000000004', 'Mr Raj Kumar',          62, 'male',   'Diabetic cardiomyopathy',             'referral', 'Prudential BSN', 'Petaling Jaya', 'semi_urgent', '{"hba1c":9.8,"risk_factors":["diabetes","obesity"],"needs":"endocrinology co-management"}', 'local.member2@carelink.test'),
    ('10000000-0000-4000-8000-000000000005', 'Puan Aminah Hashim',    71, 'female', 'Cardiorenal syndrome',                'referral', 'AIA',            'Shah Alam',     'urgent',      '{"creatinine":3.2,"egfr":22,"needs":"nephrology review"}', 'local.member2@carelink.test'),
    ('10000000-0000-4000-8000-000000000006', 'Mr Lee Ming Hui',       68, 'male',   'Post-op respiratory failure',         'surgical_team', 'Great Eastern', 'Bandar Sunway','urgent',  '{"ventilator":"BiPAP","needs":"respiratory weaning"}', 'coordinator@carelink.test'),
    ('10000000-0000-4000-8000-000000000007', 'Ms Siti Khadijah',      54, 'female', 'Suspected CAD for imaging',           'referral', 'Prudential BSN', 'Bandar Sunway', 'routine',     '{"symptoms":["atypical chest pain"],"needs":"cardiac CT"}', 'local.member2@carelink.test'),
    ('10000000-0000-4000-8000-000000000008', 'Encik Ganesh Pillai',   60, 'male',   'Cardiogenic shock — ICU stabilisation','surgical_team', 'AIA',          'Bandar Sunway', 'urgent',      '{"inotropes":"noradrenaline","needs":"intensivist lead"}', 'coordinator@carelink.test'),
    ('10000000-0000-4000-8000-000000000009', 'Puan Faridah Omar',     57, 'female', 'Mitral valve disease — echo review',  'referral', 'Allianz',        'Bandar Sunway', 'semi_urgent', '{"murmur":"pansystolic","needs":"cardiac imaging"}', 'local.member2@carelink.test'),
    ('10000000-0000-4000-8000-000000000010', 'Mr Wong Cheng Hock',    64, 'male',   'Triple-vessel disease — CABG workup', 'referral', 'Prudential BSN', 'Bandar Sunway', 'urgent',      '{"angio":"3VD","needs":"interventional cardiologist + surgery handover"}', 'local.member2@carelink.test')
ON CONFLICT (id) DO UPDATE SET
    patient_name = EXCLUDED.patient_name,
    patient_age = EXCLUDED.patient_age,
    patient_gender = EXCLUDED.patient_gender,
    diagnosis = EXCLUDED.diagnosis,
    case_stage = EXCLUDED.case_stage,
    payer = EXCLUDED.payer,
    location = EXCLUDED.location,
    urgency = EXCLUDED.urgency,
    clinical_context = EXCLUDED.clinical_context,
    created_by = EXCLUDED.created_by,
    updated_at = now();

-- 10 match_runs, each recommending a DIFFERENT doctor as the top match.
-- recommended_actor_ids[0] is the headline pick shown in the demo.
INSERT INTO match_runs (id, case_id, match_type, input_context, recommended_actor_ids, recommended_relationship_ids, score_breakdown, compliance_summary, explanation, created_by)
VALUES
    ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'referral',
        '{"prompt":"58M suspected NSTEMI, Prudential BSN, Puchong. Who should we refer to?"}',
        ARRAY['00000000-0000-4000-8000-000000000005'::UUID,'00000000-0000-4000-8000-000000000006'::UUID,'00000000-0000-4000-8000-000000000050'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.95,"rule_compliance":1.00,"outcome_weight":0.93}',
        '{"status":"passed","blocked_reasons":[]}',
        'Dr Farah Nabila (interventional cardiologist, Sunway) is the top NSTEMI match — Prudential BSN panel, valid APC, strong NSTEMI outcomes.',
        'local.member2@carelink.test'),
    ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'referral',
        '{"prompt":"66F heart failure exacerbation, AIA, Subang Jaya."}',
        ARRAY['00000000-0000-4000-8000-000000000007'::UUID,'00000000-0000-4000-8000-000000000005'::UUID,'00000000-0000-4000-8000-000000000050'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.88,"rule_compliance":1.00,"outcome_weight":0.82}',
        '{"status":"passed","blocked_reasons":[]}',
        'Dr Kelvin Wong (heart failure cardiologist, Pantai KL) is the top match — AIA panel, heart failure subspecialty, available.',
        'local.member2@carelink.test'),
    ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'referral',
        '{"prompt":"49M new-onset AF with RVR, Great Eastern, needs EP review."}',
        ARRAY['00000000-0000-4000-8000-000000000008'::UUID,'00000000-0000-4000-8000-000000000007'::UUID,'00000000-0000-4000-8000-000000000005'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.86,"rule_compliance":1.00,"outcome_weight":0.79}',
        '{"status":"passed","blocked_reasons":[]}',
        'Dr Hannah Ong (electrophysiology, Subang Jaya) is the top match — EP subspecialty, valid APC, available today.',
        'local.member2@carelink.test'),
    ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'referral',
        '{"prompt":"62M diabetic cardiomyopathy, HbA1c 9.8, needs endocrinology co-management."}',
        ARRAY['00000000-0000-4000-8000-000000000036'::UUID,'00000000-0000-4000-8000-000000000007'::UUID,'00000000-0000-4000-8000-000000000005'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.84,"rule_compliance":0.90,"outcome_weight":0.80}',
        '{"status":"passed","blocked_reasons":["panel coverage partial — verify Prudential BSN endocrinology rider"]}',
        'Dr Azlan Shah (endocrinologist, Sunway) is the top match for diabetic cardiac co-management — Prudential BSN panel, diabetes subspecialty.',
        'local.member2@carelink.test'),
    ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'referral',
        '{"prompt":"71F cardiorenal syndrome, eGFR 22, AIA, needs nephrology."}',
        ARRAY['00000000-0000-4000-8000-000000000037'::UUID,'00000000-0000-4000-8000-000000000007'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.83,"rule_compliance":0.85,"outcome_weight":0.78}',
        '{"status":"passed","blocked_reasons":["capacity limited — nephrology slots constrained today"]}',
        'Dr Victor Chan (nephrologist, Sunway) is the top match — renal risk subspecialty, AIA panel, available for review.',
        'local.member2@carelink.test'),
    ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'referral',
        '{"prompt":"68M post-op respiratory failure, needs ICU weaning support."}',
        ARRAY['00000000-0000-4000-8000-000000000038'::UUID,'00000000-0000-4000-8000-000000000044'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.81,"rule_compliance":1.00,"outcome_weight":0.83}',
        '{"status":"passed","blocked_reasons":[]}',
        'Dr Marina Bakar (respiratory physician, Sunway) is the top match — ICU weaning subspecialty, valid APC, available.',
        'coordinator@carelink.test'),
    ('30000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007', 'referral',
        '{"prompt":"54F atypical chest pain, suspected CAD, needs cardiac CT."}',
        ARRAY['00000000-0000-4000-8000-000000000043'::UUID,'00000000-0000-4000-8000-000000000050'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.79,"rule_compliance":1.00,"outcome_weight":0.77}',
        '{"status":"passed","blocked_reasons":[]}',
        'Dr Ong Pei Wen (radiologist, Sunway) is the top match for cardiac CT — Prudential BSN panel, cardiac imaging subspecialty.',
        'local.member2@carelink.test'),
    ('30000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000008', 'referral',
        '{"prompt":"60M cardiogenic shock on inotropes, needs intensivist lead."}',
        ARRAY['00000000-0000-4000-8000-000000000044'::UUID,'00000000-0000-4000-8000-000000000038'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.90,"rule_compliance":1.00,"outcome_weight":0.88}',
        '{"status":"passed","blocked_reasons":[]}',
        'Dr Ismail Zain (intensivist, Sunway ICU) is the top match — cardiac ICU subspecialty, AIA panel, available.',
        'coordinator@carelink.test'),
    ('30000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009', 'referral',
        '{"prompt":"57F mitral valve disease, needs echo and cardiac imaging review."}',
        ARRAY['00000000-0000-4000-8000-000000000050'::UUID,'00000000-0000-4000-8000-000000000005'::UUID,'00000000-0000-4000-8000-000000000043'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.85,"rule_compliance":1.00,"outcome_weight":0.81}',
        '{"status":"passed","blocked_reasons":[]}',
        'Dr Grace Lee (cardiac imaging cardiologist, Sunway) is the top match — Allianz panel, cardiac imaging subspecialty, available.',
        'local.member2@carelink.test'),
    ('30000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000010', 'referral',
        '{"prompt":"64M triple-vessel disease, CABG workup, Prudential BSN."}',
        ARRAY['00000000-0000-4000-8000-000000000006'::UUID,'00000000-0000-4000-8000-000000000005'::UUID,'00000000-0000-4000-8000-000000000010'::UUID],
        ARRAY[]::UUID[],
        '{"vector_similarity":0.92,"rule_compliance":0.95,"outcome_weight":0.90}',
        '{"status":"passed","blocked_reasons":["capacity limited — available after 4pm only"]}',
        'Dr Suresh Ramasamy (interventional cardiologist, Sunway) is the top match — Prudential BSN panel, strong CABG handover outcomes with Dr Suresh Menon.',
        'local.member2@carelink.test')
ON CONFLICT (id) DO UPDATE SET
    case_id = EXCLUDED.case_id,
    match_type = EXCLUDED.match_type,
    input_context = EXCLUDED.input_context,
    recommended_actor_ids = EXCLUDED.recommended_actor_ids,
    recommended_relationship_ids = EXCLUDED.recommended_relationship_ids,
    score_breakdown = EXCLUDED.score_breakdown,
    compliance_summary = EXCLUDED.compliance_summary,
    explanation = EXCLUDED.explanation,
    created_by = EXCLUDED.created_by;

COMMIT;

-- Sanity
SELECT 'cases'         AS table, COUNT(*) AS n FROM cases
UNION ALL SELECT 'match_runs', COUNT(*) FROM match_runs
UNION ALL SELECT 'relationships', COUNT(*) FROM relationships
UNION ALL SELECT 'audit_logs',   COUNT(*) FROM audit_logs
UNION ALL SELECT 'actors',       COUNT(*) FROM actors;
