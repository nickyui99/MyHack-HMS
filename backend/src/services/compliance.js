export function evaluateActor(actor, requiredSpecialty = null) {
  const flags = {};
  const blockedReasons = [];
  const today = new Date().toISOString().slice(0, 10);

  if (actor.apc_expiry_date && actor.apc_expiry_date < today) {
    flags.apc_expired = true;
    blockedReasons.push(`${actor.name} has an expired APC dated ${actor.apc_expiry_date}.`);
  } else {
    flags.apc_valid = true;
  }

  const capacity = String(actor.capacity_status || "available").toLowerCase();
  if (!["available", "limited"].includes(capacity)) {
    flags.capacity_blocked = actor.capacity_status;
    blockedReasons.push(`${actor.name} capacity is ${actor.capacity_status}.`);
  } else {
    flags.capacity_ok = actor.capacity_status;
  }

  if (requiredSpecialty && actor.specialty && actor.specialty !== requiredSpecialty) {
    flags.specialty_mismatch = { required: requiredSpecialty, actual: actor.specialty };
    blockedReasons.push(`${actor.name} specialty is ${actor.specialty}, not ${requiredSpecialty}.`);
  }

  return {
    status: blockedReasons.length === 0 ? "passed" : "blocked",
    passed: blockedReasons.length === 0,
    flags,
    blocked_reasons: blockedReasons
  };
}
