import { Router } from "express";

import { createRecord, store } from "../db/store.js";
import { currentUser } from "../middleware/auth.js";

export const actorsRouter = Router();

actorsRouter.get("/", (req, res) => {
  let actors = [...store.actors.values()];
  const { role, specialty, available, hospital } = req.query;

  if (role) actors = actors.filter((actor) => actor.role === role);
  if (specialty) actors = actors.filter((actor) => actor.specialty === specialty);
  if (hospital) actors = actors.filter((actor) => actor.hospital === hospital);
  if (available !== undefined) {
    const allowed = available === "true" ? ["available", "limited"] : ["unavailable", "full"];
    actors = actors.filter((actor) => allowed.includes(String(actor.capacity_status).toLowerCase()));
  }

  res.json(actors);
});

actorsRouter.get("/:actorId", (req, res) => {
  const actor = store.actors.get(req.params.actorId);
  if (!actor) return res.status(404).json({ detail: "Actor not found" });
  return res.json(actor);
});

actorsRouter.post("/", currentUser, (req, res) => {
  const actor = createRecord({
    insurance_panels: [],
    languages: [],
    credentials: {},
    capacity_status: "available",
    outcome_weight: 1,
    ...req.body
  });
  store.actors.set(actor.id, actor);
  return res.status(201).json(actor);
});
