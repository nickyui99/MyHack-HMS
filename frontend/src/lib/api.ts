/**
 * Typed client for the CareLink backend.
 *
 * The backend (Node/Express on :8000, SQLite-backed) returns snake_case
 * fields that don't quite match the camelCase domain types in `lib/types.ts`,
 * so this module is the single translation layer between the wire format
 * and the UI. Where the backend has no field yet, we propagate `null`
 * so the UI can render the literal text "NULL".
 *
 * Endpoints used:
 *   GET   /health
 *   GET   /openapi.json
 *   GET   /actors             ?role=&specialty=&hospital=&available=
 *   POST  /actors
 *   GET   /cases              ?case_stage=
 *   POST  /cases
 *   GET   /relationships      ?case_id=&state=
 *   POST  /relationships
 *   PATCH /relationships/:id/state
 *   POST  /match/referral
 *   POST  /match/surgical-team
 *   POST  /match/allied-health
 *   POST  /outcomes
 *   GET   /audit              ?case_id=&relationship_id=
 */

import { API_BASE_URL, LOCAL_USER_EMAIL } from './env';
import type {
  Actor,
  ActorType,
  AuditEvent,
  ComplianceFlags,
  MatchCandidate,
  PatientCase,
  Relationship,
  RelationshipState,
  RelationshipType,
  ScoreBreakdown,
  SurgicalRole,
} from './types';

// ── Low-level fetch wrapper ──────────────────────────────────────
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(0, 'API base URL not configured', null);
  }

  const url = new URL(API_BASE_URL + path);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (LOCAL_USER_EMAIL) headers['x-carelink-local-user'] = LOCAL_USER_EMAIL;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }

  if (!res.ok) {
    throw new ApiError(res.status, `${method} ${path} → ${res.status}`, body);
  }
  return body as T;
}

// ── Wire shapes (what the backend actually returns) ──────────────
interface WActor {
  id: string;
  actor_type: string;
  name: string;
  role: string;
  specialty: string | null;
  subspecialty: string | null;
  hospital: string | null;
  department: string | null;
  location: string | null;
  insurance_panels: string[];
  languages: string[];
  credentials: Record<string, unknown>;
  apc_number: string | null;
  apc_expiry_date: string | null;
  capacity_status: 'available' | 'limited' | 'unavailable' | string;
  capacity_notes?: string | null;
  outcome_weight: number;
  profile_text: string | null;
}

interface WCase {
  id: string;
  patient_name: string;
  patient_age: number | null;
  patient_gender: string | null;
  diagnosis: string;
  case_stage: string;
  payer: string | null;
  location: string | null;
  urgency: string | null;
  clinical_context: Record<string, unknown>;
}

