import { auth } from 'express-openid-connect';
import config from '../lib/config.js';
import logger from '../lib/logger.js';
import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { promisify } from 'util';
import jwksRsa from 'jwks-rsa';
import jwt from 'jsonwebtoken';

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

// HACK, currently express-openid-connect store is not properly handling callbacks
store.get = promisify(store.get);
store.set = promisify(store.set);
store.destroy = promisify(store.destroy);

// JWKS client for verifying device client tokens. Only initialized when
// deviceClientId is configured.
let jwksClient = null;
if( config.oidc.deviceClientId && config.oidc.jwksUri ) {
  jwksClient = jwksRsa({
    jwksUri : config.oidc.jwksUri,
    cache : true,
    cacheMaxAge : 60 * 60 * 1000, // 1 hour
    rateLimit : true,
    jwksRequestsPerMinute : 5
  });
  logger.info('Device client auth enabled', {
    deviceClientId : config.oidc.deviceClientId,
    jwksUri : config.oidc.jwksUri
  });
}


const publicPaths = [
  new RegExp('^'+config.pages.unauthorized),
  new RegExp('^/health(\/|$)'),
  new RegExp('^/auth(\/|$)')
];

// Register service-specific public paths
const BUILTIN_SERVICES = ['dagster', 'superset', 'cask'];
for( let name of BUILTIN_SERVICES ) {
  let service = config[name];
  if( !service?.enabled || !service.publicPaths?.length ) continue;
  for( let p of service.publicPaths ) {
    publicPaths.push(new RegExp('^' + service.pathPrefix + p));
  }
}
for( let service of config.additionalServiceLinks ) {
  if( !service.publicPaths?.length ) continue;
  for( let p of service.publicPaths ) {
    publicPaths.push(new RegExp('^' + service.pathPrefix + p));
  }
}
logger.debug('Registered public paths: ', {publicPaths});

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

    if( req.query.headless === 'true' ) {
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
    for (let cookieName in req.cookies) {
      res.clearCookie(cookieName);
    }
    for (let cookieName in req.signedCookies) {
      res.clearCookie(cookieName, { signed: true });
    }
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

/**
 * Verify a device/CLI JWT against the JWKS endpoint.
 * Caller is responsible for confirming the azp claim before calling this.
 *
 * @param {string} token - Raw JWT string
 * @param {object} header - Pre-decoded JWT header (must contain kid)
 * @returns {Promise<object|null>} Verified JWT payload, or null on failure
 */
async function verifyDeviceToken(token, header) {
  let signingKey;
  try {
    let key = await jwksClient.getSigningKey(header.kid);
    signingKey = key.getPublicKey();
  } catch(e) {
    logger.error('Error fetching JWKS signing key for device token', {
      message : e.message,
      kid : header.kid
    });
    return null;
  }

  try {
    return jwt.verify(token, signingKey, {
      algorithms : ['RS256', 'RS384', 'RS512'],
      issuer : config.oidc.baseUrl
    });
  } catch(e) {
    logger.warn('Device token verification failed', { message : e.message });
    return null;
  }
}

/**
 * Populate req.user from the OIDC session or a Bearer token.
 * For Bearer tokens, the JWT is decoded (without verification) to check the azp
 * claim. If it matches the configured device client, the token is verified via
 * JWKS. Otherwise the token is looked up in the session store.
 *
 * @param {import('express').Request} req
 */
async function setUser(req) {
  if( req.user ) return;

  let user = null;
  if( req.oidc?.user ) {
    user = req.oidc.user;
  } else if( req.get('Authorization') ) {
    let token = req.get('Authorization').replace(/^Bearer /i, '');

    // Decode the JWT header and payload without verifying to cheaply check
    // whether this is a device client token before hitting JWKS.
    if( jwksClient ) {
      let parts = token.split('.');
      if( parts.length === 3 ) {
        try {
          let header  = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
          let payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          let clientId = payload.azp || payload.client_id;
          if( clientId === config.oidc.deviceClientId ) {
            user = await verifyDeviceToken(token, header);
          }
        } catch(e) {
          // not a parseable JWT, fall through to session store
        }
      }
    }

    // Fall back to session store lookup for headless browser tokens
    if( !user ) {
      let sessionData = await store.get(token);
      let idToken = (sessionData?.data?.id_token || '').split('.');
      if( idToken.length === 3 ) {
        try {
          user = JSON.parse(Buffer.from(idToken[1], 'base64').toString('utf8'));
        } catch(e) {
          logger.error('Error parsing session id_token payload', { message : e.message });
        }
      }
    }
  }

  if( !user ) return;

  user = {
    username  : _getDotPath(user, config.oidc.usernameDotPath),
    email     : _getDotPath(user, config.oidc.emailDotPath),
    firstName : _getDotPath(user, config.oidc.firstNameDotPath),
    lastName  : _getDotPath(user, config.oidc.lastNameDotPath),
    roles     : parseRoles(user)
  };

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