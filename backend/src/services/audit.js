import { createRecord, store } from "../db/store.js";

export function writeAudit({
  action,
  actorUser,
  relationshipId = null,
  caseId = null,
  previousState = null,
  nextState = null,
  reason = null,
  metadata = {}
}) {
  const log = createRecord({
    relationship_id: relationshipId,
    case_id: caseId,
    action,
    previous_state: previousState,
    next_state: nextState,
    actor_user: actorUser,
    reason,
    metadata
  });
  store.auditLogs.set(log.id, log);
  return log;
}
