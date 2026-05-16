import pg from "pg";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";

import { config } from "../config.js";

export async function createPool() {
  if (config.databaseUrl) {
    return new pg.Pool({ connectionString: config.databaseUrl });
  }

  if (!config.cloudSqlInstance || !config.dbUser) {
    throw new Error(
      "Set CARELINK_DATABASE_URL for local Postgres or CARELINK_CLOUD_SQL_INSTANCE and CARELINK_DB_USER for Cloud SQL."
    );
  }

  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: config.cloudSqlInstance,
    ipType: IpAddressTypes.PUBLIC,
    authType: "IAM"
  });

  return new pg.Pool({
    ...clientOpts,
    user: config.dbUser,
    database: config.dbName
  });
}
