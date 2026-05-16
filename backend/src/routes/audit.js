import { Router } from "express";

import { store } from "../db/store.js";

export const auditRouter = Router();

auditRouter.get("/", (req, res) => {
  let logs = [...store.auditLogs.values()];
  if (req.query.relationship_id) {
    logs = logs.filter((log) => log.relationship_id === req.query.relationship_id);
  }
  if (req.query.case_id) {
    logs = logs.filter((log) => log.case_id === req.query.case_id);
  }
  logs.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return res.json(logs);
});
