import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (!key) return null;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function loadBackendEnv() {
  if (process.env.CARELINK_SKIP_ENV_FILE === "true") return;

  const currentFile = fileURLToPath(import.meta.url);
  const backendRoot = path.resolve(path.dirname(currentFile), "..");
  const explicitEnvFile = process.env.CARELINK_ENV_FILE;

  if (explicitEnvFile) {
    loadEnvFile(path.resolve(explicitEnvFile));
    return;
  }

  loadEnvFile(path.join(backendRoot, ".env.local"));
  loadEnvFile(path.join(backendRoot, ".env"));
}

loadBackendEnv();

function optional(value) {
  return value && value.trim() !== "" ? value.trim() : undefined;
}

export const config = {
  appName: "CareLink API",
  environment: process.env.CARELINK_ENVIRONMENT || "local",
  port: Number(process.env.PORT || process.env.CARELINK_PORT || 8000),
  corsOrigins: process.env.CARELINK_CORS_ORIGINS || "*",
  iapRequired: process.env.CARELINK_IAP_REQUIRED === "true",
  localUserEmail: process.env.CARELINK_LOCAL_USER_EMAIL || "local.member2@carelink.test",
  sqlitePath: optional(process.env.CARELINK_SQLITE_PATH),
  databaseUrl: optional(process.env.CARELINK_DATABASE_URL),
  cloudSqlInstance: optional(process.env.CARELINK_CLOUD_SQL_INSTANCE),
  dbName: process.env.CARELINK_DB_NAME || "carelink",
  dbUser: optional(process.env.CARELINK_DB_USER),
  cloudSqlIpType: process.env.CARELINK_CLOUD_SQL_IP_TYPE || "PUBLIC",
  impersonateServiceAccount: optional(process.env.CARELINK_IMPERSONATE_SERVICE_ACCOUNT)
};
