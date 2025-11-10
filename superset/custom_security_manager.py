import logging
import os
import json
from flask import request
from superset.security import SupersetSecurityManager
from flask_appbuilder.security.views import AuthRemoteUserView

from flask_login import login_user
from flask_appbuilder import expose

from flask import g, request
from flask import redirect

from werkzeug.exceptions import Forbidden
from flask_appbuilder.security.sqla.models import Role

# https://github.com/ajgil/Superset-remote-user-auth-nginx/blob/master/config.py
# https://stackoverflow.com/questions/47990985/how-does-remote-user-authentication-type-works-in-apache-superset

ADMIN_ROLE = os.getenv('KEYCLOAK_ADMIN_ROLE', 'admin')
PUBLIC_ROLE = os.getenv('KEYCLOAK_PUBLIC_ROLE', 'public')
ROLE_DOT_PATH = os.getenv('KEYCLOAK_ROLE_DOT_PATH', 'roles')
KEYCLOAK_PUBLIC_KEY = os.getenv('KEYCLOAK_PUBLIC_KEY', '')
KEYCLOAK_ISSUER = os.getenv('KEYCLOAK_ISSUER', 'https://your-keycloak-domain/realms/your-realm')
KEYCLOAK_AUDIENCE = os.getenv('KEYCLOAK_AUDIENCE', 'superset')


class AnduinAuthRemoteUserView(AuthRemoteUserView):
  @expose("/login/")
  def login(self):
      logging.info("Starting Proxy Auth login process")
      if g.user is not None and g.user.is_authenticated:
          logging.info(f"{g.user.username} already logged in")
          return redirect(self.appbuilder.get_url_for_index)

      username = self.get_username_from_header()
      self.get_or_create_user(username)
      user = self.appbuilder.sm.auth_user_remote_user(username)
      login_user(user)
      session.pop("_flashes", None)

      return redirect(self.appbuilder.get_url_for_index)

  def get_or_create_user(self, username):
      logging.info(f"Getting or creating user: {username}")
      user = self.appbuilder.sm.find_user(username)

      if user is None:
          user = self.appbuilder.sm.add_user(
              username,
              username,
              "-",  # dummy last name
              f"{username}@ucdavis.edu",
              self.get_or_create_roles_from_headers(),
              "password",  # dummy password
          )

      return user

  def auth_user_remote_user(self, username):
    """Authenticate user from proxy headers with JWT validation"""

    # Get JWT from header
    token = request.headers.get('X-Auth-User', '')
    logging.info(f"Received token: {token}")

    if not token:
      return None
        
    try:
      user = json.loads(token)

      username = user.get('preferred_username') or user.get('username')
      email = user.get('email')
      first_name = user.get('given_name', '')
      last_name = user.get('family_name', '')
      
      # Find or create user
      user = self.find_user(username=username)
      if not user:
        user = self.add_user(
          username=username,
          email=email,
          first_name=first_name,
          last_name=last_name,
          role=self.find_role('Gamma')
        )
      
      return user
        
    except jwt.InvalidTokenError as e:
      logging.error(f"JWT validation failed: {str(e)}")
      return None

class CustomSsoSecurityManager(SupersetSecurityManager):
  authremoteuserview = AnduinAuthRemoteUserView

  

  def oauth_user_info(self, provider, response=None):
      data = response.get('userinfo')

      # Parse JWT and extract roles or groups
      user_info = {
          'id': data.get('email', ''),
          'username': data.get('preferred_username'),
          'email': data.get('email', ''),
          'first_name': data.get('given_name', ''),
          'last_name': data.get('family_name', ''),
      }

      # Traverse the nested dict using ROLE_DOT_PATH (e.g., 'realm_access.roles')
      role_path = ROLE_DOT_PATH.split('.')
      roles = data
      logging.debug(f"Initial oauth data: {roles}")
      for key in role_path:
        roles = roles.get(key, {})
        logging.debug(f"Traversing to key '{key}': {roles}")
      
      keycloak_roles = roles if isinstance(roles, list) else []
      logging.info(f"Extracted Keycloak roles: {keycloak_roles} for user {user_info['username']}")

      # Store the determined role in user_info for later use
      if ADMIN_ROLE in keycloak_roles:
          user_info['superset_role'] = 'Admin'
      elif PUBLIC_ROLE in keycloak_roles:
          user_info['superset_role'] = 'Public'
      else:
          raise Forbidden("You are not authorized to access Superset")

      logging.info(f"User {user_info['username']} assigned superset role: {user_info['superset_role']}")
      logging.debug(f"Final user info: {user_info}")
      return user_info

  def auth_user_oauth(self, userinfo):
      """Override to handle role assignment after user creation"""
      user = super().auth_user_oauth(userinfo)
      
      if user and 'superset_role' in userinfo:
          role_name = userinfo['superset_role']
          role = self.find_role(role_name)
          if role:
              user.roles = [role]
              self.get_session.commit()
              print(f"Assigned role {role_name} to user {user.username}")
          else:
              print(f"Role {role_name} not found in Superset")
      
      return user