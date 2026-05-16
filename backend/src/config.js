export const config = {
  appName: "CareLink API",
  environment: process.env.CARELINK_ENVIRONMENT || "local",
  port: Number(process.env.PORT || process.env.CARELINK_PORT || 8000),
  corsOrigins: process.env.CARELINK_CORS_ORIGINS || "*",
  iapRequired: process.env.CARELINK_IAP_REQUIRED === "true",
  localUserEmail: process.env.CARELINK_LOCAL_USER_EMAIL || "local.member2@carelink.test",
  databaseUrl: process.env.CARELINK_DATABASE_URL,
  cloudSqlInstance: process.env.CARELINK_CLOUD_SQL_INSTANCE,
  dbName: process.env.CARELINK_DB_NAME || "carelink",
  dbUser: process.env.CARELINK_DB_USER
};
