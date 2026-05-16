import crypto from "node:crypto";

import { config } from "../config.js";
import { createPool } from "./cloudSql.js";
import { createRecord, store } from "./store.js";

const sqliteConfigured = Boolean(config.sqlitePath);
const databaseConfigured = Boolean(sqliteConfigured || config.databaseUrl || (config.cloudSqlInstance && config.dbUser));
let poolPromise;

async function getPool() {
  if (!databaseConfigured) return null;
  if (!poolPromise) {
    poolPromise = sqliteConfigured
      ? import("./sqlite.js").then(({ createSqliteDatabase }) => createSqliteDatabase())
      : createPool();
  }
  return poolPromise;
}

async function query(text, params = []) {
  const pool = await getPool();
  return pool.query(text, params);
}

function normalize(row) {
  if (!row) return row;
  return {
    ...row,
    outcome_weight: row.outcome_weight === undefined ? row.outcome_weight : Number(row.outcome_weight),
    match_score: row.match_score === undefined || row.match_score === null ? row.match_score : Number(row.match_score)
  };
}

function normalizeRows(rows) {
  return rows.map(normalize);
}

function insertFields(input, defaults = {}) {
  const record = { ...defaults, ...input };
  if (sqliteConfigured && record.id === undefined) record.id = crypto.randomUUID();
  const fields = Object.keys(record).filter((key) => record[key] !== undefined);
  const columns = fields.map((field) => `"${field}"`).join(", ");
  const placeholders = fields.map((_, index) => `$${index + 1}`).join(", ");
  const values = fields.map((field) => serializeField(record[field]));
  return { columns, placeholders, values };
}

function serializeField(value) {
  if (!sqliteConfigured) return value;
  if (Array.isArray(value) || (value && typeof value === "object")) return JSON.stringify(value);
  return value;
}

function placeholders(values, startIndex = 1) {
  return values.map((_, index) => `$${startIndex + index}`).join(", ");
}

export function isDatabaseConfigured() {
  return databaseConfigured;
}

export async function closeDatabase() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  if (pool.close) pool.close();
  else await pool.end();
  poolPromise = undefined;
}

