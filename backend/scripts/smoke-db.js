import { app } from "../src/app.js";
import { closeDatabase, isDatabaseConfigured } from "../src/db/repository.js";

if (!isDatabaseConfigured()) {
  console.error("Set CARELINK_DATABASE_URL before running the DB smoke test.");
  process.exit(1);
}

const server = app.listen(0, async () => {
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
    if (health.status !== "ok") throw new Error("Health check failed");

    const actors = await fetch(`${baseUrl}/actors`).then((res) => res.json());
    if (!Array.isArray(actors) || actors.length < 50) {
      throw new Error(`Expected seeded database actors, got ${Array.isArray(actors) ? actors.length : "non-array"}`);
    }

    const cardiologists = await fetch(`${baseUrl}/actors?role=cardiologist`).then((res) => res.json());
    if (!Array.isArray(cardiologists) || cardiologists.length === 0) {
      throw new Error("Actor role filter failed against database");
    }

    const cases = await fetch(`${baseUrl}/cases`).then((res) => res.json());
    if (!Array.isArray(cases) || cases.length < 3) {
      throw new Error(`Expected seeded database cases, got ${Array.isArray(cases) ? cases.length : "non-array"}`);
    }

    const careCase = await fetch(`${baseUrl}/cases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patient_name: "DB Smoke Patient",
        patient_age: 58,
        patient_gender: "male",
        diagnosis: "NSTEMI",
        case_stage: "referral",
        payer: "Prudential BSN",
        location: "Puchong",
        urgency: "urgent"
      })
    }).then((res) => res.json());
    if (!careCase.id) throw new Error("Database case create failed");

    const gp = await fetch(`${baseUrl}/actors?role=gp`).then((res) => res.json()).then((rows) => rows[0]);
    if (!gp?.id) throw new Error("Seeded GP lookup failed");

    const match = await fetch(`${baseUrl}/match/referral`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        case_id: careCase.id,
        requested_by_actor_id: gp.id,
        create_relationships: true,
        context: { smoke: "database" }
      })
    }).then((res) => res.json());

    if (!match.score_breakdown || !match.compliance_result || match.recommended_relationship_ids.length === 0) {
      throw new Error("Database match response contract failed");
    }

    const audit = await fetch(`${baseUrl}/audit?case_id=${careCase.id}`).then((res) => res.json());
    if (!Array.isArray(audit) || audit.length === 0) throw new Error("Database audit log failed");

    console.log("Database smoke check passed");
  } finally {
    server.close(async () => {
      await closeDatabase();
    });
  }
});
