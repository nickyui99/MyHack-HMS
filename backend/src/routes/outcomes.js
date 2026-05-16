import { Router } from "express";

import { store } from "../db/store.js";
import { currentUser } from "../middleware/auth.js";
import { writeAudit } from "../services/audit.js";

export const outcomesRouter = Router();

outcomesRouter.post("/", currentUser, (req, res) => {
  const updated = [];
  for (const relationshipId of req.body.relationship_ids || []) {
    const relationship = store.relationships.get(relationshipId);
    if (!relationship) return res.status(404).json({ detail: `Relationship ${relationshipId} not found` });

    const previousState = relationship.state;
    relationship.outcome_record = req.body.outcome_record || {};
    relationship.state = "completed";
    relationship.updated_at = new Date().toISOString();
    store.relationships.set(relationship.id, relationship);
    updated.push(relationship);

    writeAudit({
      action: "outcome_logged",
      actorUser: req.userEmail,
      relationshipId: relationship.id,
      caseId: relationship.case_id,
      previousState,
      nextState: "completed",
      reason: req.body.reason,
      metadata: relationship.outcome_record
    });
  }
  return res.json(updated);
});
