Using Apache Superset superset image

# Wiring up Postgres

The following environment variables are used to connect Superset to the Postgres database:

- `PGHOST`: The hostname of the Postgres server (default: `postgres`)
- `PGPORT`: The port number on which Postgres is running (default: `5432`)
- `PGUSER`: The username for Postgres authentication (default: `postgres`)
- `PGPASSWORD`: The password for the Postgres user (default: `postgres`)
- `PGDATABASE`: The name of the Postgres database to connect to (default: `postgres`)

# Wiring up Keycloak Authentication

The following environment variables are used to configure Keycloak authentication in Superset:

- `USE_KEYCLOAK`: Set to `true` to enable Keycloak authentication (default: `false`)
- `KEYCLOAK_HOST`: The URL of the Keycloak server (default: `https://auth.library.ucdavis.edu`)
- `KEYCLOAK_REALM_NAME`: The name of the Keycloak realm (default: `superset`)
- `KEYCLOAK_CLIENT_ID`: The client ID for the Keycloak client
- `KEYCLOAK_CLIENT_SECRET`: The client secret for the Keycloak client
- `KEYCLOAK_ADMIN_ROLE`: The Keycloak role used to assign Superset admin privileges (`Admin`) (default: `admin`)
- `KEYCLOAK_PUBLIC_ROLE`: The Keycloak role used to assign Superset public privileges (`Public`) (default: `public`)
- `KEYCLOAK_ROLE_DOT_PATH`: The path in the Keycloak userinfo response that contains roles array (default: `roles`). More complex examples; `realm_access.roles`, `resource_access.my-client.roles`, or `groups` for group-based roles.
