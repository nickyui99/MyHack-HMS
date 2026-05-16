import type { MatchCandidate, SurgicalRole } from '@/lib/types';
import { actors } from './actors';

const find = (id: string) => actors.find((a) => a.id === id)!;

// ── Stage 1: GP referral candidates for Encik Zainal ───────────────
export const referralCandidates: MatchCandidate[] = [
  {
    actor: find('a-card-01'),
    score: {
      vectorSimilarity: 0.93,
      ruleCompliance: 1.0,
      outcomeWeight: 0.96,
      historicalPairBonus: 0.05,
      total: 92,
    },
    compliance: { apcValid: true, panelMatch: true, capacityOk: true },
    rationale:
      'Interventional cardiologist with NSTEMI primary-PCI track record. Panel-confirmed for Prudential BSN. 4.8/5 outcome score across 312 cases.',
  },
  {
    actor: find('a-card-04'),
    score: {
      vectorSimilarity: 0.88,
      ruleCompliance: 1.0,
      outcomeWeight: 0.94,
      historicalPairBonus: 0,
      total: 88,
    },
    compliance: { apcValid: true, panelMatch: true, capacityOk: true },
    rationale:
      'Heart-failure specialist with strong NSTEMI workup experience at IJN. Panel-confirmed.',
  },
  {
    actor: find('a-card-02'),
    score: {
      vectorSimilarity: 0.86,
      ruleCompliance: 0.9,
      outcomeWeight: 0.92,
      historicalPairBonus: 0,
      total: 84,
    },
    compliance: { apcValid: true, panelMatch: true, capacityOk: false },
    rationale:
      'Interventional cardiologist · capacity is high this week (82%). Consider for follow-up.',
  },
  {
    actor: find('a-card-03'),
    score: {
      vectorSimilarity: 0.79,
      ruleCompliance: 0.7,
      outcomeWeight: 0.88,
      historicalPairBonus: 0,
      total: 74,
    },
    compliance: { apcValid: true, panelMatch: false, capacityOk: true },
    rationale:
      'Strong outcome score, but panel is Great Eastern, not Prudential BSN. Out-of-panel quote required.',
  },
];

