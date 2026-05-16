import { Router } from "express";

import { createRecord, store } from "../db/store.js";
import { currentUser } from "../middleware/auth.js";
import { evaluateActor } from "../services/compliance.js";
import { writeAudit } from "../services/audit.js";

export const relationshipsRouter = Router();

export function createRelationship(payload, userEmail) {
  if (!store.cases.has(payload.case_id)) {
    const error = new Error("Case not found");
    error.statusCode = 404;
    throw error;
  }
  if (!store.actors.has(payload.actor_a_id) || !store.actors.has(payload.actor_b_id)) {
    const error = new Error("Actor not found");
    error.statusCode = 404;
    throw error;
  }

  const targetActor = store.actors.get(payload.actor_b_id);
  const compliance = evaluateActor(targetActor);
  const relationship = createRecord({
    ...payload,
    state: compliance.passed ? "proposed" : "compliance_blocked",
    compliance_status: compliance.status,
    compliance_flags: compliance.flags,
    outcome_record: null,
    created_by: userEmail,
    approved_by: null
  });
  store.relationships.set(relationship.id, relationship);

  writeAudit({
    action: "relationship_created",
    actorUser: userEmail,
    relationshipId: relationship.id,
    caseId: relationship.case_id,
    nextState: relationship.state,
    metadata: { compliance }
  });

  if (!compliance.passed) {
    writeAudit({
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

relationshipsRouter.get("/", (req, res) => {
  let relationships = [...store.relationships.values()];
  if (req.query.case_id) {
    relationships = relationships.filter((rel) => rel.case_id === req.query.case_id);
  }
  if (req.query.state) {
    relationships = relationships.filter((rel) => rel.state === req.query.state);
  }
  res.json(relationships);
});

relationshipsRouter.post("/", currentUser, (req, res) => {
  try {
    const relationship = createRelationship(req.body, req.userEmail);
    return res.status(201).json(relationship);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ detail: error.message });
  }
});

relationshipsRouter.patch("/:relationshipId/state", currentUser, (req, res) => {
  const relationship = store.relationships.get(req.params.relationshipId);
  if (!relationship) return res.status(404).json({ detail: "Relationship not found" });

  const previousState = relationship.state;
  relationship.state = req.body.state;
  relationship.updated_at = new Date().toISOString();
  if (["approved", "active"].includes(req.body.state)) relationship.approved_by = req.userEmail;
  store.relationships.set(relationship.id, relationship);

  writeAudit({
    action: "state_changed",
    actorUser: req.userEmail,
    relationshipId: relationship.id,
    caseId: relationship.case_id,
    previousState,
    nextState: req.body.state,
    reason: req.body.reason
  });

  return res.json(relationship);
});
