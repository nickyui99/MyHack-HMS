import pg from "pg";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { GoogleAuth, Impersonated } from "google-auth-library";

import { config } from "../config.js";

function cloudSqlIpType() {
  return config.cloudSqlIpType === "PRIVATE" ? IpAddressTypes.PRIVATE : IpAddressTypes.PUBLIC;
}

async function connectorAuth() {
  if (!config.impersonateServiceAccount) return undefined;

  const sourceAuth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"]
  });
  const sourceClient = await sourceAuth.getClient();

  return new Impersonated({
    sourceClient,
    targetPrincipal: config.impersonateServiceAccount,
    targetScopes: [
      "https://www.googleapis.com/auth/sqlservice.admin",
      "https://www.googleapis.com/auth/sqlservice.login"
    ],
    lifetime: 3600
  });
}

export async function createPool() {
  if (config.databaseUrl) {
    return new pg.Pool({ connectionString: config.databaseUrl });
  }

  if (!config.cloudSqlInstance || !config.dbUser) {
    throw new Error(
      "Set CARELINK_DATABASE_URL for local Postgres or CARELINK_CLOUD_SQL_INSTANCE and CARELINK_DB_USER for Cloud SQL."
    );
  }

  const auth = await connectorAuth();
  const connector = new Connector(auth ? { auth } : undefined);
  const clientOpts = await connector.getOptions({
    instanceConnectionName: config.cloudSqlInstance,
    ipType: cloudSqlIpType(),
    authType: "IAM"
  });

  return new pg.Pool({
    ...clientOpts,
    user: config.dbUser,
    database: config.dbName
  });
}
