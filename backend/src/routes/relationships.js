import { Router } from "express";

import {
  createRelationshipRecord,
  getActor,
  getCase,
  getRelationship,
  listRelationships,
  updateRelationshipState
} from "../db/repository.js";
import { currentUser } from "../middleware/auth.js";
import { evaluateActor } from "../services/compliance.js";
import { writeAudit } from "../services/audit.js";

export const relationshipsRouter = Router();

export async function createRelationship(payload, userEmail) {
  const careCase = await getCase(payload.case_id);
  if (!careCase) {
    const error = new Error("Case not found");
    error.statusCode = 404;
    throw error;
  }
  const sourceActor = await getActor(payload.actor_a_id);
  const targetActor = await getActor(payload.actor_b_id);
  if (!sourceActor || !targetActor) {
    const error = new Error("Actor not found");
    error.statusCode = 404;
    throw error;
  }

  const compliance = evaluateActor(targetActor);
  const relationship = await createRelationshipRecord({
    ...payload,
    state: compliance.passed ? "proposed" : "compliance_blocked",
    compliance_status: compliance.status,
    compliance_flags: compliance.flags,
    outcome_record: null,
    created_by: userEmail,
    approved_by: null
  }, userEmail);

  await writeAudit({
    action: "relationship_created",
    actorUser: userEmail,
    relationshipId: relationship.id,
    caseId: relationship.case_id,
    nextState: relationship.state,
    metadata: { compliance }
  });

  if (!compliance.passed) {
    await writeAudit({
      action: "compliance_blocked",
      actorUser: userEmail,
      relationshipId: relationship.id,
      caseId: relationship.case_id,
      reason: compliance.blocked_reasons.join("; "),
      metadata: compliance
    });
  }

  return relationship;
}

relationshipsRouter.get("/", async (req, res, next) => {
  try {
    const relationships = await listRelationships(req.query);
    res.json(relationships);
  } catch (error) {
    next(error);
  }
});

relationshipsRouter.post("/", currentUser, async (req, res, next) => {
  try {
    const relationship = await createRelationship(req.body, req.userEmail);
    return res.status(201).json(relationship);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ detail: error.message });
    return next(error);
  }
});

relationshipsRouter.patch("/:relationshipId/state", currentUser, async (req, res, next) => {
  try {
    const previousRelationship = await getRelationship(req.params.relationshipId);
    if (!previousRelationship) return res.status(404).json({ detail: "Relationship not found" });

    const previousState = previousRelationship.state;
    const relationship = await updateRelationshipState(req.params.relationshipId, req.body.state, req.userEmail);

    await writeAudit({
      action: "state_changed",
      actorUser: req.userEmail,
      relationshipId: relationship.id,
      caseId: relationship.case_id,
      previousState,
      nextState: req.body.state,
      reason: req.body.reason
    });

    return res.json(relationship);
  } catch (error) {
    next(error);
  }
});