export async function listActors(filters = {}) {
  if (!databaseConfigured) {
    let actors = [...store.actors.values()];
    if (filters.role) actors = actors.filter((actor) => actor.role === filters.role);
    if (filters.specialty) actors = actors.filter((actor) => actor.specialty === filters.specialty);
    if (filters.hospital) actors = actors.filter((actor) => actor.hospital === filters.hospital);
    if (filters.available !== undefined) {
      const allowed = filters.available === "true" ? ["available", "limited"] : ["unavailable", "full"];
      actors = actors.filter((actor) => allowed.includes(String(actor.capacity_status).toLowerCase()));
    }
    return actors;
  }

  const conditions = [];
  const params = [];
  for (const field of ["role", "specialty", "hospital"]) {
    if (filters[field]) {
      params.push(filters[field]);
      conditions.push(`${field} = $${params.length}`);
    }
  }
  if (filters.available !== undefined) {
    const states = filters.available === "true" ? ["available", "limited"] : ["unavailable", "full"];
    if (sqliteConfigured) {
      const startIndex = params.length + 1;
      params.push(...states);
      conditions.push(`lower(capacity_status) IN (${placeholders(states, startIndex)})`);
    } else {
      params.push(states);
      conditions.push(`lower(capacity_status) = ANY($${params.length})`);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM actors ${where} ORDER BY name`, params);
  return normalizeRows(result.rows);
}

export async function getActor(actorId) {
  if (!databaseConfigured) return store.actors.get(actorId);
  const result = await query("SELECT * FROM actors WHERE id = $1", [actorId]);
  return normalize(result.rows[0]);
}

export async function createActor(input) {
  const defaults = {
    insurance_panels: [],
    languages: [],
    credentials: {},
    capacity_status: "available",
    outcome_weight: 1
  };

  if (!databaseConfigured) {
    const actor = createRecord({ ...defaults, ...input });
    store.actors.set(actor.id, actor);
    return actor;
  }

  const { columns, placeholders, values } = insertFields(input, defaults);
  const result = await query(`INSERT INTO actors (${columns}) VALUES (${placeholders}) RETURNING *`, values);
  return normalize(result.rows[0]);
}

export async function listCases(filters = {}) {
  if (!databaseConfigured) {
    let cases = [...store.cases.values()];
    if (filters.case_stage) cases = cases.filter((careCase) => careCase.case_stage === filters.case_stage);
    return cases;
  }

  const params = [];
  const conditions = [];
  if (filters.case_stage) {
    params.push(filters.case_stage);
    conditions.push(`case_stage = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM cases ${where} ORDER BY created_at DESC`, params);
  return normalizeRows(result.rows);
}

export async function getCase(caseId) {
  if (!databaseConfigured) return store.cases.get(caseId);
  const result = await query("SELECT * FROM cases WHERE id = $1", [caseId]);
  return normalize(result.rows[0]);
}

export async function createCase(input, userEmail) {
  const record = {
    clinical_context: {},
    ...input,
    created_by: userEmail
  };

  if (!databaseConfigured) {
    const careCase = createRecord(record);
    store.cases.set(careCase.id, careCase);
    return careCase;
  }

  const { columns, placeholders, values } = insertFields(record);
  const result = await query(`INSERT INTO cases (${columns}) VALUES (${placeholders}) RETURNING *`, values);
  return normalize(result.rows[0]);
}

export async function listRelationships(filters = {}) {
  if (!databaseConfigured) {
    let relationships = [...store.relationships.values()];
    if (filters.case_id) relationships = relationships.filter((rel) => rel.case_id === filters.case_id);
    if (filters.state) relationships = relationships.filter((rel) => rel.state === filters.state);
    return relationships;
  }

  const params = [];
  const conditions = [];
  for (const field of ["case_id", "state"]) {
    if (filters[field]) {
      params.push(filters[field]);
      conditions.push(`${field} = $${params.length}`);
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM relationships ${where} ORDER BY created_at DESC`, params);
  return normalizeRows(result.rows);
}

export async function getRelationship(relationshipId) {
  if (!databaseConfigured) return store.relationships.get(relationshipId);
  const result = await query("SELECT * FROM relationships WHERE id = $1", [relationshipId]);
  return normalize(result.rows[0]);
}

export async function createRelationshipRecord(input, userEmail) {
  const record = {
    outcome_record: null,
    created_by: userEmail,
    approved_by: null,
    ...input
  };

  if (!databaseConfigured) {
    const relationship = createRecord(record);
    store.relationships.set(relationship.id, relationship);
    return relationship;
  }

  const { columns, placeholders, values } = insertFields(record);
  const result = await query(`INSERT INTO relationships (${columns}) VALUES (${placeholders}) RETURNING *`, values);
  return normalize(result.rows[0]);
}

export async function updateRelationshipState(relationshipId, state, userEmail) {
  if (!databaseConfigured) {
    const relationship = store.relationships.get(relationshipId);
    if (!relationship) return undefined;
    relationship.state = state;
    relationship.updated_at = new Date().toISOString();
    if (["approved", "active"].includes(state)) relationship.approved_by = userEmail;
    store.relationships.set(relationship.id, relationship);
    return relationship;
  }

  if (sqliteConfigured) {
    const result = await query(
      `UPDATE relationships
       SET state = $2,
           approved_by = CASE WHEN $2 IN ($3, $4) THEN $5 ELSE approved_by END,
           updated_at = datetime('now')
       WHERE id = $1
       RETURNING *`,
      [relationshipId, state, "approved", "active", userEmail]
    );
    return normalize(result.rows[0]);
  }

  const result = await query(
    `UPDATE relationships
     SET state = $2,
         approved_by = CASE WHEN $2 = ANY($3) THEN $4 ELSE approved_by END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [relationshipId, state, ["approved", "active"], userEmail]
  );
  return normalize(result.rows[0]);
}

export async function completeRelationships(relationshipIds, outcomeRecord) {
  if (!databaseConfigured) {
    return relationshipIds.map((relationshipId) => {
      const relationship = store.relationships.get(relationshipId);
      if (!relationship) return undefined;
      relationship.outcome_record = outcomeRecord || {};
      relationship.state = "completed";
      relationship.updated_at = new Date().toISOString();
      store.relationships.set(relationship.id, relationship);
      return relationship;
    });
  }

  if (sqliteConfigured) {
    const ids = relationshipIds.filter(Boolean);
    if (ids.length === 0) return [];
    const result = await query(
      `UPDATE relationships
       SET outcome_record = $1,
           state = 'completed',
           updated_at = datetime('now')
       WHERE id IN (${placeholders(ids, 2)})
       RETURNING *`,
      [outcomeRecord || {}, ...ids]
    );
    return normalizeRows(result.rows);
  }

  const result = await query(
    `UPDATE relationships
     SET outcome_record = $2,
         state = 'completed',
         updated_at = now()
     WHERE id = ANY($1)
     RETURNING *`,
    [relationshipIds, outcomeRecord || {}]
  );
  return normalizeRows(result.rows);
}

export async function createAuditLog(input) {
  if (!databaseConfigured) {
    const log = createRecord(input);
    store.auditLogs.set(log.id, log);
    return log;
  }

  const { columns, placeholders, values } = insertFields(input);
  const result = await query(`INSERT INTO audit_logs (${columns}) VALUES (${placeholders}) RETURNING *`, values);
  return normalize(result.rows[0]);
}

export async function listAuditLogs(filters = {}) {
  if (!databaseConfigured) {
    let logs = [...store.auditLogs.values()];
    if (filters.relationship_id) logs = logs.filter((log) => log.relationship_id === filters.relationship_id);
    if (filters.case_id) logs = logs.filter((log) => log.case_id === filters.case_id);
    logs.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return logs;
  }

  const params = [];
  const conditions = [];
  for (const field of ["relationship_id", "case_id"]) {
    if (filters[field]) {
      params.push(filters[field]);
      conditions.push(`${field} = $${params.length}`);
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(`SELECT * FROM audit_logs ${where} ORDER BY created_at`, params);
  return normalizeRows(result.rows);
}

export async function createMatchRun(input, userEmail) {
  const record = {
    ...input,
    created_by: userEmail
  };

  if (!databaseConfigured) {
    const matchRun = createRecord(record);
    store.matchRuns.set(matchRun.id, matchRun);
    return matchRun;
  }

  const { columns, placeholders, values } = insertFields(record);
  const result = await query(`INSERT INTO match_runs (${columns}) VALUES (${placeholders}) RETURNING *`, values);
  return normalize(result.rows[0]);
}
