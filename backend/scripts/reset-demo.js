// Wipes patient-side tables and re-seeds 10 demo patients with different
// doctor recommendations. Actors are preserved.
//
// Run locally against prod Cloud SQL (uses gcloud ADC, not SA impersonation):
//   gcloud auth application-default login
//   node backend/scripts/reset-demo.js

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Impersonate the runtime service account — it has DML grants on the carelink tables.
// Your gcloud user must have roles/iam.serviceAccountTokenCreator on this SA.
process.env.CARELINK_IMPERSONATE_SERVICE_ACCOUNT ||= "carelink-runtime@hackathon-myhack.iam.gserviceaccount.com";
process.env.CARELINK_DB_USER ||= "carelink-runtime@hackathon-myhack.iam";
process.env.CARELINK_CLOUD_SQL_INSTANCE ||= "hackathon-myhack:asia-southeast1:postgres";
process.env.CARELINK_DB_NAME ||= "carelink";
process.env.CARELINK_CLOUD_SQL_IP_TYPE ||= "PUBLIC";

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(here, "..", "migrations", "004_reset_demo_10_patients.sql");
const sql = await readFile(sqlPath, "utf8");

const { createPool } = await import("../src/db/cloudSql.js");
const pool = await createPool();

console.log(`Running ${sqlPath} against ${process.env.CARELINK_CLOUD_SQL_INSTANCE}/${process.env.CARELINK_DB_NAME} as ${process.env.CARELINK_DB_USER}`);

try {
  const result = await pool.query(sql);
  const tail = Array.isArray(result) ? result[result.length - 1] : result;
  if (tail?.rows) {
    console.log("\nRow counts:");
    for (const r of tail.rows) console.log(`  ${r.table.padEnd(15)} ${r.n}`);
  } else {
    console.log("OK");
  }
} finally {
  await pool.end();
}
