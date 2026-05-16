/**
 * Data source · the only place screens call to fetch data.
 *
 * Behavior:
 *   - When VITE_API_BASE_URL is set, calls the live backend.
 *   - On network failure, falls back to mock data and flags `usedFallback`.
 *   - When VITE_DEMO_MODE=1 or no base URL, mocks are returned directly.
 *
 * Returned shape is always `{ data, source }` where source is 'api' | 'mock' | 'fallback'.
 */

import { api } from '@/lib/api';
import { HAS_API } from '@/lib/env';
import type {
  Actor,
  AuditEvent,
  MatchCandidate,
  PatientCase,
  Relationship,
  SurgicalRole,
} from '@/lib/types';

import { actors as mockActors } from './actors';
import { cases as mockCases } from './cases';
import {
  alliedHealthCandidates as mockAllied,
  referralCandidates as mockReferral,
  surgicalTeamCandidates as mockSurgical,
} from './matches';
import { relationships as mockRelationships } from './relationships';

export type Source = 'api' | 'mock' | 'fallback';
export interface Sourced<T> {
  data: T;
  source: Source;
}

async function withFallback<T>(
  fetcher: () => Promise<T>,
  mock: T,
): Promise<Sourced<T>> {
  if (!HAS_API) return { data: mock, source: 'mock' };
  try {
    const data = await fetcher();
    return { data, source: 'api' };
  } catch (err) {
    // Network/4xx/5xx — gracefully degrade to mocks so the UI still works.
    if (typeof console !== 'undefined') {
      console.warn('[CareLink] API call failed, using mock data:', err);
    }
    return { data: mock, source: 'fallback' };
  }
}

// ── Actors ───────────────────────────────────────────────────────
export const loadActors = (q?: Parameters<typeof api.listActors>[0]): Promise<Sourced<Actor[]>> =>
  withFallback(() => api.listActors(q), mockActors);

// ── Cases ────────────────────────────────────────────────────────
export const loadCases = (): Promise<Sourced<PatientCase[]>> =>
  withFallback(() => api.listCases(), mockCases);

// ── Relationships ────────────────────────────────────────────────
export const loadRelationships = (
  q?: Parameters<typeof api.listRelationships>[0],
): Promise<Sourced<Relationship[]>> =>
  withFallback(() => api.listRelationships(q), mockRelationships);

// ── Matching ─────────────────────────────────────────────────────
export const runReferralMatch = (caseId: string): Promise<Sourced<MatchCandidate[]>> =>
  withFallback(() => api.matchReferral({ case_id: caseId }), mockReferral);

export const runSurgicalMatch = (
  caseId: string,
): Promise<Sourced<Record<SurgicalRole, MatchCandidate[]>>> =>
  withFallback(
    () => api.matchSurgicalTeam({ case_id: caseId }),
    mockSurgical,
  );

export const runAlliedMatch = (caseId: string): Promise<Sourced<MatchCandidate[]>> =>
  withFallback(() => api.matchAlliedHealth({ case_id: caseId }), mockAllied);

// ── Audit ────────────────────────────────────────────────────────
const mockAudit: AuditEvent[] = [
  {
    id: 'au-08',
    timestamp: '2026-05-16T08:13:11Z',
    actorId: 'a-cts-01',
    action: 'relationship.created',
    subject: 'rel-05',
    detail: 'Scrub Nurse assigned to CABG team',
    result: 'ok',
  },
  {
    id: 'au-07',
    timestamp: '2026-05-16T08:12:33Z',
    actorId: 'a-cts-01',
    action: 'relationship.created',
    subject: 'rel-04',
    detail: 'Perfusionist assigned to CABG team',
    result: 'ok',
  },
  {
    id: 'au-06',
    timestamp: '2026-05-16T08:12:01Z',
    actorId: 'system',
    action: 'compliance.blocked',
    subject: 'a-cts-03',
    detail: 'APC expired 2025-12-05 · Dr Cheong Wai Lun excluded',
    result: 'blocked',
  },
  {
    id: 'au-05',
    timestamp: '2026-05-16T08:11:48Z',
    actorId: 'a-cts-01',
    action: 'match.surgical-team.run',
    subject: 'case-zainal',
    detail: '63 combinations evaluated · 5 viable',
    result: 'ok',
  },
  {
    id: 'au-04',
    timestamp: '2026-05-16T08:10:22Z',
    actorId: 'a-card-01',
    action: 'relationship.state.changed',
    subject: 'rel-02',
    detail: 'proposed → confirmed',
    result: 'ok',
  },
  {
    id: 'au-03',
    timestamp: '2026-05-15T09:21:55Z',
    actorId: 'a-gp-01',
    action: 'match.referral.run',
    subject: 'case-zainal',
    detail: 'top-10 retrieved · pipeline 412ms',
    result: 'ok',
  },
  {
    id: 'au-02',
    timestamp: '2026-05-15T09:21:48Z',
    actorId: 'a-gp-01',
    action: 'case.created',
    subject: 'case-zainal',
    detail: 'NSTEMI · Klang Valley · Prudential BSN',
    result: 'ok',
  },
  {
    id: 'au-01',
    timestamp: '2026-05-15T09:20:10Z',
    actorId: 'system',
    action: 'ekg.reconcile',
    detail: '4 actors · 2 duplicates merged',
    result: 'ok',
  },
];

export const loadAudit = (limit = 100): Promise<Sourced<AuditEvent[]>> =>
  withFallback(() => api.listAudit(limit), mockAudit);

// ── Health ───────────────────────────────────────────────────────
export type HealthStatus = 'live' | 'degraded' | 'mock';

export async function loadHealth(): Promise<HealthStatus> {
  if (!HAS_API) return 'mock';
  try {
    const h = await api.health();
    return h.status === 'ok' ? 'live' : 'degraded';
  } catch {
    return 'mock';
  }
}
