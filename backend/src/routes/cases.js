import { Router } from "express";

import { createCase, getCase, listCases } from "../db/repository.js";
import { currentUser } from "../middleware/auth.js";

export const casesRouter = Router();

casesRouter.get("/", async (req, res, next) => {
  try {
    const cases = await listCases(req.query);
    res.json(cases);
  } catch (error) {
    next(error);
  }
});

casesRouter.get("/:caseId", async (req, res, next) => {
  try {
    const careCase = await getCase(req.params.caseId);
    if (!careCase) return res.status(404).json({ detail: "Case not found" });
    return res.json(careCase);
  } catch (error) {
    next(error);
  }
});

casesRouter.post("/", currentUser, async (req, res, next) => {
  try {
    const careCase = await createCase(req.body, req.userEmail);
    return res.status(201).json(careCase);
  } catch (error) {
    next(error);
  }
});
