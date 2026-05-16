import { Router } from "express";

import { listAuditLogs } from "../db/repository.js";

export const auditRouter = Router();

auditRouter.get("/", async (req, res, next) => {
  try {
    const logs = await listAuditLogs(req.query);
    return res.json(logs);
  } catch (error) {
    next(error);
  }
});
