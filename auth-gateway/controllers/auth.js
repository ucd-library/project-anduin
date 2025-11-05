import { auth } from 'express-openid-connect';
import config from '../lib/config.js';
import keycloak from '../lib/keycloak.js';
import fs from 'fs/promises';

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
      res.cookie(config.oidc.cookieName, jwt, {httpOnly: true});
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
  }

  return false;
}

function isPublicPath(path) {
  for( let regex of publicPaths ) {
    if( regex.test(path) ) return true;
  }
  return false;
}

function accessProxy(req, res, next) {
  if( config.auth.enabled === false ) {
    return next();
  }

  keycloak.setUser(req, res, async () => {
    if( req.originalUrl === config.pages.unauthorized ) {
      let html = await fs.readFile(path.join(config.staticAssetsPath, config.pages.unauthorized), 'utf8');
      res.set('Content-Type', 'text/html');
      res.send(html);
      return;
    }

    if( isPublicPath(req.originalUrl) ) {
      return next();
    }

    if( !req.user ) {
      res.redirect(config.auth.login);
      return;
    }

    if( isUserAuthorized(req.user) === false ) {
      res.redirect(config.pages.unauthorized);
      return;
    }

    next();
  });
};

export { oidcSetup, accessProxy };