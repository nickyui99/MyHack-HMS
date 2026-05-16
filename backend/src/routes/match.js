import { Router } from "express";

import { createRecord, store } from "../db/store.js";
import { currentUser } from "../middleware/auth.js";
import { evaluateActor } from "../services/compliance.js";
import { createRelationship } from "./relationships.js";

export const matchRouter = Router();

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

function runMatch(matchType, payload, userEmail) {
  if (!store.cases.has(payload.case_id)) {
    const error = new Error("Case not found");
    error.statusCode = 404;
    throw error;
  }

  const roles = candidateRoles(matchType);
  const selected = [...store.actors.values()]
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
      const relationship = createRelationship(
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

  const matchRun = createRecord({
    case_id: payload.case_id,
    match_type: matchType,
    input_context: payload.context || {},
    recommended_actor_ids: response.recommended_actor_ids,
    recommended_relationship_ids: relationshipIds,
    score_breakdown: scoreBreakdown,
    compliance_summary: response.compliance_result,
    explanation: response.explanation,
    created_by: userEmail
  });
  store.matchRuns.set(matchRun.id, matchRun);

  return response;
}

for (const [path, matchType] of [
  ["/referral", "referral"],
  ["/surgical-team", "surgical_team"],
  ["/allied-health", "allied_health"]
]) {
  matchRouter.post(path, currentUser, (req, res) => {
    try {
      return res.json(runMatch(matchType, req.body, req.userEmail));
    } catch (error) {
      return res.status(error.statusCode || 500).json({ detail: error.message });
    }
  });
}
