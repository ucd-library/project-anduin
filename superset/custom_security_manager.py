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
DASHBOARD_ADMIN_ROLE = os.getenv('KEYCLOAK_DASHBOARD_ADMIN_ROLE', 'dashboard-admin')
USER_ROLE = os.getenv('KEYCLOAK_ALPHA_ROLE', 'dashboard')
PUBLIC_ROLE = os.getenv('KEYCLOAK_PUBLIC_ROLE', 'public')
ROLE_DOT_PATH = os.getenv('KEYCLOAK_ROLE_DOT_PATH', 'roles')

class CustomSsoSecurityManager(SupersetSecurityManager):  

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

      user_info['superset_role'] = get_superset_role(data)

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

def get_superset_role(user):
  # Traverse the nested dict using ROLE_DOT_PATH (e.g., 'realm_access.roles')
  role_path = ROLE_DOT_PATH.split('.')
  roles = user
  logging.debug(f"Initial oauth data: {roles}")
  for key in role_path:
    roles = roles.get(key, {})
    logging.debug(f"Traversing to key '{key}': {roles}")
  
  keycloak_roles = roles if isinstance(roles, list) else []
  logging.debug(f"Extracted Keycloak roles: {keycloak_roles} for user {user['username']}")

  # Store the determined role in user_info for later use
  if ADMIN_ROLE in keycloak_roles:
      return 'Admin'
  elif DASHBOARD_ADMIN_ROLE in keycloak_roles:
      return 'Admin'
  elif USER_ROLE in keycloak_roles:
      return 'Alpha'
  elif PUBLIC_ROLE in keycloak_roles:
      return 'Public'
  else:
      raise Forbidden("You are not authorized to access Superset")