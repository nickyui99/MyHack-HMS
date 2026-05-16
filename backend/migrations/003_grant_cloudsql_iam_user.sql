-- Grant CareLink API access to the Cloud SQL IAM database user.
-- Run as the database owner or another privileged PostgreSQL user, such as
-- the built-in Cloud SQL "postgres" user. Do not run this as the IAM principal
-- being granted access, because it will not own the existing tables.
--
-- Replace the role name if CARELINK_DB_USER is different.

GRANT CONNECT ON DATABASE carelink TO "carelink-runtime@hackathon-myhack.iam";
GRANT USAGE ON SCHEMA public TO "carelink-runtime@hackathon-myhack.iam";

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "carelink-runtime@hackathon-myhack.iam";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "carelink-runtime@hackathon-myhack.iam";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "carelink-runtime@hackathon-myhack.iam";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO "carelink-runtime@hackathon-myhack.iam";
