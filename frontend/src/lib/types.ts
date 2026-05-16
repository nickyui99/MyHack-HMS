export type ActorType =
  | 'GP'
  | 'Cardiologist'
  | 'Cardiothoracic Surgeon'
  | 'Anaesthetist'
  | 'Perfusionist'
  | 'Scrub Nurse'
  | 'Physiotherapist'
  | 'Dietitian'
  | 'Pharmacist'
  | 'Coordinator';

export type RelationshipType =
  | 'gp_referral'
  | 'surgical_team'
  | 'allied_health';

export type RelationshipState =
  | 'proposed'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'blocked';

export interface ComplianceFlags {
  apcValid: boolean;
  panelMatch: boolean;
  capacityOk: boolean;
}

export interface Actor {
  id: string;
  name: string;
  type: ActorType;
  subspecialty?: string | null;
  hospital: string | null;
  department: string | null;
  panels: string[];
  // Fields the backend doesn't yet expose — null means "render as NULL".
  outcomeScore: number | null;
  caseCount: number | null;
  apcExpiry: string | null;
  capacityPct: number | null;
  region: string | null;
  bio?: string | null;
}

export interface ScoreBreakdown {
  vectorSimilarity: number; // 0..1
  ruleCompliance: number; // 0..1
  outcomeWeight: number; // 0..1
  historicalPairBonus?: number; // 0..0.2
  total: number; // 0..100
}

export interface MatchCandidate {
  actor: Actor;
  score: ScoreBreakdown;
  compliance: ComplianceFlags;
  rationale: string;
}

export interface PatientCase {
  id: string;
  patientName: string;
  age: number;
  sex: 'M' | 'F';
  diagnosis: string;
  panel: string;
  region: string;
  acuity: 'Routine' | 'Urgent' | 'Emergent';
  notes: string;
}

export interface Relationship {
  id: string;
  type: RelationshipType;
  actorA: string; // actor id or patient id
  actorB: string;
  state: RelationshipState;
  department: string;
  createdAt: string;
  weight: number; // 0..1, animated by outcomes
  caseId: string;
}

export type SurgicalRole =
  | 'Lead Surgeon'
  | 'Anaesthetist'
  | 'Perfusionist'
  | 'Scrub Nurse';

export interface AuditEvent {
  id: string;
  timestamp: string; // ISO
  actorId?: string;    // who performed the action (or system)
  action: string;      // e.g. "relationship.created", "match.referral.run"
  subject?: string;    // relationship id, case id, etc.
  detail?: string;     // human-readable summary
  result: 'ok' | 'blocked' | 'override' | 'error';
}

export interface OutcomeRecord {
  id: string;
  caseId: string;
  relationshipId?: string;
  scoreSurgical?: number;   // 0..5
  scoreRecovery?: number;   // 0..5
  complications?: string[];
  notes?: string;
  recordedAt: string;       // ISO
}