// ── Stage 2: Surgical team for Encik Zainal — CABG ──────────────────
export const surgicalTeamCandidates: Record<SurgicalRole, MatchCandidate[]> = {
  'Lead Surgeon': [
    {
      actor: find('a-cts-01'),
      score: {
        vectorSimilarity: 0.95,
        ruleCompliance: 1.0,
        outcomeWeight: 0.98,
        historicalPairBonus: 0.05,
        total: 96,
      },
      compliance: { apcValid: true, panelMatch: true, capacityOk: true },
      rationale:
        '540 CABG cases. 4.9/5 outcome score. Frequently paired with Dr Priya Sandran (Anaes) — historical-pair bonus applied.',
    },
    {
      actor: find('a-cts-02'),
      score: {
        vectorSimilarity: 0.9,
        ruleCompliance: 1.0,
        outcomeWeight: 0.94,
        historicalPairBonus: 0,
        total: 89,
      },
      compliance: { apcValid: true, panelMatch: true, capacityOk: true },
      rationale: 'CABG · Aortic specialist at KL Heart Centre.',
    },
    {
      actor: find('a-cts-03'),
      score: {
        vectorSimilarity: 0.87,
        ruleCompliance: 0,
        outcomeWeight: 0.92,
        historicalPairBonus: 0,
        total: 0,
      },
      compliance: { apcValid: false, panelMatch: false, capacityOk: true },
      rationale:
        'APC expired 2025-12-05. Compliance Agent BLOCKED — override requires written justification.',
    },
  ],
  Anaesthetist: [
    {
      actor: find('a-anae-01'),
      score: {
        vectorSimilarity: 0.94,
        ruleCompliance: 1.0,
        outcomeWeight: 0.97,
        historicalPairBonus: 0.05,
        total: 95,
      },
      compliance: { apcValid: true, panelMatch: true, capacityOk: true },
      rationale:
        'Cardiac anaesthetist · IJN. Historical pairing with Dato Dr Rajeev Kumar (+5%).',
    },
    {
      actor: find('a-anae-02'),
      score: {
        vectorSimilarity: 0.88,
        ruleCompliance: 1.0,
        outcomeWeight: 0.91,
        historicalPairBonus: 0,
        total: 87,
      },
      compliance: { apcValid: true, panelMatch: true, capacityOk: false },
      rationale: 'High capacity this week (84%). Available as backup.',
    },
    {
      actor: find('a-anae-03'),
      score: {
        vectorSimilarity: 0.84,
        ruleCompliance: 0.8,
        outcomeWeight: 0.89,
        historicalPairBonus: 0,
        total: 82,
      },
      compliance: { apcValid: true, panelMatch: false, capacityOk: true },
      rationale: 'Panel mismatch (Great Eastern vs Prudential BSN).',
    },
  ],
  Perfusionist: [
    {
      actor: find('a-perf-01'),
      score: {
        vectorSimilarity: 0.96,
        ruleCompliance: 1.0,
        outcomeWeight: 0.99,
        historicalPairBonus: 0.05,
        total: 97,
      },
      compliance: { apcValid: true, panelMatch: true, capacityOk: true },
      rationale: '720 CPB cases. Frequently paired with Dato Rajeev (+5%).',
    },
    {
      actor: find('a-perf-02'),
      score: {
        vectorSimilarity: 0.89,
        ruleCompliance: 1.0,
        outcomeWeight: 0.93,
        historicalPairBonus: 0,
        total: 88,
      },
      compliance: { apcValid: true, panelMatch: true, capacityOk: true },
      rationale: 'CPB + ECMO certified at KL Heart Centre.',
    },
  ],
  'Scrub Nurse': [
    {
      actor: find('a-nurse-01'),
      score: {
        vectorSimilarity: 0.93,
        ruleCompliance: 1.0,
        outcomeWeight: 0.97,
        historicalPairBonus: 0.05,
        total: 95,
      },
      compliance: { apcValid: true, panelMatch: true, capacityOk: true },
      rationale: '980 cardiac OT cases. Preferred scrub for IJN CABG team.',
    },
    {
      actor: find('a-nurse-02'),
      score: {
        vectorSimilarity: 0.87,
        ruleCompliance: 1.0,
        outcomeWeight: 0.92,
        historicalPairBonus: 0,
        total: 87,
      },
      compliance: { apcValid: true, panelMatch: true, capacityOk: false },
      rationale: 'High capacity load (80%). Backup option.',
    },
  ],
};

// ── Stage 3: Allied health for Encik Zainal — post-CABG ─────────────
export const alliedHealthCandidates: MatchCandidate[] = [
  {
    actor: find('a-physio-01'),
    score: {
      vectorSimilarity: 0.92,
      ruleCompliance: 1.0,
      outcomeWeight: 0.95,
      historicalPairBonus: 0.03,
      total: 91,
    },
    compliance: { apcValid: true, panelMatch: true, capacityOk: true },
    rationale: 'Cardiac rehab physio at IJN — same hospital as surgical team.',
  },
  {
    actor: find('a-diet-01'),
    score: {
      vectorSimilarity: 0.9,
      ruleCompliance: 1.0,
      outcomeWeight: 0.93,
      historicalPairBonus: 0,
      total: 89,
    },
    compliance: { apcValid: true, panelMatch: true, capacityOk: true },
    rationale: 'Cardiac + diabetes dietitian — relevant given comorbidities.',
  },
  {
    actor: find('a-pharm-01'),
    score: {
      vectorSimilarity: 0.91,
      ruleCompliance: 1.0,
      outcomeWeight: 0.96,
      historicalPairBonus: 0,
      total: 90,
    },
    compliance: { apcValid: true, panelMatch: true, capacityOk: true },
    rationale: 'Cardiac MTM specialist for discharge medication review.',
  },
  {
    actor: find('a-physio-02'),
    score: {
      vectorSimilarity: 0.84,
      ruleCompliance: 0.9,
      outcomeWeight: 0.9,
      historicalPairBonus: 0,
      total: 81,
    },
    compliance: { apcValid: true, panelMatch: false, capacityOk: true },
    rationale: 'Out-of-panel for Prudential BSN.',
  },
];
