Using Apache Superset superset image

# Wiring up Postgres

The following environment variables are used to connect Superset to the Postgres database:

- `PGHOST`: The hostname of the Postgres server (default: `postgres`)
- `PGPORT`: The port number on which Postgres is running (default: `5432`)
- `PGUSER`: The username for Postgres authentication (default: `postgres`)
- `PGPASSWORD`: The password for the Postgres user (default: `postgres`)
- `PGDATABASE`: The name of the Postgres database to connect to (default: `postgres`)

# Dashboard Initialization and Import

The following environment variables are used to control the dashboard initialization and import process:

- `DASHBOARD_FILE`: The path to a exported Superset dashboard file (e.g., `dashboard.zip`). This file can be a local path or a Google Cloud Storage URL (e.g., `gs://bucket-name/path/to/file.zip`).  
- `GOOGLE_APPLICATION_CREDENTIALS`: The path to the Google Cloud service account credentials file (default: `/app/docker/credentials.json`). This is required if the `DASHBOARD_FILE` is a Google Cloud Storage URL (e.g., `gs://bucket-name/path/to/file.zip`).
- If a `PostgreSQL.yaml` file is found in the `/databases/` directory, the `sqlalchemy_uri` property in that file will be updated to use the Postgres connection details provided by the environment variables. eg `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`. This is used to connect Superset to the Postgres database and the password is not stored in the file so must be manually set on import.

If you want to manually import a dashboard
  - Copy the dashboard file either;
    - to the running container
    - to Google Cloud Storage
  - Run the following command to import the dashboard:
    ```bash
    docker exec -it [container-name] /app/docker/superset-load-dashboard.sh /path/to/dashboard.zip
    ```
    or
    ```bash
    docker exec -it [container-name] /app/docker/superset-load-dashboard.sh gs://bucket-name/path/to/file.zip
    ```

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
