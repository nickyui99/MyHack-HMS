import { Router } from "express";

import { createActor, getActor, listActors } from "../db/repository.js";
import { currentUser } from "../middleware/auth.js";

export const actorsRouter = Router();

actorsRouter.get("/", async (req, res, next) => {
  try {
    const actors = await listActors(req.query);
    res.json(actors);
  } catch (error) {
    next(error);
  }
});

actorsRouter.get("/:actorId", async (req, res, next) => {
  try {
    const actor = await getActor(req.params.actorId);
    if (!actor) return res.status(404).json({ detail: "Actor not found" });
    return res.json(actor);
  } catch (error) {
    next(error);
  }
});

actorsRouter.post("/", currentUser, async (req, res, next) => {
  try {
    const actor = await createActor(req.body);
    return res.status(201).json(actor);
  } catch (error) {
    next(error);
  }
});
