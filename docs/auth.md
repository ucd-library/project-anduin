# Authentication Configuration(s)

This document outlines the configuration options for setting up authentication Anduin:

- [Auth Gateway](#auth-gateway)
  - [Keycloak](#keycloak)
  - [Superset with Remote User Auth](#superset-with-remote-user-auth)
  - CaskFs with Remote User Auth
  - Dagster
- [Superset with Keycloak Auth](#superset-with-keycloak-auth)
  - [Keycloak](#keycloak)
- [CaskFs with Keycloak Auth](#caskfs-with-keycloak-auth)
  - [Keycloak](#keycloak)
- [Dagster](#dagster)

## Keycloak

Keycloak is an open-source identity and access management solution. It provides features such as single sign-on (SSO), user federation, and identity brokering. In the context of Anduin and the UC Davis Library, Keycloak is used as the primary identity provider for authentication.

## Auth Gateway

The Auth Gateway is configured to use [Keycloak](#keycloak) as the identity provider. The following environment variables are used to set up the Auth Gateway:

- `OIDC_BASE_URL`: The base URL of the Keycloak server (e.g., `https://keycloak.example.com/auth`).
- `OIDC_REALM_NAME`: The Keycloak realm name.
- `OIDC_CLIENT_ID`: The client ID for the Auth Gateway application in Keycloak.
- `OIDC_CLIENT_SECRET`: The client secret for the Auth Gateway application in Keycloak.
- `OIDC_ROLES_CLAIM_PATHS`: The dot-separated path to the roles in the Keycloak token. e.g., `realm_access.roles`.  You can provide more than one path and all roles will be joined. Default is `roles` and `resource_access.anduin.roles`.
- `SUPERSET_REMOTE_AUTH`: Set to `true` to enable Superset remote user authentication via the Auth Gateway.
- `OIDC_JWT_SECRET`: The secret key used to sign JWT tokens for internal communication between the Auth Gateway and services like Superset and CaskFs.
- `SESSION_SECRET`: The secret key used to sign session cookies.

### Superset with Remote User Auth

The Superset instance is configured to use remote user authentication via the Auth Gateway.  The remote auth will looked at the `x-anduin-user` header for user object. The user object is a JSON string with the following structure:

```json
{
  "username": "user1",
  "email": "user1@example.com",
  "firstName": "User",
  "lastName": "One",
  "roles": ["dashboard", "dashboard-admin"]
}
```

The following environment variables are used to set up Superset with remote user auth:

- `SUPERSET_REMOTE_USER_AUTH`: Set to `true` to enable remote user authentication.


## Superset with Keycloak Auth

The Superset instance is configured with the option to use [Keycloak](#keycloak) for authentication. The following environment variables are used to set up Superset with Keycloak:

- `SUPERSET_KEYCLOAK_AUTH`: Set to `true` to enable Keycloak authentication.
- `KEYCLOAK_CLIENT_ID`: The client ID for the Superset application in Keycloak.
- `KEYCLOAK_CLIENT_SECRET`: The client secret for the Superset application in Keycloak.
- `KEYCLOAK_REALM_NAME`: The Keycloak realm name.
- `KEYCLOAK_HOST`: The Keycloak authentication URL.
- `KEYCLOAK_ADMIN_ROLE`: The Keycloak role that maps to the Superset Admin role. Default is `admin`.
- `KEYCLOAK_DASHBOARD_ADMIN_ROLE`: The Keycloak role that maps to the Superset Admin role. Default is `dashboard-admin`.
- `KEYCLOAK_ALPHA_ROLE`: The Keycloak role that maps to the Superset Alpha role. Default is `dashboard`.
- `KEYCLOAK_PUBLIC_ROLE`: The Keycloak role that maps to the Superset Public role. Default is `public`.
- `KEYCLOAK_ROLE_DOT_PATH`: The dot-separated path to the roles in the Keycloak token. e.g., `realm_access.roles`. Default is `roles`.

## CaskFs with Keycloak Auth

The CaskFs instance is configured with the option to use [Keycloak](#keycloak) for authentication. See CaskFs documentation for details.

## Dagster

Dagster is configured to run behind the Auth Gateway. There is no direct authentication or authorization configured for Dagster itself. Access control is managed by the Auth Gateway.  To access Dagster features, users must have the `execute` or `admin` role assigned to them in Keycloak.