/**
 * Each stage in CareLink has a distinct visual identity, AI mechanism, and
 * narrative purpose. This module is the source of truth — every screen,
 * header, and chip reads from it, so changing a stage's accent or copy
 * propagates across the app.
 */

export type StageKey = 'referral' | 'surgical' | 'allied' | 'graph';

export interface StageDef {
  key: StageKey;
  path: string;
  number: string; // "01", "02", "03", "—"
  family: 'Stage' | 'Network';
  title: string;
  subtitle: string;
  question: string; // The one question this stage answers
  mechanism: string; // The AI mechanism narrative
  signalLabels: [string, string, string]; // 3 stat tile labels
  colors: { soft: string; mid: string; deep: string; ink: string };
  icon: 'referral' | 'surgical' | 'allied' | 'graph';
}

export const stages: Record<StageKey, StageDef> = {
  referral: {
    key: 'referral',
    path: '/referral',
    number: '01',
    family: 'Stage',
    title: 'GP Referral',
    subtitle: 'Find the right cardiologist for this patient.',
    question: 'Who should we refer Encik Zainal to?',
    mechanism:
      'Vector retrieval over physician embeddings, filtered by panel and APC, ranked by historical outcome score.',
    signalLabels: [
      'Cardiologists indexed',
      'Median referral time',
      'Panel coverage',
    ],
    colors: { soft: '#e8efe2', mid: '#79976a', deep: '#3d5a35', ink: '#243620' },
    icon: 'referral',
  },
  surgical: {
    key: 'surgical',
    path: '/surgical-team',
    number: '02',
    family: 'Stage',
    title: 'Surgical Team',
    subtitle: 'Assemble a four-role CABG team that fits, schedules, and complies.',
    question: 'Who works well together at 7am tomorrow?',
    mechanism:
      'Per-role retrieval, compliance gating (APC, panel, capacity), then team-combination scoring with a historical-pair bonus.',
    signalLabels: [
      'Eligible specialists',
      'Combinations evaluated',
      'OT slot lock',
    ],
    colors: { soft: '#e0e8f7', mid: '#5f7ed9', deep: '#1d3a8a', ink: '#101e4d' },
    icon: 'surgical',
  },
  allied: {
    key: 'allied',
    path: '/allied-health',
    number: '03',
    family: 'Stage',
    title: 'Allied Health',
    subtitle: 'Coordinate the post-op recovery team across the discharge window.',
    question: 'Who handles physio, nutrition and pharmacy after CABG?',
    mechanism:
      'Recovery-pathway templates re-ranked against patient comorbidities and outcome-weighted historical data.',
    signalLabels: [
      'Services scheduled',
      'Discharge window',
      'Outcome target',
    ],
    colors: { soft: '#f7e6d8', mid: '#dd8c5a', deep: '#9c3d1d', ink: '#4a1b0c' },
    icon: 'allied',
  },
  graph: {
    key: 'graph',
    path: '/graph',
    number: '—',
    family: 'Network',
    title: 'Relationship Graph',
    subtitle:
      'Inspect the patient as a node in the hospital network. Every edge is a first-class entity.',
    question: 'What network forms around this patient?',
    mechanism:
      'Enterprise Knowledge Graph reconciliation of duplicates, with edges weighted by outcome history.',
    signalLabels: ['Entities', 'Relationships', 'Network density'],
    colors: { soft: '#ece1ee', mid: '#a073ad', deep: '#6b2876', ink: '#321338' },
    icon: 'graph',
  },
};

export const stageList: StageDef[] = [
  stages.referral,
  stages.surgical,
  stages.allied,
  stages.graph,
];

export const stageForPath = (path: string): StageDef => {
  const match = stageList.find((s) => path.startsWith(s.path));
  return match ?? stages.referral;
};
