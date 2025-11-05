import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const config = {
  
  appUrl : process.env.APP_URL || 'http://localhost:3000',
  port : process.env.PORT || 3000,

  staticAssetsPath : path.resolve(__dirname, '..', process.env.STATIC_ASSETS_FOLDER || 'client'),

  pages : {
    unauthorized : process.env.UNAUTHORIZED_PAGE || '/unauthorized.html',
    headlessLogin : process.env.HEADLESS_LOGIN_PAGE || '/headless.html',
    homepage : process.env.HOMEPAGE || '/'
  },

  roles : {
    allServices : process.env.ADMIN_ROLE || 'all-services-admin',
    dagster : process.env.DAGSTER_ADMIN_ROLE || 'dagster',
    superset : process.env.SUPERSET_ADMIN_ROLE || 'superset',
    cask : process.env.CASK_ADMIN_ROLE || 'cask'
  },

  auth : {
    enabled : process.env.AUTH_ENABLED !== 'false',
    header : process.env.AUTH_HEADER || 'x-auth-user'
  },

  oidc: {
    baseUrl : process.env.OIDC_BASE_URL,
    clientId : process.env.OIDC_CLIENT_ID,
    secret : process.env.OIDC_CLIENT_SECRET,
    scopes : process.env.OIDC_SCOPES || 'openid profile email',
    jwtSecret : process.env.OIDC_JWT_SECRET,
    loginPath : process.env.OIDC_LOGIN_PATH || '/auth/login',
    logoutPath : process.env.OIDC_LOGOUT_PATH || '/auth/logout',
    successPath : process.env.OIDC_SUCCESS_PATH || '/auth/success',
  },

  dagster : {
    enabled : process.env.DAGSTER_ENABLED === 'true',
    url : process.env.DAGSTER_URL || 'http://dagster:3000',
    pathPrefix : process.env.DAGSTER_PATH_PREFIX || '/dagster'
  },

  superset : {
    enabled : process.env.SUPERSET_ENABLED === 'true',
    url : process.env.SUPERSET_URL || 'http://superset:3000',
    pathPrefix : process.env.SUPERSET_PATH_PREFIX || '/superset'
  },

  cask : {
    enabled : process.env.CASK_ENABLED === 'true',
    url : process.env.CASK_URL || 'http://cask:3000',
    pathPrefix : process.env.CASK_PATH_PREFIX || '/cask'
  }
}

export default config;