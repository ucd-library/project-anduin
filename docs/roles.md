# Auth Gateway - User Roles

The following roles are defined within the Anduin system to manage access and permissions across various services when using the Auth Gateway.



- **admin**: This role has full access to all features and settings within the system. Users with this role can manage other users, configure system settings, and have unrestricted access to all data and functionalities.

## Superset (Dashboard) Roles

https://superset.apache.org/docs/security/

- **dashboard**: This role has access to the dashboard features and can view and interact with dashboard data.  Maps to Superset's `Alpha` role.

- **dashboard-admin**: This role has administrative privileges over Superset features but does not have full system-wide admin rights. Maps to Superset's `Admin` role.  Additionally, any user with the `admin` role in Anduin will also have `Admin` privileges in Superset.

## CaskFs Roles

All CaskFs roles are synchronized with Keycloak roles. If you are directly communicating with CaskFs (no auth gateway) there is a one-to-one mapping between Keycloak roles and CaskFs roles.  If you are using the Auth Gateway, the following mappings apply:
- **admin**: Mapped to CaskFs role `admin`
- **caskfs-\***: All other Keycloak roles prefixed with `caskfs-` are mapped directly to CaskFs roles by removing the `caskfs-` prefix. For example, Keycloak role `caskfs-user` maps to CaskFs role `user`.

## Dagster (Execute) Roles

- **execute**: This role has access to ALL Dagster features and can view and interact with Dagster pipelines and data as there is no external authentication or authorization configured for Dagster.

WARNING: If you you run Dagster without the auth gateway, then Dagster is open to anyone who can access the Dagster endpoint. It is strongly recommended to always run Dagster behind the Auth Gateway.