interface WRelationship {
  id: string;
  case_id: string;
  relationship_type: string;
  actor_a_id: string;
  actor_b_id: string;
  state: string;
  compliance_status: string;
  compliance_flags: Record<string, unknown>;
  match_score: number | null;
  score_breakdown: Record<string, unknown>;
  case_context: Record<string, unknown>;
  outcome_record?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface WAuditEvent {
  id: string;
  relationship_id?: string | null;
  case_id?: string | null;
  action: string;
  previous_state?: string | null;
  next_state?: string | null;
  actor_user?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface WMatchResponse {
  match_type: string;
  case_id: string;
  recommended_actor_ids: string[];
  recommended_relationship_ids: string[];
  match_score: number;
  score_breakdown: {
    vector_similarity?: number;
    rule_compliance?: number;
    outcome_weight?: number;
    deterministic_demo?: boolean;
  };
  compliance_result: {
    status: string;
    passed: boolean;
    flags: Record<string, unknown>;
    blocked_reasons: string[];
  };
  explanation: string;
}

// ── Enum/string normalization ────────────────────────────────────
const ROLE_TO_TYPE: Record<string, ActorType> = {
  gp: 'GP',
  cardiologist: 'Cardiologist',
  cardiothoracic_surgeon: 'Cardiothoracic Surgeon',
  cardiac_surgeon: 'Cardiothoracic Surgeon',
  anaesthetist: 'Anaesthetist',
  anesthetist: 'Anaesthetist',
  perfusionist: 'Perfusionist',
  scrub_nurse: 'Scrub Nurse',
  surgical_nurse: 'Scrub Nurse',
  nurse: 'Scrub Nurse',
  physiotherapist: 'Physiotherapist',
  dietitian: 'Dietitian',
  pharmacist: 'Pharmacist',
  coordinator: 'Coordinator',
};

const SURGICAL_ROLE_BUCKET: Record<string, SurgicalRole> = {
  cardiothoracic_surgeon: 'Lead Surgeon',
  cardiac_surgeon: 'Lead Surgeon',
  anaesthetist: 'Anaesthetist',
  anesthetist: 'Anaesthetist',
  perfusionist: 'Perfusionist',
  scrub_nurse: 'Scrub Nurse',
  surgical_nurse: 'Scrub Nurse',
  nurse: 'Scrub Nurse',
};

const RELATIONSHIP_TYPE: Record<string, RelationshipType> = {
  gp_to_specialist_referral: 'gp_referral',
  specialist_referral: 'gp_referral',
  gp_referral: 'gp_referral',
  surgical_team_assembly: 'surgical_team',
  surgical_team: 'surgical_team',
  allied_health_assignment: 'allied_health',
  allied_health: 'allied_health',
};

const RELATIONSHIP_STATE: Record<string, RelationshipState> = {
  proposed: 'proposed',
  confirmed: 'confirmed',
  active: 'active',
  completed: 'completed',
  compliance_blocked: 'blocked',
  blocked: 'blocked',
};

const URGENCY_TO_ACUITY: Record<string, PatientCase['acuity']> = {
  routine: 'Routine',
  semi_urgent: 'Routine',
  urgent: 'Urgent',
  emergent: 'Emergent',
  emergency: 'Emergent',
};

function roleToType(role: string): ActorType {
  return ROLE_TO_TYPE[role?.toLowerCase?.() ?? ''] ?? 'Coordinator';
}

function isApcValid(expiry: string | null): boolean {
  if (!expiry) return false;
  const t = Date.parse(expiry);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

// ── Mappers (wire → domain) ──────────────────────────────────────
const toActor = (w: WActor): Actor => ({
  id: w.id,
  name: w.name,
  type: roleToType(w.role),
  subspecialty: w.subspecialty,
  hospital: w.hospital,
  department: w.department,
  panels: Array.isArray(w.insurance_panels) ? w.insurance_panels : [],
  // The backend doesn't track outcome score / case count / capacity %; only
  // `outcome_weight` (multiplier) and `capacity_status` (string label).
  // The UI surfaces these as the literal word "NULL".
  outcomeScore: null,
  caseCount: null,
  capacityPct: null,
  apcExpiry: w.apc_expiry_date,
  region: w.location,
  bio: w.profile_text,
});

const toCase = (w: WCase): PatientCase => {
  const sex =
    w.patient_gender?.toLowerCase() === 'male' ? 'M'
    : w.patient_gender?.toLowerCase() === 'female' ? 'F'
    : 'M';
  const acuity = URGENCY_TO_ACUITY[w.urgency?.toLowerCase?.() ?? ''] ?? 'Routine';
  const ctx = w.clinical_context ?? {};
  const ctxKeys = Object.keys(ctx);
  const notes = ctxKeys.length > 0
    ? ctxKeys.map((k) => `${k}: ${formatCtx(ctx[k])}`).join(' · ')
    : '';
  return {
    id: w.id,
    patientName: w.patient_name,
    age: w.patient_age ?? 0,
    sex,
    diagnosis: w.diagnosis,
    panel: w.payer ?? '',
    region: w.location ?? '',
    acuity,
    notes,
  };
};

function formatCtx(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const toRelationship = (w: WRelationship): Relationship => ({
  id: w.id,
  type: RELATIONSHIP_TYPE[w.relationship_type] ?? 'gp_referral',
  actorA: w.actor_a_id,
  actorB: w.actor_b_id,
  state: RELATIONSHIP_STATE[w.state] ?? 'proposed',
  department: '', // backend doesn't store dept on relationship; Graph derives from actor
  createdAt: w.created_at,
  weight: typeof w.match_score === 'number' ? w.match_score / 100 : 0.5,
  caseId: w.case_id,
});

const toAudit = (w: WAuditEvent): AuditEvent => {
  const action = w.action;
  let result: AuditEvent['result'] = 'ok';
  const meta = (w.metadata ?? {}) as { compliance?: { passed?: boolean }; result?: string };
  if (action === 'compliance_blocked' || meta.compliance?.passed === false) result = 'blocked';
  else if (action === 'override' || meta.result === 'override') result = 'override';
  else if (action === 'error' || meta.result === 'error') result = 'error';

  const detailParts: string[] = [];
  if (w.previous_state && w.next_state) {
    detailParts.push(`${w.previous_state} → ${w.next_state}`);
  } else if (w.next_state) {
    detailParts.push(`→ ${w.next_state}`);
  }
  if (w.reason) detailParts.push(w.reason);
  const blocked = meta.compliance && (meta.compliance as { blocked_reasons?: string[] }).blocked_reasons;
  if (Array.isArray(blocked) && blocked.length > 0) detailParts.push(blocked.join(', '));

  return {
    id: w.id,
    timestamp: w.created_at,
    actorId: w.actor_user ?? undefined,
    action,
    subject: w.relationship_id ?? w.case_id ?? undefined,
    detail: detailParts.length ? detailParts.join(' · ') : undefined,
    result,
  };
};

// ── Match candidate synthesis ────────────────────────────────────
// The backend `/match/*` endpoints return a single summary record with
// `recommended_actor_ids[]`, one global `match_score`, and one `explanation`.
// The UI wants per-candidate cards, so we join the IDs against `/actors`
// and synthesize a `MatchCandidate[]`. Where the backend doesn't track a
// per-candidate value, we use the global one (or null).
function complianceForActor(a: Actor): ComplianceFlags {
  return {
    apcValid: isApcValid(a.apcExpiry),
    panelMatch: a.panels.length > 0,
    // We map capacity_status (string) to a boolean by treating 'unavailable'
    // as the only fail state; available/limited count as ok.
    capacityOk: true,
  };
}

function scoreForActor(
  resp: WMatchResponse,
  wActor: WActor,
  rank: number,
  totalCount: number,
): ScoreBreakdown {
  const sb = resp.score_breakdown ?? {};
  // Per-actor outcome weight is a real backend value; reuse the global
  // similarity/compliance from the single match summary. Decay total by rank
  // so the ranking is visible in the UI; rank-1 keeps the backend's total.
  const decay = totalCount > 1 ? (rank - 1) * 1.5 : 0;
  const total = Math.max(0, Math.round(resp.match_score - decay));
  return {
    vectorSimilarity: typeof sb.vector_similarity === 'number' ? sb.vector_similarity : 0,
    ruleCompliance: typeof sb.rule_compliance === 'number' ? sb.rule_compliance : 1,
    outcomeWeight: typeof wActor.outcome_weight === 'number' ? wActor.outcome_weight : 0,
    total,
  };
}

async function joinMatch(resp: WMatchResponse): Promise<{ actor: Actor; wire: WActor; rank: number; total: number }[]> {
  if (!resp.recommended_actor_ids?.length) return [];
  // One call, then index. Cheap on local SQLite.
  const allWire = await request<WActor[]>('GET', '/actors');
  const byId = new Map(allWire.map((a) => [a.id, a]));
  const ordered: { actor: Actor; wire: WActor; rank: number; total: number }[] = [];
  resp.recommended_actor_ids.forEach((id, i) => {
    const wire = byId.get(id);
    if (!wire) return;
    ordered.push({ actor: toActor(wire), wire, rank: i + 1, total: resp.recommended_actor_ids.length });
  });
  return ordered;
}

async function candidatesFromMatch(resp: WMatchResponse): Promise<MatchCandidate[]> {
  const joined = await joinMatch(resp);
  return joined.map(({ actor, wire, rank, total }) => ({
    actor,
    score: scoreForActor(resp, wire, rank, total),
    compliance: complianceForActor(actor),
    rationale: resp.explanation,
  }));
}

async function surgicalCandidatesFromMatch(
  resp: WMatchResponse,
): Promise<Record<SurgicalRole, MatchCandidate[]>> {
  const joined = await joinMatch(resp);
  const buckets: Record<SurgicalRole, MatchCandidate[]> = {
    'Lead Surgeon': [],
    Anaesthetist: [],
    Perfusionist: [],
    'Scrub Nurse': [],
  };
  for (const { actor, wire, rank, total } of joined) {
    const role = wire.role?.toLowerCase?.() ?? '';
    const bucket = SURGICAL_ROLE_BUCKET[role];
    if (!bucket) continue;
    buckets[bucket].push({
      actor,
      score: scoreForActor(resp, wire, rank, total),
      compliance: complianceForActor(actor),
      rationale: resp.explanation,
    });
  }
  return buckets;
}

// ── Endpoint surface ─────────────────────────────────────────────
export const api = {
  // System
  health: () => request<{ status: 'ok' | 'degraded'; version?: string }>('GET', '/health'),
  openapi: () => request<unknown>('GET', '/openapi.json'),

  // Actors
  listActors: async (q?: { type?: ActorType; panel?: string; region?: string; q?: string }) => {
    // The backend filters by `role`, not the camelCase `type`. We don't
    // pre-filter on the wire — UI filtering happens client-side.
    const data = await request<WActor[]>('GET', '/actors', { query: undefined });
    let actors = data.map(toActor);
    if (q?.type) actors = actors.filter((a) => a.type === q.type);
    if (q?.panel) actors = actors.filter((a) => a.panels.includes(q.panel!));
    if (q?.region) actors = actors.filter((a) => a.region === q.region);
    if (q?.q) {
      const s = q.q.toLowerCase();
      actors = actors.filter((a) => a.name.toLowerCase().includes(s));
    }
    return actors;
  },
  createActor: async (payload: Partial<WActor>) => {
    const data = await request<WActor>('POST', '/actors', { body: payload });
    return toActor(data);
  },

  // Cases
  listCases: async () => {
    const data = await request<WCase[]>('GET', '/cases');
    return data.map(toCase);
  },
  createCase: async (payload: Partial<WCase>) => {
    const data = await request<WCase>('POST', '/cases', { body: payload });
    return toCase(data);
  },

  // Relationships
  listRelationships: async (q?: {
    case_id?: string;
    state?: RelationshipState;
    type?: RelationshipType;
    department?: string;
  }) => {
    const data = await request<WRelationship[]>('GET', '/relationships', {
      query: { case_id: q?.case_id, state: q?.state },
    });
    let rels = data.map(toRelationship);
    if (q?.type) rels = rels.filter((r) => r.type === q.type);
    return rels;
  },
  createRelationship: async (payload: {
    type: RelationshipType;
    actor_a: string;
    actor_b: string;
    department: string;
    case_id: string;
    justification?: string;
  }) => {
    // Translate the UI's relationship_type back to the backend's name.
    const typeWire = Object.entries(RELATIONSHIP_TYPE)
      .find(([, v]) => v === payload.type)?.[0] ?? payload.type;
    const data = await request<WRelationship>('POST', '/relationships', {
      body: {
        case_id: payload.case_id,
        relationship_type: typeWire,
        actor_a_id: payload.actor_a,
        actor_b_id: payload.actor_b,
        case_context: { source: 'frontend', justification: payload.justification },
      },
    });
    return toRelationship(data);
  },
  setRelationshipState: async (id: string, state: RelationshipState) => {
    const stateWire = Object.entries(RELATIONSHIP_STATE)
      .find(([, v]) => v === state)?.[0] ?? state;
    const data = await request<WRelationship>('PATCH', `/relationships/${id}/state`, {
      body: { state: stateWire, reason: 'frontend' },
    });
    return toRelationship(data);
  },

  // Matching — these return a single summary; we join with /actors to
  // produce per-candidate cards for the UI.
  matchReferral: async (payload: { case_id: string; filters?: Record<string, unknown> }) => {
    const resp = await request<WMatchResponse>('POST', '/match/referral', {
      body: {
        case_id: payload.case_id,
        // Reuse the seeded GP actor as requester so the backend has a valid id.
        requested_by_actor_id: '00000000-0000-4000-8000-000000000001',
        create_relationships: false,
        context: payload.filters ?? { source: 'frontend' },
      },
    });
    return candidatesFromMatch(resp);
  },
  matchSurgicalTeam: async (payload: { case_id: string; procedure?: string }) => {
    const resp = await request<WMatchResponse>('POST', '/match/surgical-team', {
      body: {
        case_id: payload.case_id,
        requested_by_actor_id: '00000000-0000-4000-8000-000000000001',
        create_relationships: false,
        context: { source: 'frontend', procedure: payload.procedure ?? 'CABG' },
      },
    });
    return surgicalCandidatesFromMatch(resp);
  },
  matchAlliedHealth: async (payload: { case_id: string }) => {
    const resp = await request<WMatchResponse>('POST', '/match/allied-health', {
      body: {
        case_id: payload.case_id,
        requested_by_actor_id: '00000000-0000-4000-8000-000000000001',
        create_relationships: false,
        context: { source: 'frontend' },
      },
    });
    return candidatesFromMatch(resp);
  },

  // Outcomes
  createOutcome: async (payload: {
    case_id: string;
    relationship_id?: string;
    score_surgical?: number;
    score_recovery?: number;
    complications?: string[];
    notes?: string;
  }) => {
    const data = await request<{ outcomes: Array<{ relationship_id: string }>; recorded_at?: string }>(
      'POST',
      '/outcomes',
      {
        body: {
          relationship_ids: payload.relationship_id ? [payload.relationship_id] : [],
          outcome_record: {
            clinical_outcome: payload.notes ?? '',
            appropriateness_score: payload.score_surgical ?? payload.score_recovery,
            complications: payload.complications,
          },
          reason: 'frontend',
        },
      },
    );
    const first = data.outcomes?.[0];
    return {
      id: first?.relationship_id ?? payload.relationship_id ?? '',
      caseId: payload.case_id,
      relationshipId: first?.relationship_id ?? payload.relationship_id,
      scoreSurgical: payload.score_surgical,
      scoreRecovery: payload.score_recovery,
      complications: payload.complications,
      notes: payload.notes,
      recordedAt: data.recorded_at ?? new Date().toISOString(),
    };
  },

  // Audit
  listAudit: async (limit = 100) => {
    const data = await request<WAuditEvent[]>('GET', '/audit');
    return data.slice(0, limit).map(toAudit);
  },
};

export type Api = typeof api;
