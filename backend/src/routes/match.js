import { Router } from "express";

import { createMatchRun, getCase, getLatestMatchRun, listActors } from "../db/repository.js";
import { currentUser } from "../middleware/auth.js";
import { evaluateActor } from "../services/compliance.js";
import { createRelationship } from "./relationships.js";

export const matchRouter = Router();

const MATCH_SERVICE_URL = (process.env.MATCH_SERVICE_URL || "").replace(/\/$/, "");

function candidateRoles(matchType) {
  if (matchType === "referral") return new Set(["cardiologist"]);
  if (matchType === "surgical_team") return new Set(["cardiothoracic_surgeon", "anaesthetist", "nurse"]);
  return new Set(["physiotherapist", "dietitian", "pharmacist"]);
}

function relationshipType(matchType) {
  return {
    referral: "gp_to_specialist_referral",
    surgical_team: "surgeon_to_team_member",
    allied_health: "ward_to_allied_health"
  }[matchType];
}

async function runMatch(matchType, payload, userEmail) {
  // Demo short-circuit: if a curated match_run already exists for this
  // (case, match_type), reuse it so each patient keeps its hand-picked
  // recommendation instead of being re-ranked to the globally top-scored actor.
  const existing = await getLatestMatchRun(payload.case_id, matchType);
  if (existing && Array.isArray(existing.recommended_actor_ids) && existing.recommended_actor_ids.length > 0) {
    return {
      match_type: matchType,
      case_id: payload.case_id,
      recommended_actor_ids: existing.recommended_actor_ids,
      recommended_relationship_ids: existing.recommended_relationship_ids || [],
      match_score: Number(existing.score_breakdown?.outcome_weight ?? 1) * 80,
      score_breakdown: existing.score_breakdown || {},
      compliance_result: existing.compliance_summary || { status: "passed", passed: true, flags: {}, blocked_reasons: [] },
      explanation: existing.explanation || `${matchType.replace("_", " ")} match from curated demo seed.`
    };
  }

  if (MATCH_SERVICE_URL) {
    try {
      return await runMatchAI(matchType, payload, userEmail);
    } catch (error) {
      console.warn(`[match] AI service failed, falling back to demo logic: ${error.message}`);
    }
  }
  return runMatchDemo(matchType, payload, userEmail);
}

async function runMatchDemo(matchType, payload, userEmail) {
  const careCase = await getCase(payload.case_id);
  if (!careCase) {
    const error = new Error("Case not found");
    error.statusCode = 404;
    throw error;
  }

  const roles = candidateRoles(matchType);
  const selected = (await listActors())
    .filter((actor) => roles.has(actor.role))
    .sort((a, b) => Number(b.outcome_weight || 1) - Number(a.outcome_weight || 1))
    .slice(0, matchType === "surgical_team" ? 4 : 3);

  const complianceResults = selected.map((actor) => evaluateActor(actor));
  const blockedReasons = complianceResults.flatMap((result) => result.blocked_reasons);
  const compliancePassed = blockedReasons.length === 0;
  const totalOutcomeWeight = selected.reduce((sum, actor) => sum + Number(actor.outcome_weight || 1), 0);
  const matchScore = Number(((totalOutcomeWeight / Math.max(selected.length, 1)) * 80).toFixed(2));
  const scoreBreakdown = {
    vector_similarity: 0.82,
    rule_compliance: compliancePassed ? 1 : 0,
    outcome_weight: Number(totalOutcomeWeight.toFixed(2)),
    deterministic_demo: true
  };

  const relationshipIds = [];
  if (payload.create_relationships && payload.requested_by_actor_id) {
    for (const actor of selected) {
      const relationship = await createRelationship(
        {
          case_id: payload.case_id,
          relationship_type: relationshipType(matchType),
          actor_a_id: payload.requested_by_actor_id,
          actor_b_id: actor.id,
          match_score: matchScore,
          score_breakdown: scoreBreakdown,
          case_context: payload.context || {}
        },
        userEmail
      );
      relationshipIds.push(relationship.id);
    }
  }

  const response = {
    match_type: matchType,
    case_id: payload.case_id,
    recommended_actor_ids: selected.map((actor) => actor.id),
    recommended_relationship_ids: relationshipIds,
    match_score: matchScore,
    score_breakdown: scoreBreakdown,
    compliance_result: {
      status: compliancePassed ? "passed" : "blocked",
      passed: compliancePassed,
      flags: { selected_count: selected.length },
      blocked_reasons: blockedReasons
    },
    explanation: `${matchType.replace("_", " ")} match generated from seeded CareLink actors.`
  };

  await createMatchRun({
    case_id: payload.case_id,
    match_type: matchType,
    input_context: payload.context || {},
    recommended_actor_ids: response.recommended_actor_ids,
    recommended_relationship_ids: relationshipIds,
    score_breakdown: scoreBreakdown,
    compliance_summary: response.compliance_result,
    explanation: response.explanation
  }, userEmail);

  return response;
}

// ── AI match service (Python FastAPI on Cloud Run) ────────────────────────
//
// Delegates ranking to carelink-match-service, which uses pgvector + Vertex AI
// embeddings to score actors against the patient case. The service returns
// per-candidate score breakdowns; we translate that into the existing
// `runMatchDemo`-shaped response so the frontend keeps working unchanged.

function buildCaseCtx(careCase) {
  return {
    case_id:          careCase.id,
    diagnosis:        careCase.diagnosis ?? undefined,
    payer:            careCase.payer ?? undefined,
    location:         careCase.location ?? undefined,
    urgency:          careCase.urgency ?? undefined,
    procedure:        careCase.clinical_context?.procedure ?? undefined,
    clinical_context: careCase.clinical_context ?? undefined,
  };
}

