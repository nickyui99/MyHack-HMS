process.env.CARELINK_SKIP_ENV_FILE = "true";

const { app } = await import("../src/app.js");

const server = app.listen(0, async () => {
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
    if (health.status !== "ok") throw new Error("Health check failed");

    const actors = await fetch(`${baseUrl}/actors?role=cardiologist`).then((res) => res.json());
    if (!Array.isArray(actors) || actors.length === 0) throw new Error("Actor filter failed");

    const careCase = await fetch(`${baseUrl}/cases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patient_name: "Encik Zainal",
        patient_age: 58,
        patient_gender: "male",
        diagnosis: "NSTEMI",
        case_stage: "referral",
        payer: "Prudential BSN",
        location: "Puchong",
        urgency: "urgent"
      })
    }).then((res) => res.json());

    const gp = await fetch(`${baseUrl}/actors?role=gp`).then((res) => res.json()).then((rows) => rows[0]);
    const match = await fetch(`${baseUrl}/match/referral`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        case_id: careCase.id,
        requested_by_actor_id: gp.id,
        create_relationships: true,
        context: { demo: true }
      })
    }).then((res) => res.json());

    if (!match.score_breakdown || !match.compliance_result) throw new Error("Match response contract failed");

    const audit = await fetch(`${baseUrl}/audit?case_id=${careCase.id}`).then((res) => res.json());
    if (!Array.isArray(audit) || audit.length === 0) throw new Error("Audit log failed");

    console.log("Smoke check passed");
  } finally {
    server.close();
  }
});
