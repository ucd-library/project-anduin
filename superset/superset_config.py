import os, logging
from flask_appbuilder.security.manager import AUTH_OAUTH
from custom_security_manager import CustomSsoSecurityManager

# LOGGING_LEVEL = logging.DEBUG
# logging.getLogger('superset.security').setLevel(logging.DEBUG)
# logging.getLogger('flask_appbuilder.security.manager').setLevel(logging.DEBUG)
# logging.getLogger('flask_oauthlib').setLevel(logging.DEBUG)  # if using older Flask-OAuthlib
# logging.getLogger('authlib').setLevel(logging.DEBUG)          # modern Authlib for OAuth
# logging.getLogger('flask_appbuilder.security.views').setLevel(logging.DEBUG)

POSTGRES_HOST = os.getenv('PGHOST', 'postgres')
POSTGRES_PORT = os.getenv('PGPORT', '5432')
POSTGRES_DB = os.getenv('PGDATABASE', 'postgres')
POSTGRES_USER = os.getenv('PGUSER', 'postgres')
POSTGRES_PASSWORD = os.getenv('PGPASSWORD', 'postgres')

# Handle empty password case
if POSTGRES_PASSWORD:
    SQLALCHEMY_DATABASE_URI = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
else:
    SQLALCHEMY_DATABASE_URI = f"postgresql://{POSTGRES_USER}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

DATABASE_PORT = int(POSTGRES_PORT)
DATABASE_DIALECT = "postgresql"
SUPERSET_SECRET_KEY = os.getenv('SUPERSET_SECRET_KEY', 'not_a_secret_key')

if os.getenv('USE_KEYCLOAK', 'false').lower() == 'true':
  AUTH_TYPE = AUTH_OAUTH

  # this would default all users to admin role
  AUTH_USER_REGISTRATION = True
  AUTH_ROLES_SYNC_AT_LOGIN = True
  AUTH_USER_REGISTRATION_ROLE = 'Gamma'  # Default role for new users

  REALM_NAME = os.getenv('KEYCLOAK_REALM_NAME', 'superset')
  KEYCLOAK_HOST = os.getenv('KEYCLOAK_HOST', 'https://auth.library.ucdavis.edu')

  OAUTH_PROVIDERS = [
      {
          'name': 'keycloak',
          'token_key': 'access_token',
          'icon': 'fa-address-card',
          'remote_app': {
              'client_id': os.getenv('KEYCLOAK_CLIENT_ID', 'superset'),
              'client_secret': os.getenv('KEYCLOAK_CLIENT_SECRET', ''),
              'api_base_url': f'{KEYCLOAK_HOST}/realms/{REALM_NAME}/protocol/',
              'access_token_url': f'{KEYCLOAK_HOST}/realms/{REALM_NAME}/protocol/openid-connect/token',
              'authorize_url': f'{KEYCLOAK_HOST}/realms/{REALM_NAME}/protocol/openid-connect/auth',
              'jwks_uri': f'{KEYCLOAK_HOST}/realms/{REALM_NAME}/protocol/openid-connect/certs',
              'client_kwargs': {
                  'scope': 'openid email profile roles',
              },
          }
      }
  ]

  CUSTOM_SECURITY_MANAGER = CustomSsoSecurityManager

