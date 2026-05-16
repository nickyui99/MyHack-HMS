// One-off read-only check. Uses the active gcloud user's ADC, NOT SA impersonation.
// Override env to skip impersonation and use the gcloud user as the DB user.
process.env.CARELINK_IMPERSONATE_SERVICE_ACCOUNT = "";
process.env.CARELINK_DB_USER = process.env.CARELINK_GCLOUD_USER || "nicholasooi10@gmail.com";

const { createPool } = await import("../src/db/cloudSql.js");
const pool = await createPool();

async function safe(label, sql) {
  try {
    const { rows } = await pool.query(sql);
    console.log(`[ok] ${label}:`, JSON.stringify(rows));
  } catch (err) {
    console.log(`[err] ${label}: ${err.message}`);
  }
}

await safe("pgvector extension", "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'");
await safe("public tables", "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
await safe("actors count", "SELECT count(*)::int AS n FROM actors");
await safe("cases count", "SELECT count(*)::int AS n FROM cases");
await safe("relationships count", "SELECT count(*)::int AS n FROM relationships");

await pool.end();
