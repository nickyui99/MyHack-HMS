import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { config } from "../config.js";

const jsonFields = new Set([
  "insurance_panels",
  "languages",
  "credentials",
  "clinical_context",
  "compliance_flags",
  "score_breakdown",
  "case_context",
  "outcome_record",
  "metadata",
  "input_context",
  "recommended_actor_ids",
  "recommended_relationship_ids",
  "compliance_summary"
]);

const schema = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS actors (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  specialty TEXT,
  subspecialty TEXT,
  hospital TEXT,
  department TEXT,
  location TEXT,
  insurance_panels TEXT NOT NULL DEFAULT '[]',
  languages TEXT NOT NULL DEFAULT '[]',
  credentials TEXT NOT NULL DEFAULT '{}',
  apc_number TEXT,
  apc_expiry_date TEXT,
  capacity_status TEXT NOT NULL DEFAULT 'available',
  capacity_notes TEXT,
  outcome_weight REAL NOT NULL DEFAULT 1.0,
  profile_text TEXT,
  embedding TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  patient_name TEXT NOT NULL,
  patient_age INTEGER,
  patient_gender TEXT,
  diagnosis TEXT NOT NULL,
  case_stage TEXT NOT NULL,
  payer TEXT,
  location TEXT,
  urgency TEXT,
  clinical_context TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  relationship_type TEXT NOT NULL,
  actor_a_id TEXT NOT NULL REFERENCES actors(id),
  actor_b_id TEXT NOT NULL REFERENCES actors(id),
  state TEXT NOT NULL DEFAULT 'proposed',
  compliance_status TEXT NOT NULL DEFAULT 'pending',
  compliance_flags TEXT NOT NULL DEFAULT '{}',
  match_score REAL,
  score_breakdown TEXT NOT NULL DEFAULT '{}',
  case_context TEXT NOT NULL DEFAULT '{}',
  outcome_record TEXT,
  created_by TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  relationship_id TEXT REFERENCES relationships(id),
  case_id TEXT REFERENCES cases(id),
  action TEXT NOT NULL,
  previous_state TEXT,
  next_state TEXT,
  actor_user TEXT,
  reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match_runs (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  match_type TEXT NOT NULL,
  input_context TEXT NOT NULL DEFAULT '{}',
  recommended_actor_ids TEXT NOT NULL DEFAULT '[]',
  recommended_relationship_ids TEXT NOT NULL DEFAULT '[]',
  score_breakdown TEXT NOT NULL DEFAULT '{}',
  compliance_summary TEXT NOT NULL DEFAULT '{}',
  explanation TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
`;

const seededActors = [
  ["00000000-0000-4000-8000-000000000001", "gp", "Dr Amirul Hakim", "gp", "primary_care", "urgent_referral", "Puchong Family Clinic", "Primary Care", "Puchong", ["Prudential BSN", "AIA"], ["Malay", "English"], { mmc: "MMC-1001" }, "APC-2026-1001", "2026-12-31", "available", "Can refer urgent cardiology cases during clinic hours.", 1.0, "GP in Puchong with NSTEMI referral experience."],
  ["00000000-0000-4000-8000-000000000005", "specialist", "Dr Farah Nabila", "cardiologist", "cardiology", "interventional_cardiology", "Sunway Medical Centre", "Cardiology", "Bandar Sunway", ["Prudential BSN", "AIA", "Great Eastern"], ["Malay", "English"], { mmc: "MMC-2001", nsr: "NSR-CARD-2001" }, "APC-2026-2001", "2026-12-31", "available", "Accepting urgent NSTEMI referrals today.", 1.18, "Interventional cardiologist for NSTEMI triage and CABG escalation."],
  ["00000000-0000-4000-8000-000000000006", "specialist", "Dr Suresh Ramasamy", "cardiologist", "cardiology", "interventional_cardiology", "Sunway Medical Centre", "Cardiology", "Bandar Sunway", ["Prudential BSN", "Allianz"], ["English", "Malay", "Tamil"], { mmc: "MMC-2002", nsr: "NSR-CARD-2002" }, "APC-2026-2002", "2026-12-31", "limited", "Available for urgent review after 4pm.", 1.12, "Cardiologist with strong CABG escalation pathway outcomes."],
  ["00000000-0000-4000-8000-000000000009", "specialist", "Dr Expired APC Demo", "cardiologist", "cardiology", "interventional_cardiology", "Demo Hospital", "Cardiology", "Petaling Jaya", ["Prudential BSN"], ["English"], { mmc: "MMC-9999", nsr: "NSR-CARD-9999" }, "APC-2024-9999", "2024-12-31", "available", "Demo actor for compliance block.", 0.5, "Expired APC demo cardiologist used to prove compliance blocking."],
  ["00000000-0000-4000-8000-000000000010", "surgeon", "Dr Suresh Menon", "cardiothoracic_surgeon", "cardiothoracic_surgery", "cabg", "Sunway Medical Centre", "Cardiothoracic Surgery", "Bandar Sunway", ["Prudential BSN", "AIA"], ["English", "Malay", "Tamil"], { mmc: "MMC-3001", nsr: "NSR-CTS-3001" }, "APC-2026-3001", "2026-12-31", "available", "Lead surgeon for 7am CABG list.", 1.25, "CABG surgeon with strong outcomes for NSTEMI escalation."]
];

function stringify(value) {
  return JSON.stringify(value ?? {});
}

function parseJson(value) {
  if (value === null || value === undefined || typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function serializeParam(value) {
  if (Array.isArray(value) || (value && typeof value === "object")) return JSON.stringify(value);
  return value;
}

function deserializeRow(row) {
  if (!row) return row;
  const output = { ...row };
  for (const field of jsonFields) {
    if (field in output) output[field] = parseJson(output[field]);
  }
  return output;
}

function expandPostgresPlaceholders(text, params) {
  const values = [];
  const sql = text.replace(/\$(\d+)/g, (_, indexText) => {
    const index = Number(indexText) - 1;
    values.push(serializeParam(params[index]));
    return "?";
  });
  return { sql, values };
}

function insertActor(db, actor) {
  db.prepare(`
    INSERT INTO actors (
      id, actor_type, name, role, specialty, subspecialty, hospital, department,
      location, insurance_panels, languages, credentials, apc_number, apc_expiry_date,
      capacity_status, capacity_notes, outcome_weight, profile_text
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      actor_type = excluded.actor_type,
      name = excluded.name,
      role = excluded.role,
      specialty = excluded.specialty,
      subspecialty = excluded.subspecialty,
      hospital = excluded.hospital,
      department = excluded.department,
      location = excluded.location,
      insurance_panels = excluded.insurance_panels,
      languages = excluded.languages,
      credentials = excluded.credentials,
      apc_number = excluded.apc_number,
      apc_expiry_date = excluded.apc_expiry_date,
      capacity_status = excluded.capacity_status,
      capacity_notes = excluded.capacity_notes,
      outcome_weight = excluded.outcome_weight,
      profile_text = excluded.profile_text,
      updated_at = datetime('now')
  `).run(
    actor[0], actor[1], actor[2], actor[3], actor[4], actor[5], actor[6], actor[7], actor[8],
    stringify(actor[9] ?? []), stringify(actor[10] ?? []), stringify(actor[11] ?? {}),
    actor[12], actor[13], actor[14], actor[15], actor[16], actor[17]
  );
}

function seedSqlite(db) {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM actors").get();
  if (count > 0) return;

  for (const actor of seededActors) insertActor(db, actor);

  const roles = ["gp", "cardiologist", "cardiothoracic_surgeon", "anaesthetist", "nurse", "perfusionist", "physiotherapist", "dietitian", "pharmacist", "department", "hospital"];
  for (let i = 1; i <= 45; i += 1) {
    const role = roles[i % roles.length];
    const actorNumber = i + 50;
    insertActor(db, [
      `00000000-0000-4000-8000-${String(actorNumber).padStart(12, "0")}`,
      role === "hospital" || role === "department" ? role : "specialist",
      `SQLite Demo Actor ${actorNumber}`,
      role,
      role === "gp" ? "primary_care" : role,
      null,
      i % 3 === 0 ? "Sunway Medical Centre" : "Demo Hospital",
      role === "hospital" ? null : "Demo Department",
      i % 2 === 0 ? "Bandar Sunway" : "Puchong",
      i % 2 === 0 ? ["Prudential BSN"] : ["AIA"],
      ["English", "Malay"],
      { demo_id: i },
      i < 40 ? `APC-2026-${String(actorNumber).padStart(4, "0")}` : null,
      i < 40 ? "2026-12-31" : null,
      i % 7 === 0 ? "limited" : "available",
      null,
      1,
      `Local SQLite demo profile for ${role}.`
    ]);
  }

  db.prepare(`
    INSERT INTO cases (id, patient_name, patient_age, patient_gender, diagnosis, case_stage, payer, location, urgency, clinical_context, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("10000000-0000-4000-8000-000000000001", "Encik Zainal", 58, "male", "NSTEMI progressing to CABG", "allied_health", "Prudential BSN", "Puchong", "urgent", stringify({ procedure: "CABG" }), config.localUserEmail);

  db.prepare(`
    INSERT INTO cases (id, patient_name, patient_age, patient_gender, diagnosis, case_stage, payer, location, urgency, clinical_context, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("10000000-0000-4000-8000-000000000002", "Puan Mariam", 66, "female", "Heart failure exacerbation", "referral", "AIA", "Subang Jaya", "semi_urgent", stringify({ preferred_language: "Malay" }), config.localUserEmail);

  db.prepare(`
    INSERT INTO cases (id, patient_name, patient_age, patient_gender, diagnosis, case_stage, payer, location, urgency, clinical_context, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("10000000-0000-4000-8000-000000000003", "Mr Tan Kok Wai", 49, "male", "Post-angioplasty rehabilitation", "allied_health", "Great Eastern", "Kelana Jaya", "routine", stringify({ procedure: "PCI" }), config.localUserEmail);
}

export function createSqliteDatabase() {
  const sqlitePath = path.resolve(config.sqlitePath);
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const db = new DatabaseSync(sqlitePath);
  db.exec(schema);
  seedSqlite(db);

  return {
    dialect: "sqlite",
    query(text, params = []) {
      const { sql, values } = expandPostgresPlaceholders(text, params);
      const statement = db.prepare(sql);
      const rows = /^\s*select/i.test(sql) || /\breturning\b/i.test(sql) ? statement.all(...values).map(deserializeRow) : [];
      if (!rows.length && /\breturning\b/i.test(sql)) return { rows: [] };
      if (!/\breturning\b/i.test(sql) && !/^\s*select/i.test(sql)) statement.run(...values);
      return { rows };
    },
    close() {
      db.close();
    },
    serializeParam,
    randomId: randomUUID
  };
}
