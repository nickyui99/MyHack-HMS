import { Router } from "express";

import { completeRelationships, getRelationship } from "../db/repository.js";
import { currentUser } from "../middleware/auth.js";
import { writeAudit } from "../services/audit.js";

export const outcomesRouter = Router();

outcomesRouter.post("/", currentUser, async (req, res, next) => {
  try {
    const relationshipIds = req.body.relationship_ids || [];
    const previousById = new Map();
    for (const relationshipId of relationshipIds) {
      const relationship = await getRelationship(relationshipId);
      if (!relationship) return res.status(404).json({ detail: `Relationship ${relationshipId} not found` });
      previousById.set(relationshipId, relationship);
    }

    const updated = await completeRelationships(relationshipIds, req.body.outcome_record);

    for (const relationship of updated) {
      const previous = previousById.get(relationship.id);
      await writeAudit({
        action: "outcome_logged",
        actorUser: req.userEmail,
        relationshipId: relationship.id,
        caseId: relationship.case_id,
        previousState: previous.state,
        nextState: "completed",
        reason: req.body.reason,
        metadata: relationship.outcome_record
      });
    }

    return res.json(updated);
  } catch (error) {
    next(error);
  }
});
