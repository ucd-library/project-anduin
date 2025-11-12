# Authentication Configuration(s)

This document outlines the configuration options for setting up authentication Anduin:

- [Auth Gateway](#auth-gateway)
  - [Keycloak](#keycloak)
  - Superset with Remote User Auth
  - CaskFs with Remote User Auth
  - Dagster
- Superset with Keycloak Auth
  - [Keycloak](#keycloak) 
- CaskFs with Keycloak Auth
  - [Keycloak](#keycloak)
- Dagster

## Keycloak

Keycloak is an open-source identity and access management solution. It provides features such as single sign-on (SSO), user federation, and identity brokering. In the context of Anduin and the UC Davis Library, Keycloak is used as the primary identity provider for authentication.

## Auth Gateway

The Auth Gateway is configured to use [Keycloak](#keycloak) as the identity provider. The following environment variables are used to set up the Auth Gateway:

## Superset with Keycloak Auth

The Superset instance is configured with the option to use [Keycloak](#keycloak) for authentication. The following environment variables are used to set up Superset with Keycloak:

- `USE_KEYCLOAK_AUTH`: Set to `true` to enable Keycloak authentication.
- `KEYCLOAK_CLIENT_ID`: The client ID for the Superset application in Keycloak.
- `KEYCLOAK_CLIENT_SECRET`: The client secret for the Superset application in Keycloak.
- `KEYCLOAK_REALM_NAME`: The Keycloak realm name.
- `KEYCLOAK_HOST`: The Keycloak authentication URL.
- `KEYCLOAK_ADMIN_ROLE`: The Keycloak role that maps to the Superset Admin role.
- `KEYCLOAK_PUBLIC_ROLE`: The Keycloak role that maps to the Superset Public role.
- `KEYCLOAK_ROLE_DOT_PATH`: The dot-separated path to the roles in the Keycloak token. e.g., `realm_access.roles`.

## CaskFs with Keycloak Auth

The CaskFs instance is configured with the option to use [Keycloak](#keycloak) for authentication. See CaskFs documentation for details.