import { app } from "../src/app.js";
import { closeDatabase } from "../src/db/repository.js";

const externalBaseUrl = process.env.CARELINK_TEST_BASE_URL;
let server;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(baseUrl, method, path, body, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (response.status !== expectedStatus) {
    throw new Error(`${method} ${path} expected ${expectedStatus}, got ${response.status}: ${text}`);
  }

  console.log(`${method.padEnd(6)} ${path.padEnd(36)} ${response.status}`);
  return data;
}

async function startServer() {
  if (externalBaseUrl) return externalBaseUrl.replace(/\/$/, "");

  return await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function stopServer() {
  await new Promise((resolve, reject) => {
    if (!server) return resolve();
    return server.close((error) => (error ? reject(error) : resolve()));
  });
  await closeDatabase();
}

const baseUrl = await startServer();

try {
  const health = await request(baseUrl, "GET", "/health");
  assert(health.status === "ok", "Health response contract failed");

  const openapi = await request(baseUrl, "GET", "/openapi.json");
  assert(openapi.openapi && openapi.paths, "OpenAPI response contract failed");

  const actors = await request(baseUrl, "GET", "/actors");
  assert(Array.isArray(actors) && actors.length > 0, "GET /actors returned no actors");

  const gps = await request(baseUrl, "GET", "/actors?role=gp");
  assert(Array.isArray(gps) && gps.length > 0, "GET /actors?role=gp returned no actors");
  const sourceActor = gps[0];

  const availableActors = await request(baseUrl, "GET", "/actors?available=true");
  assert(Array.isArray(availableActors) && availableActors.length > 0, "GET /actors?available=true returned no actors");

  const createdActor = await request(
    baseUrl,
    "POST",
    "/actors",
    {
      actor_type: "specialist",
      name: `Endpoint Test Cardiologist ${Date.now()}`,
      role: "cardiologist",
      specialty: "cardiology",
      hospital: "Endpoint Test Hospital",
      location: "Bandar Sunway",
      insurance_panels: ["Prudential BSN"],
      languages: ["English", "Malay"],
      credentials: { test: true },
      apc_number: "APC-2026-ENDPOINT",
      apc_expiry_date: "2026-12-31",
      capacity_status: "available",
      outcome_weight: 1.05,
      profile_text: "Created by endpoint test script."
    },
    201
  );
  assert(createdActor.id, "POST /actors did not return an id");

  const fetchedActor = await request(baseUrl, "GET", `/actors/${createdActor.id}`);
  assert(fetchedActor.id === createdActor.id, "GET /actors/{actorId} returned the wrong actor");

  const cases = await request(baseUrl, "GET", "/cases");
  assert(Array.isArray(cases), "GET /cases did not return an array");

  const createdCase = await request(
    baseUrl,
    "POST",
    "/cases",
    {
      patient_name: `Endpoint Test Patient ${Date.now()}`,
      patient_age: 58,
      patient_gender: "male",
      diagnosis: "NSTEMI",
      case_stage: "referral",
      payer: "Prudential BSN",
      location: "Puchong",
      urgency: "urgent",
      clinical_context: { source: "endpoint-test" }
    },
    201
  );
  assert(createdCase.id, "POST /cases did not return an id");

  const referralCases = await request(baseUrl, "GET", "/cases?case_stage=referral");
  assert(Array.isArray(referralCases) && referralCases.some((item) => item.id === createdCase.id), "GET /cases?case_stage=referral did not include created case");

  const fetchedCase = await request(baseUrl, "GET", `/cases/${createdCase.id}`);
  assert(fetchedCase.id === createdCase.id, "GET /cases/{caseId} returned the wrong case");

  const createdRelationship = await request(
    baseUrl,
    "POST",
    "/relationships",
    {
      case_id: createdCase.id,
      relationship_type: "gp_to_specialist_referral",
      actor_a_id: sourceActor.id,
      actor_b_id: createdActor.id,
      match_score: 91.5,
      score_breakdown: { endpoint_test: true },
      case_context: { source: "endpoint-test" }
    },
    201
  );
  assert(createdRelationship.id, "POST /relationships did not return an id");

  const relationships = await request(baseUrl, "GET", `/relationships?case_id=${createdCase.id}`);
  assert(Array.isArray(relationships) && relationships.some((item) => item.id === createdRelationship.id), "GET /relationships?case_id did not include created relationship");

  const proposedRelationships = await request(baseUrl, "GET", "/relationships?state=proposed");
  assert(Array.isArray(proposedRelationships), "GET /relationships?state=proposed did not return an array");

  const patchedRelationship = await request(
    baseUrl,
    "PATCH",
    `/relationships/${createdRelationship.id}/state`,
    { state: "active", reason: "Endpoint test activation" }
  );
  assert(patchedRelationship.state === "active", "PATCH /relationships/{relationshipId}/state did not update state");

  const referralMatch = await request(
    baseUrl,
    "POST",
    "/match/referral",
    {
      case_id: createdCase.id,
      requested_by_actor_id: sourceActor.id,
      create_relationships: true,
      context: { source: "endpoint-test", match_type: "referral" }
    }
  );
  assert(referralMatch.match_type === "referral" && referralMatch.recommended_actor_ids.length > 0, "POST /match/referral contract failed");

  const surgicalMatch = await request(
    baseUrl,
    "POST",
    "/match/surgical-team",
    {
      case_id: createdCase.id,
      requested_by_actor_id: sourceActor.id,
      create_relationships: false,
      context: { source: "endpoint-test", match_type: "surgical_team" }
    }
  );
  assert(surgicalMatch.match_type === "surgical_team" && surgicalMatch.recommended_actor_ids.length > 0, "POST /match/surgical-team contract failed");

  const alliedMatch = await request(
    baseUrl,
    "POST",
    "/match/allied-health",
    {
      case_id: createdCase.id,
      requested_by_actor_id: sourceActor.id,
      create_relationships: false,
      context: { source: "endpoint-test", match_type: "allied_health" }
    }
  );
  assert(alliedMatch.match_type === "allied_health" && alliedMatch.recommended_actor_ids.length > 0, "POST /match/allied-health contract failed");

  const completedRelationships = await request(
    baseUrl,
    "POST",
    "/outcomes",
    {
      relationship_ids: [createdRelationship.id],
      outcome_record: { endpoint_test: true, result: "completed" },
      reason: "Endpoint test outcome"
    }
  );
  assert(Array.isArray(completedRelationships) && completedRelationships[0]?.state === "completed", "POST /outcomes contract failed");

  const auditByCase = await request(baseUrl, "GET", `/audit?case_id=${createdCase.id}`);
  assert(Array.isArray(auditByCase) && auditByCase.length > 0, "GET /audit?case_id returned no audit logs");

  const auditByRelationship = await request(baseUrl, "GET", `/audit?relationship_id=${createdRelationship.id}`);
  assert(Array.isArray(auditByRelationship) && auditByRelationship.length > 0, "GET /audit?relationship_id returned no audit logs");

  console.log(`\nEndpoint test passed against ${baseUrl}`);
} finally {
  await stopServer();
}
