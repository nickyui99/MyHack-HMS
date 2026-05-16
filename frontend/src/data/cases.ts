import type { PatientCase } from '@/lib/types';

// `id` must match a real backend case so /match/* succeeds.
// '10000000-0000-4000-8000-000000000001' is Encik Zainal in the seeded SQLite DB.
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
    id: 'case-siti',
    patientName: 'Puan Siti Aminah',
    age: 64,
    sex: 'F',
    diagnosis: 'Severe aortic stenosis',
    panel: 'AIA',
    region: 'Petaling Jaya',
    acuity: 'Routine',
    notes: 'Referred for valve replacement workup.',
  },
];

export const activeCase = cases[0];
