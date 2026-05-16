import { randomUUID } from "node:crypto";

const now = () => new Date().toISOString();

export const store = {
  actors: new Map(),
  cases: new Map(),
  relationships: new Map(),
  auditLogs: new Map(),
  matchRuns: new Map()
};

export function createRecord(input) {
  return {
    id: randomUUID(),
    created_at: now(),
    updated_at: now(),
    ...input
  };
}

export function seedStore() {
  if (store.actors.size > 0) return;

  const actors = [
    {
      actor_type: "gp",
      name: "Dr Amirul Hakim",
      role: "gp",
      specialty: "primary_care",
      hospital: "Puchong Family Clinic",
      location: "Puchong",
      insurance_panels: ["Prudential BSN"],
      languages: ["Malay", "English"],
      credentials: { mmc: "MMC-1001" },
      apc_number: "APC-2026-1001",
      apc_expiry_date: "2026-12-31",
      capacity_status: "available",
      outcome_weight: 1,
      profile_text: "GP in Puchong with NSTEMI referral experience."
    },
    {
      actor_type: "specialist",
      name: "Dr Farah Nabila",
      role: "cardiologist",
      specialty: "cardiology",
      subspecialty: "interventional_cardiology",
      hospital: "Sunway Medical Centre",
      department: "Cardiology",
      location: "Bandar Sunway",
      insurance_panels: ["Prudential BSN", "AIA"],
      languages: ["Malay", "English"],
      credentials: { mmc: "MMC-2001", nsr: "NSR-CARD-2001" },
      apc_number: "APC-2026-2001",
      apc_expiry_date: "2026-12-31",
      capacity_status: "available",
      outcome_weight: 1.15,
      profile_text: "Interventional cardiologist for NSTEMI triage and CABG escalation."
    },
    {
      actor_type: "surgeon",
      name: "Dr Suresh Menon",
      role: "cardiothoracic_surgeon",
      specialty: "cardiothoracic_surgery",
      subspecialty: "cabg",
      hospital: "Sunway Medical Centre",
      department: "Cardiothoracic Surgery",
      location: "Bandar Sunway",
      insurance_panels: ["Prudential BSN"],
      languages: ["English", "Malay", "Tamil"],
      credentials: { mmc: "MMC-3001", nsr: "NSR-CTS-3001" },
      apc_number: "APC-2026-3001",
      apc_expiry_date: "2026-12-31",
      capacity_status: "available",
      outcome_weight: 1.2,
      profile_text: "CABG surgeon with strong outcomes for NSTEMI escalation."
    },
    {
      actor_type: "anaesthetist",
      name: "Dr Lim Wei Chen",
      role: "anaesthetist",
      specialty: "cardiac_anaesthesia",
      hospital: "Sunway Medical Centre",
      department: "Anaesthesia",
      location: "Bandar Sunway",
      credentials: { mmc: "MMC-4001", nsr: "NSR-ANA-4001" },
      apc_number: "APC-2026-4001",
      apc_expiry_date: "2026-12-31",
      capacity_status: "available",
      outcome_weight: 1,
      profile_text: "Cardiac anaesthetist available for 7am CABG lists."
    },
    {
      actor_type: "physiotherapist",
      name: "Nur Aisyah Rahman",
      role: "physiotherapist",
      specialty: "cardiac_rehabilitation",
      hospital: "Sunway Medical Centre",
      department: "Allied Health",
      location: "Bandar Sunway",
      credentials: { cert: "MY-PHYSIO-7001" },
      capacity_status: "available",
      outcome_weight: 1,
      profile_text: "Cardiac rehab physiotherapist for post-CABG mobility goals."
    },
    {
      actor_type: "specialist",
      name: "Dr Expired APC Demo",
      role: "cardiologist",
      specialty: "cardiology",
      hospital: "Demo Hospital",
      credentials: { mmc: "MMC-9999" },
      apc_number: "APC-2024-9999",
      apc_expiry_date: "2024-12-31",
      capacity_status: "available",
      outcome_weight: 0.5,
      profile_text: "Demo actor used to prove expired APC blocking."
    }
  ];

  for (const actor of actors) {
    const record = createRecord({
      insurance_panels: [],
      languages: [],
      credentials: {},
      capacity_status: "available",
      outcome_weight: 1,
      ...actor
    });
    store.actors.set(record.id, record);
  }
}
