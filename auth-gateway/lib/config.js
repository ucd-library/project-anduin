import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const isHTTPS = (process.env.ANDUIN_APP_URL || '').startsWith('https://');

let rolesDotPath = process.env.OIDC_ROLES_CLAIM_PATHS;
if( rolesDotPath ) {
  rolesDotPath = rolesDotPath.split(',').map(s => s.trim());
} else {
  rolesDotPath = ['resource_access.anduin.roles', 'roles'];
}

let additionalServiceLinks = [];
if( process.env.ADDITIONAL_SERVICE_LINKS_CONFIG ) {
  try {
    if( fs.existsSync(process.env.ADDITIONAL_SERVICE_LINKS_CONFIG) ) {
      let fileContent = fs.readFileSync(process.env.ADDITIONAL_SERVICE_LINKS_CONFIG, 'utf-8');

      // simple variable substitution from env vars
      fileContent = fileContent.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || '');

      additionalServiceLinks = JSON.parse(fileContent);
    } else {
      console.error('ADDITIONAL_SERVICE_LINKS_CONFIG file does not exist:', process.env.ADDITIONAL_SERVICE_LINKS_CONFIG);
    }
  } catch (e) {
    console.error('Error parsing ADDITIONAL_SERVICE_LINKS_CONFIG:', e);
  }
}

const config = {
  
  appName : process.env.APP_NAME || 'Anduin',
  appUrl : process.env.ANDUIN_APP_URL || 'http://localhost:4000',
  port : cleanK8sPort(process.env.PORT) || 3000,

  staticAssetsPath : path.resolve(__dirname, '..', process.env.STATIC_ASSETS_FOLDER || 'client'),
  additionalServiceLinks,

  proxy : {
    enabledNavButtonInjection : process.env.PROXY_ENABLED_NAV_BUTTON_INJECTION === 'true',
    manualRedirects : {
      '/superset/logout' : '/auth/logout',
      '/static/assets/images/superset-logo-horiz.png' : '/superset/static/assets/images/superset-logo-horiz.png',
      '/user_info' : '/superset/user_info',
      '/superset/superset/api/v1/chart/data' : '/superset/api/v1/chart/data'
    },
    allowedXHeaders : ['x-csrftoken']
  },

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
    port : cleanK8sPort(process.env.POSTGRES_PORT) || 5432,
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
    ui : {
      title : 'Execute',
      subtitle : 'Dagster',
      color: "rec-pool",
      icon: "fas fa-code"
    },
    allowedRoles : ['execute', 'admin'],
    authRequired : true,
    roles : user => {
      let userRoles = (user.roles || []).map(r => r.toLowerCase());
      let matchedRoles = [];
      for( let role of config.dagster.allowedRoles ) {
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
    ui : {
      title : 'Dashboards',
      subtitle : 'Superset',
      color : 'poppy',
      icon : 'fas fa-chart-bar',
      link : process.env.DEFAULT_DASHBOARD_LINK || ''
    },
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
    ui : {
      title : 'Files',
      subtitle : 'CaskFs',
      color : 'sage',
      icon : 'fas fa-file'
    },
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

function cleanK8sPort(value) {
  if( !value ) return null;
  if( value.startsWith('tcp:') ) {
    return parseInt(value.split(':').pop());
  }
  return parseInt(value);
}

export default config;