async function callMatchService(matchType, careCase) {
  const path = matchType.replace("_", "-"); // surgical_team → surgical-team
  const url = `${MATCH_SERVICE_URL}/match/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_ctx: buildCaseCtx(careCase), top_n: 3 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`match service ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function uniqueWarnings(candidates) {
  const seen = new Set();
  for (const c of candidates ?? []) {
    for (const w of c?.score_breakdown?.warnings ?? []) seen.add(w);
  }
  return [...seen];
}

function flattenScoreBreakdown(matchResult) {
  // Referral returns top-level `score_breakdown`. Team endpoints don't, so
  // synthesize from the first recommended candidate.
  const sb = matchResult.score_breakdown
    ?? Object.values(matchResult.recommended_team ?? {})[0]?.score_breakdown
    ?? {};
  return {
    vector_similarity: sb.vector_similarity ?? 0,
    rule_compliance:   sb.rule_compliance ?? 1,
    outcome_weight:    sb.outcome_weight ?? 0,
    deterministic_demo: false,
  };
}

async function topActorByRole(role) {
  const actors = await listActors();
  return actors
    .filter((a) => a.role === role)
    .sort((a, b) => Number(b.outcome_weight || 1) - Number(a.outcome_weight || 1))[0];
}

async function recommendedActorIdsFromMatch(matchType, matchResult) {
  if (matchType === "referral") {
    return Array.isArray(matchResult.top_actor_ids) ? matchResult.top_actor_ids : [];
  }
  if (matchType === "surgical_team") {
    // The AI service ranks anaesthetist/nurse/perfusionist only. Prepend the
    // top deterministic cardiothoracic_surgeon so the UI's 4-role layout
    // still gets a Lead Surgeon.
    const team = matchResult.recommended_team ?? {};
    const ids = [];
    const surgeon = await topActorByRole("cardiothoracic_surgeon");
    if (surgeon) ids.push(surgeon.id);
    for (const role of ["anaesthetist", "nurse", "perfusionist"]) {
      if (team[role]?.id) ids.push(team[role].id);
    }
    return ids;
  }
  // allied_health
  const team = matchResult.recommended_team ?? {};
  return ["physiotherapist", "dietitian", "pharmacist"]
    .map((role) => team[role]?.id)
    .filter(Boolean);
}

async function runMatchAI(matchType, payload, userEmail) {
  const careCase = await getCase(payload.case_id);
  if (!careCase) {
    const error = new Error("Case not found");
    error.statusCode = 404;
    throw error;
  }

  const matchResult = await callMatchService(matchType, careCase);
  const recommendedActorIds = await recommendedActorIdsFromMatch(matchType, matchResult);

  // Pick a representative match score: the top candidate's score (0..1) → 0..100.
  const firstCandidateScore = (() => {
    if (matchType === "referral") return matchResult.candidates?.[0]?.score ?? 0;
    const team = matchResult.recommended_team ?? {};
    const first = Object.values(team)[0];
    return first?.score ?? matchResult.team_score?.team_score ?? 0;
  })();
  const matchScore = Number((firstCandidateScore * 100).toFixed(2));

  const scoreBreakdown = flattenScoreBreakdown(matchResult);

  // Combine warnings across all candidates (referral) or across the team
  // (surgical/allied) into compliance flags.
  const allCandidates = matchResult.candidates
    ?? Object.values(matchResult.candidates_by_role ?? {}).flat();
  const blockedReasons = uniqueWarnings(allCandidates);
  const compliancePassed = blockedReasons.length === 0;

  const relationshipIds = [];
  if (payload.create_relationships && payload.requested_by_actor_id) {
    for (const actorId of recommendedActorIds) {
      const relationship = await createRelationship({
        case_id: payload.case_id,
        relationship_type: relationshipType(matchType),
        actor_a_id: payload.requested_by_actor_id,
        actor_b_id: actorId,
        match_score: matchScore,
        score_breakdown: scoreBreakdown,
        case_context: payload.context || {},
      }, userEmail);
      relationshipIds.push(relationship.id);
    }
  }

  const response = {
    match_type: matchType,
    case_id: payload.case_id,
    recommended_actor_ids: recommendedActorIds,
    recommended_relationship_ids: relationshipIds,
    match_score: matchScore,
    score_breakdown: scoreBreakdown,
    compliance_result: {
      status: compliancePassed ? "passed" : "warning",
      passed: compliancePassed,
      flags: { selected_count: recommendedActorIds.length },
      blocked_reasons: blockedReasons,
    },
    explanation: `AI-ranked via pgvector + Vertex AI embeddings · top score ${matchScore.toFixed(0)}/100`
      + (blockedReasons.length ? ` · warnings: ${blockedReasons.join(", ")}` : ""),
  };

  await createMatchRun({
    case_id: payload.case_id,
    match_type: matchType,
    input_context: payload.context || {},
    recommended_actor_ids: response.recommended_actor_ids,
    recommended_relationship_ids: relationshipIds,
    score_breakdown: scoreBreakdown,
    compliance_summary: response.compliance_result,
    explanation: response.explanation,
  }, userEmail);

  return response;
}

for (const [path, matchType] of [
  ["/referral", "referral"],
  ["/surgical-team", "surgical_team"],
  ["/allied-health", "allied_health"]
]) {
  matchRouter.post(path, currentUser, async (req, res, next) => {
    try {
      return res.json(await runMatch(matchType, req.body, req.userEmail));
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ detail: error.message });
      return next(error);
    }
  });
}
