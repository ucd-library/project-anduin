import { log } from 'console';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const isHTTPS = (process.env.APP_URL || '').startsWith('https://');

let rolesDotPath = process.env.OIDC_ROLES_CLAIM_PATHS;
if( rolesDotPath ) {
  rolesDotPath = rolesDotPath.split(',').map(s => s.trim());
} else {
  rolesDotPath = ['resource_access.anduin.roles', 'roles'];
}

const config = {
  
  appName : process.env.APP_NAME || 'Anduin',
  appUrl : process.env.APP_URL || 'http://localhost:4000',
  port : process.env.PORT || 3000,

  staticAssetsPath : path.resolve(__dirname, '..', process.env.STATIC_ASSETS_FOLDER || 'client'),

  pages : {
    unauthorized : process.env.UNAUTHORIZED_PAGE || '/unauthorized.html',
    headlessLogin : process.env.HEADLESS_LOGIN_PAGE || '/headless.html',
    homepage : process.env.HOMEPAGE || '/'
  },

  roles : {
    admin : process.env.ADMIN_ROLE || 'admin',
    dashboard : process.env.ANDUIN_DASHBOARD_ROLE || 'dashboard',
    dashboardAdmin : process.env.ANDUIN_DASHBOARD_ADMIN_ROLE || 'dashboard-admin',
    execute : process.env.ANDUIN_EXECUTE_ROLE || 'execute',
    filesystemPrefix : process.env.ANDUIN_FILESYSTEM_ROLE_PREFIX || 'caskfs'
  },

  auth : {
    enabled : process.env.AUTH_ENABLED !== 'false',
    header : process.env.AUTH_HEADER || 'x-anduin-user',
    session : {
      secret : process.env.SESSION_SECRET || 'session_secret',
      schema : process.env.SESSION_SCHEMA || 'auth_gateway',
      table : process.env.SESSION_TABLE || 'sessions',
      maxAge : parseInt(process.env.SESSION_MAX_AGE) || (7 * 24 * 60 * 60 * 1000), // 1 week
      secureCookies : isHTTPS,
      cookieName : process.env.SESSION_COOKIE_NAME || 'anduin-sid'
    }
  },

  postgres : {
    host : process.env.POSTGRES_HOST || 'postgres',
    port : process.env.POSTGRES_PORT || 5432,
    database : process.env.POSTGRES_DB || 'postgres',
    user : process.env.POSTGRES_USER || 'postgres',
    password : process.env.POSTGRES_PASSWORD || ''
  },

  oidc: {
    baseUrl : process.env.OIDC_BASE_URL,
    clientId : process.env.OIDC_CLIENT_ID,
    secret : process.env.OIDC_CLIENT_SECRET,
    scopes : process.env.OIDC_SCOPES || 'openid profile email',
    jwtSecret : process.env.OIDC_JWT_SECRET || 'abcd1234',
    loginPath : process.env.OIDC_LOGIN_PATH || '/auth/login',
    logoutPath : process.env.OIDC_LOGOUT_PATH || '/auth/logout',
    successPath : process.env.OIDC_SUCCESS_PATH || '/auth/success',
    rolesDotPath,
    firstNameDotPath : process.env.OIDC_FIRST_NAME_CLAIM_PATH || 'given_name',
    lastNameDotPath : process.env.OIDC_LAST_NAME_CLAIM_PATH || 'family_name',
    emailDotPath : process.env.OIDC_EMAIL_CLAIM_PATH || 'email',
    usernameDotPath : process.env.OIDC_USERNAME_CLAIM_PATH || 'preferred_username'
  },

  dagster : {
    enabled : process.env.DAGSTER_ENABLED !== 'false',
    url : process.env.DAGSTER_URL || 'http://dagster:3000',
    pathPrefix : process.env.DAGSTER_PATH_PREFIX || '/dagster',
    allowedRoles : ['execute', 'admin'],
    authRequired : true,
    roles : user => {
      let userRoles = (user.roles || []).map(r => r.toLowerCase());
      let matchedRoles = [];
      for( let role of config.superset.allowedRoles ) {
        if( userRoles.includes(role.toLowerCase()) ) {
          matchedRoles.push(role);
        }
      }
      return matchedRoles;
    }
  },

  superset : {
    enabled : process.env.SUPERSET_ENABLED !== 'false',
    url : process.env.SUPERSET_URL || 'http://superset:8088',
    pathPrefix : process.env.SUPERSET_PATH_PREFIX || '/superset',
    logoutPath : process.env.SUPERSET_LOGOUT_PATH || '/logout',
    allowedRoles : ['dashboard', 'dashboard-admin', 'admin'],
    roles : user => {
      let userRoles = (user.roles || []).map(r => r.toLowerCase());
      let matchedRoles = [];
      for( let role of config.superset.allowedRoles ) {
        if( userRoles.includes(role.toLowerCase()) ) {
          matchedRoles.push(role);
        }
      }
      return matchedRoles;
    }
  },

  cask : {
    enabled : process.env.CASK_ENABLED !== 'false',
    url : process.env.CASK_URL || 'http://cask:3001',
    pathPrefix : process.env.CASK_PATH_PREFIX || '/cask',
    roles : user => {
      let userRoles = (user.roles || []).map(r => r.toLowerCase());
      let matchedRoles = [];
      for( let role of userRoles ) {
        if( role.startsWith('caskfs-') ) {
          matchedRoles.push(role.replace('caskfs-', ''));
        } else if( role === 'admin' ) {
          matchedRoles.push('admin');
        }
      }
      return matchedRoles;
    }
  }
}

export default config;