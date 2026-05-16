import { Router } from "express";

import { createRecord, store } from "../db/store.js";
import { currentUser } from "../middleware/auth.js";

export const casesRouter = Router();

casesRouter.get("/", (req, res) => {
  let cases = [...store.cases.values()];
  if (req.query.case_stage) {
    cases = cases.filter((careCase) => careCase.case_stage === req.query.case_stage);
  }
  res.json(cases);
});

casesRouter.get("/:caseId", (req, res) => {
  const careCase = store.cases.get(req.params.caseId);
  if (!careCase) return res.status(404).json({ detail: "Case not found" });
  return res.json(careCase);
});

casesRouter.post("/", currentUser, (req, res) => {
  const careCase = createRecord({
    clinical_context: {},
    ...req.body,
    created_by: req.userEmail
  });
  store.cases.set(careCase.id, careCase);
  return res.status(201).json(careCase);
});
