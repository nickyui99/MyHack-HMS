CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    specialty TEXT,
    subspecialty TEXT,
    hospital TEXT,
    department TEXT,
    location TEXT,
    insurance_panels TEXT[] DEFAULT '{}',
    languages TEXT[] DEFAULT '{}',
    credentials JSONB NOT NULL DEFAULT '{}',
    apc_number TEXT,
    apc_expiry_date DATE,
    capacity_status TEXT NOT NULL DEFAULT 'available',
    capacity_notes TEXT,
    outcome_weight NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    profile_text TEXT,
    embedding VECTOR(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name TEXT NOT NULL,
    patient_age INTEGER,
    patient_gender TEXT,
    diagnosis TEXT NOT NULL,
    case_stage TEXT NOT NULL,
    payer TEXT,
    location TEXT,
    urgency TEXT,
    clinical_context JSONB NOT NULL DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id),
    relationship_type TEXT NOT NULL,
    actor_a_id UUID NOT NULL REFERENCES actors(id),
    actor_b_id UUID NOT NULL REFERENCES actors(id),
    state TEXT NOT NULL DEFAULT 'proposed',
    compliance_status TEXT NOT NULL DEFAULT 'pending',
    compliance_flags JSONB NOT NULL DEFAULT '{}',
    match_score NUMERIC(6,2),
    score_breakdown JSONB NOT NULL DEFAULT '{}',
    case_context JSONB NOT NULL DEFAULT '{}',
    outcome_record JSONB,
    created_by TEXT,
    approved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id UUID REFERENCES relationships(id),
    case_id UUID REFERENCES cases(id),
    action TEXT NOT NULL,
    previous_state TEXT,
    next_state TEXT,
    actor_user TEXT,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id),
    match_type TEXT NOT NULL,
    input_context JSONB NOT NULL DEFAULT '{}',
    recommended_actor_ids UUID[] DEFAULT '{}',
    recommended_relationship_ids UUID[] DEFAULT '{}',
    score_breakdown JSONB NOT NULL DEFAULT '{}',
    compliance_summary JSONB NOT NULL DEFAULT '{}',
    explanation TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actors_role ON actors(role);
CREATE INDEX IF NOT EXISTS idx_actors_specialty ON actors(specialty);
CREATE INDEX IF NOT EXISTS idx_actors_capacity_status ON actors(capacity_status);
CREATE INDEX IF NOT EXISTS idx_actors_apc_expiry_date ON actors(apc_expiry_date);
CREATE INDEX IF NOT EXISTS idx_cases_stage ON cases(case_stage);
CREATE INDEX IF NOT EXISTS idx_relationships_case_id ON relationships(case_id);
CREATE INDEX IF NOT EXISTS idx_relationships_state ON relationships(state);
CREATE INDEX IF NOT EXISTS idx_relationships_actor_a ON relationships(actor_a_id);
CREATE INDEX IF NOT EXISTS idx_relationships_actor_b ON relationships(actor_b_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_relationship_id ON audit_logs(relationship_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_case_id ON audit_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_match_runs_case_id ON match_runs(case_id);

-- Create this after embeddings are loaded and ANALYZE has run:
-- CREATE INDEX idx_actors_embedding
-- ON actors
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);
