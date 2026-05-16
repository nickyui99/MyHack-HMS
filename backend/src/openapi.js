export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "CareLink API",
    version: "0.1.0",
    description: "Backend API for actors, cases, relationships, matching, outcomes, and audit logs."
  },
  paths: {
    "/health": { get: { summary: "Health check" } },
    "/actors": { get: { summary: "List actors" }, post: { summary: "Create actor" } },
    "/actors/{actorId}": { get: { summary: "Get actor" } },
    "/cases": { get: { summary: "List cases" }, post: { summary: "Create case" } },
    "/cases/{caseId}": { get: { summary: "Get case" } },
    "/relationships": { get: { summary: "List relationships" }, post: { summary: "Create relationship" } },
    "/relationships/{relationshipId}/state": { patch: { summary: "Update relationship state" } },
    "/match/referral": { post: { summary: "Run referral match" } },
    "/match/surgical-team": { post: { summary: "Run surgical team match" } },
    "/match/allied-health": { post: { summary: "Run allied health match" } },
    "/outcomes": { post: { summary: "Log outcome" } },
    "/audit": { get: { summary: "List audit logs" } }
  }
};
