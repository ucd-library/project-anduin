import os, logging, json
from flask import request, g
from flask_login import login_user, logout_user
from flask_appbuilder.security.manager import AUTH_OAUTH, AUTH_REMOTE_USER
from custom_security_manager import CustomSsoSecurityManager, get_superset_role
from superset import security_manager as sm

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
APPLICATION_ROOT= os.getenv('SUPERSET_APP_ROOT', '/superset')

# Handle empty password case
if POSTGRES_PASSWORD:
    SQLALCHEMY_DATABASE_URI = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
else:
    SQLALCHEMY_DATABASE_URI = f"postgresql://{POSTGRES_USER}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

DATABASE_PORT = int(POSTGRES_PORT)
DATABASE_DIALECT = "postgresql"
SUPERSET_SECRET_KEY = os.getenv('SUPERSET_SECRET_KEY', 'not_a_secret_key')

RECAPTCHA_PUBLIC_KEY = None
RECAPTCHA_PRIVATE_KEY = None


if os.getenv('SUPERSET_KEYCLOAK_AUTH', 'false').lower() == 'true':
  logging.info("Configuring Superset to use Keycloak OAuth2 Authentication")
  AUTH_TYPE = AUTH_OAUTH

  # this would default all users to admin role
  AUTH_USER_REGISTRATION = True
  AUTH_ROLES_SYNC_AT_LOGIN = True
  AUTH_USER_REGISTRATION_ROLE = 'Gamma'  # Default role for new users

  REALM_NAME = os.getenv('KEYCLOAK_REALM_NAME', 'superset')
  KEYCLOAK_HOST = os.getenv('KEYCLOAK_HOST', 'https://auth.library.ucdavis.edu')

  OAUTH_PROVIDERS = [
      {
          'name': 'UC Davis CAS',
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

elif os.getenv('SUPERSET_REMOTE_AUTH', 'false').lower() == 'true':
    logging.info("Configuring Superset to use Proxy Authentication")

    class RemoteUserMiddleware(object):
        def __init__(self, app):
            self.app = app
        def __call__(self, environ, start_response):
            user = environ.pop('HTTP_X_ANDUIN_USER', None)
            environ['REMOTE_USER'] = user
            return self.app(environ, start_response)

    ADDITIONAL_MIDDLEWARE = [RemoteUserMiddleware, ]

    class RemoteUserLogin(object):

        def __init__(self, app):
            self.app = app

        def log_user(self, environ):
            if hasattr(g, "user") and \
                hasattr(g.user, "username"):
                if g.user.username == user.get('username'):
                    return g.user
                else:
                    logout_user()

            user = self.get_user(environ)
            if not user:
                return None

            cuser = sm.find_user(username=user.get('username'))

            user['superset_role'] = get_superset_role(user)

            if not cuser:
                logger.info(f"Creating user {user.get('username')} with role {user.get('superset_role')}")
                cuser = sm.add_user(
                    username=user.get('username'),
                    email=user.get('email'),
                    first_name=user.get('firstName'),
                    last_name=user.get('lastName'),
                    role=sm.find_role(user.get('superset_role'))
                )
                sm.get_session.commit()
            else:
                target_role = sm.find_role(user['superset_role'])
                if target_role is not None and target_role.name != user.get('superset_role'):
                    logger.info(f"User {cuser.username} exists. Role changed to {user['superset_role']}. Updating role.")
                    cuser.roles = [target_role]
                    sm.update_user(cuser)

            login_user(cuser)

            return cuser

        def get_user(self, environ):
            user = environ.pop('REMOTE_USER', None)
            if not user:
                return None
            return json.loads(user)

        def before_request(self):
            user = self.log_user(request.environ)
            # if not user:
            #     raise Exception("Invalid login or user not found")

    from superset.app import SupersetAppInitializer
    def app_init(app):
        app.before_request(RemoteUserLogin(app).before_request)
        return SupersetAppInitializer(app)

    APP_INITIALIZER = app_init

    AUTH_TYPE = AUTH_REMOTE_USER
    AUTH_USER_REGISTRATION = True
    AUTH_ROLES_SYNC_AT_LOGIN = True
    AUTH_USER_REGISTRATION_ROLE = 'Gamma'