import { createAuditLog } from "../db/repository.js";

export async function writeAudit({
  action,
  actorUser,
  relationshipId = null,
  caseId = null,
  previousState = null,
  nextState = null,
  reason = null,
  metadata = {}
}) {
  return createAuditLog({
    relationship_id: relationshipId,
    case_id: caseId,
    action,
    previous_state: previousState,
    next_state: nextState,
    actor_user: actorUser,
    reason,
    metadata
  });
}
