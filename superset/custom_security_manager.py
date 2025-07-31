import logging
import os
from superset.security import SupersetSecurityManager
from werkzeug.exceptions import Forbidden
from flask_appbuilder.security.sqla.models import Role



ADMIN_ROLE = os.getenv('KEYCLOAK_ADMIN_ROLE', 'admin')
PUBLIC_ROLE = os.getenv('KEYCLOAK_PUBLIC_ROLE', 'public')
ROLE_DOT_PATH = os.getenv('KEYCLOAK_ROLE_DOT_PATH', 'resource_access.aggie-experts.roles')

class CustomSsoSecurityManager(SupersetSecurityManager):
  def oauth_user_info(self, provider, response=None):
      data = response.get('userinfo')
      print(data)

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
      print(f"Initial roles data: {roles}")
      for key in role_path:
        roles = roles.get(key, {})
        print(f"Traversing to key '{key}': {roles}")
      
      keycloak_roles = roles if isinstance(roles, list) else []
      print(f"Extracted Keycloak roles: {keycloak_roles}")
      
      # Store the determined role in user_info for later use
      if ADMIN_ROLE in keycloak_roles:
          user_info['superset_role'] = 'Admin'
      elif PUBLIC_ROLE in keycloak_roles:
          user_info['superset_role'] = 'Public'
      else:
          raise Forbidden("You are not authorized to access Superset")

      print(f"Final user info: {user_info}")
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