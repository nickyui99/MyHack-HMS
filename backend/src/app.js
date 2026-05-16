import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { pingDatabase } from "./db/repository.js";
import { seedStore } from "./db/store.js";
import { actorsRouter } from "./routes/actors.js";
import { auditRouter } from "./routes/audit.js";
import { casesRouter } from "./routes/cases.js";
import { matchRouter } from "./routes/match.js";
import { outcomesRouter } from "./routes/outcomes.js";
import { relationshipsRouter } from "./routes/relationships.js";
import { openApiSpec } from "./openapi.js";

seedStore();

export const app = express();

app.use(cors({ origin: config.corsOrigins === "*" ? "*" : config.corsOrigins.split(",") }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  try {
    const db = await pingDatabase();
    res.json({ status: "ok", service: "carelink-api", db });
  } catch (error) {
    res.status(503).json({ status: "degraded", service: "carelink-api", db: { ok: false, error: error.message } });
  }
});

app.get("/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

app.use("/actors", actorsRouter);
app.use("/cases", casesRouter);
app.use("/relationships", relationshipsRouter);
app.use("/match", matchRouter);
app.use("/outcomes", outcomesRouter);
app.use("/audit", auditRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ detail: "Internal server error" });
});
