import { auth } from 'express-openid-connect';
import config from '../lib/config.js';
import keycloak from '../lib/keycloak.js';
import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { promisify } from 'util';

// Docs:
// https://expressjs.com/en/resources/middleware/session.html
// https://expressjs.com/en/resources/middleware/session.html#compatible-session-stores
const pgPool = new pg.Pool(config.postgres);
const PgSession = connectPgSimple(session);
const store = new PgSession({
  pool: pgPool,
  schemaName: config.auth.session.schema,
  tableName: config.auth.session.table,
  createTableIfMissing : true
});
store.get = promisify(store.get);
store.set = promisify(store.set);
store.destroy = promisify(store.destroy);


const publicPaths = [
  new RegExp('^'+config.pages.unauthorized), 
  new RegExp('^/health(\/|$)'),
  new RegExp('^/auth(\/|$)')
];
const allowedRoles = new Set(Object.values(config.roles));

function oidcSetup(app) {
  if( !config.auth.enabled ) {
    return;
  }

  app.use(auth({
    issuerBaseURL: config.oidc.baseUrl,
    baseURL: config.appUrl,
    clientID: config.oidc.clientId,
    clientSecret: config.oidc.secret,
    secret : config.oidc.jwtSecret,
    session : {
      name : config.auth.session.cookieName,
      cookie : {
        secure : config.auth.session.secureCookies
      },
      store
    },
    routes : {
      callback : '/auth/callback',
      login : false,
      logout : config.oidc.logoutPath,
      postLogoutRedirect : '/auth/postLogoutRedirect'
    },
    authorizationParams: {
      response_type: 'code',
      scope : config.oidc.scopes
    },
    idpLogout: true,
    authRequired: false
  }));

  app.get(config.oidc.loginPath, (req, res) => {
    let urlParams = new URLSearchParams();
    if ( req.query.redirect ){
      urlParams.set('redirect', req.query.redirect);
    }
    if ( req.query['set-cookie'] ){
      urlParams.set('set-cookie', req.query['set-cookie']);
    }
    urlParams = urlParams.toString();

    res.oidc.login({
      returnTo: config.oidc.successPath+(urlParams ? `?${urlParams}` : '')
    });
    // res.oidc.logout({
    //   returnTo: config.oidc.loginPath+'-postclear'+(urlParams ? `?${urlParams}` : '')
    // })
  });

  app.get(config.oidc.successPath, async (req, res) => {
    let jwt = req.oidc.accessToken.access_token;

    if( req.query.redirect && !req.query['set-cookie'] ) {
      res.redirect(req.query.redirect+'?jwt='+jwt);
      return;
    } else if( req.query.headless === 'true' ) {
      let html = await fs.readFile(path.join(config.staticAssetsPath, 'headless.html'), 'utf8');
      html = html.replace('{{JWT_TOKEN}}', jwt);

      res.set('Content-Type', 'text/html');
      res.send(html);
    } else {
      // res.cookie(config.oidc.cookieName, jwt, {httpOnly: true});
      res.redirect(req.query.redirect || '/');
    }
  });

  app.get('/auth/postLogoutRedirect', (req, res) => {
    res.clearCookie(config.oidc.cookieName);
    res.redirect('/');
  });
}

function isUserAuthorized(user) {
  if( !user || !user.roles ) return false;

  for( let role of user.roles ) {
    if( allowedRoles.has(role) ) {
      return true;
    }
    if( role.startsWith(config.roles.filesystemPrefix+'-') ) {
      return true;
    }
  }

  return false;
}

function isPublicPath(path) {
  for( let regex of publicPaths ) {
    if( regex.test(path) ) return true;
  }
  return false;
}

async function accessProxy(req, res, next) {
  if( config.auth.enabled === false ) {
    return next();
  }

  if( req.path === config.pages.unauthorized ) {
    let html = await fs.readFile(path.join(config.staticAssetsPath, config.pages.unauthorized), 'utf8');
    res.set('Content-Type', 'text/html');
    res.send(html);
    return;
  }

  if( isPublicPath(req.path) ) {
    return next();
  }

  await setUser(req);

  if( !req.user ) {
    res.redirect(config.oidc.loginPath + '?redirect=' + encodeURIComponent(req.originalUrl));
    return;
  }

  if( isUserAuthorized(req.user) === false ) {
    res.redirect(config.pages.unauthorized);
    return;
  }

  next();
};

async function setUser(req) {
  if( req.user ) return;

  let user = null;
  if( req.oidc?.user ) {
    user = req.oidc.user;
  } else if( req.get('Authorization') ) {
    // try fetch from bearer token
    let token = req.get('Authorization').replace(/^Bearer /i, '');
    token = await store.get(token);
    token = (token?.data?.id_token || '').split('.');
    if( token.length === 3 ) {
      let payload = Buffer.from(token[1], 'base64').toString('utf8');
      try {
        user = JSON.parse(payload);
      } catch (e) {
        console.error('Error parsing JWT payload', e);
      }
    }
  }

  if( !user ) return;
  
  user = {
    username : _getDotPath(user, config.oidc.usernameDotPath),
    email : _getDotPath(user, config.oidc.emailDotPath),
    firstName : _getDotPath(user, config.oidc.firstNameDotPath),
    lastName : _getDotPath(user, config.oidc.lastNameDotPath),
    roles : parseRoles(user)
  }

  req.user = user;
}


function parseRoles(user) {
  let roles = new Set();

  for( let dotPath of config.oidc.rolesDotPath ) {
    let value = _getDotPath(user, dotPath);
    if( Array.isArray(value) ) {
      value.forEach(r => roles.add(r));
    } else if( typeof value === 'string' ) {
      roles.add(value);
    }
  }

  return Array.from(roles);
}

function _getDotPath(obj, dotPath) {
  let parts = dotPath.split('.');
  let current = obj;
  for( let part of parts ) {
    if( current[part] === undefined ) {
      return null;
    }
    current = current[part];
  }
  return current;
}

export { oidcSetup, accessProxy };