import type { PatientCase } from '@/lib/types';

// IDs must match real backend cases so /match/* succeeds. The first two
// match seeded rows in `backend/data/carelink.sqlite` (Encik Zainal and
// Puan Mariam). The third is illustrative for the demo dropdown.
export const cases: PatientCase[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    patientName: 'Encik Zainal bin Abdullah',
    age: 58,
    sex: 'M',
    diagnosis: 'NSTEMI · suspected triple-vessel disease',
    panel: 'Prudential BSN',
    region: 'Puchong',
    acuity: 'Urgent',
    notes:
      'Referring GP: Dr Amirul Hakim. Chest pain on exertion x3 days. Troponin elevated. ECG: lateral T-wave inversion.',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    patientName: 'Puan Mariam',
    age: 66,
    sex: 'F',
    diagnosis: 'Heart failure exacerbation',
    panel: 'AIA',
    region: 'Subang Jaya',
    acuity: 'Routine',
    notes: 'Preferred language Malay. Referred for cardiology workup.',
  },
];

// Static default — kept for back-compat with files that read this directly.
// New code should use `useActiveCase()` from `@/lib/activeCase` instead so
// the patient picker in the TopBar can swap cases at runtime.
export const activeCase = cases[0];
