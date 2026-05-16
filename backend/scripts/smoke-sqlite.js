process.env.CARELINK_SKIP_ENV_FILE = "true";
process.env.CARELINK_SQLITE_PATH ||= "./data/carelink-test.sqlite";
process.env.CARELINK_DATABASE_URL = "";
process.env.CARELINK_CLOUD_SQL_INSTANCE = "";
process.env.CARELINK_DB_USER = "";

await import("./smoke-db.js");
