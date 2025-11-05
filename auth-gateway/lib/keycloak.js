import fetch from 'node-fetch';
import clone from 'clone';
import config from './config.js';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import logger from './logger.js';

class KeycloakUtils {

  constructor() {
    this.tokenCache = new Map();
    // this.tokenRequestCache = new Map();
    this.tokenCacheTTL = config.oidc.tokenCacheTTL;

    this.setUser = this.setUser.bind(this);
    this.protect = this.protect.bind(this);
    this.getkeyFromJwks = this.getkeyFromJwks.bind(this);


    logger.info('Using jwks keys from', config.oidc.baseUrl+'/protocol/openid-connect/certs');
    this.jwksClient = jwksClient({
      jwksUri: config.oidc.baseUrl+'/protocol/openid-connect/certs',
      cache: true,
      cacheMaxEntries: 50, 
      cacheMaxAge: 60 * 60 * 1000
    });
  }


  initTls() {
    if( this.tlsInitialized ) return;
    this.tlsInitialized = true;

    // hack for self signed cert for now...
    if( process.env.LOCAL_KEYCLOAK === 'true' ) {
      process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
    }
  }

  /**
   * @method getJWKS
   * @description get the JWKS keys from the keycloak server.  This is used by
   * PostgREST to verify the JWT tokens.
   * 
   * @returns {Promise<Object>} JWKS keys
   */
  async getJWKS() {
    this.initTls();

    if( this.jwks ) {
      return this.jwks;
    }

    let resp = await fetch(config.oidc.baseUrl+'/protocol/openid-connect/certs')
    this.jwks = await resp.json();

    setTimeout(() => this.jwks = null, 1000 * 60 * 60);

    return this.jwks;
  }

  async verifyActiveToken(token='', context={}) {
    logger.debug('Verifying active token', context.logSignal);
    token = token.replace(/^Bearer /i, '');
    
    // check if we have a token hash
    let jwtToken = await adminClient.getUserTokenFromHash(token);
    if( jwtToken ) token = jwtToken;

    // 30 second caching
    if( this.tokenCache.has(token) ) {
      let result = this.tokenCache.get(token);
      logger.debug('Token found in cache', context.logSignal);
      return clone(result);
    }

    return new Promise((resolve) => {
      jwt.verify(token, this.getkeyFromJwks, {}, (error, decoded) => {
        if( error ) {
          logger.debug('Failed to verify jwt from keycloak, invalid token', error, context.logSignal);
          resolve({active : false, error, user : null});
        } else {
          logger.debug('Token verified', JSON.stringify(decoded), context.logSignal);
          let resp = {active : true, user : decoded, jwt : token};
          this.tokenCache.set(token, resp);
          resolve(resp);
        }
      });
    });
  }

  getkeyFromJwks(header, callback) {
    this.jwksClient.getSigningKey(header.kid, function(err, key) {
      if( err ) {
        logger.debug('Failed to get signing key from JWKS', err);
        return callback(err);
      }
      logger.debug('Signing key retrieved from JWKS');
      var signingKey = key.publicKey || key.rsaPublicKey;
      callback(null, signingKey);
    });
  }

  async verifyActiveTokenKeycloak(token='') {
    this.initTls();

    token = token.replace(/^Bearer /i, '');
    
    // check if we have a token hash
    let jwtToken = await adminClient.getUserTokenFromHash(token);
    if( jwtToken ) token = jwtToken;

    // 30 second caching
    if( this.tokenCache.has(token) ) {
      let result = this.tokenCache.get(token);
      return clone(result);
    }

    let resp = {};
    let requestResolve;
    let requestReject;

    try {
      let result;

      // if we get multiple requests at once, just make one
      // request to the auth server
      if( this.tokenRequestCache.has(token) ) {
        let promise = this.tokenRequestCache.get(token);
        result = await promise;

        return clone(result);
      }

      // short abort
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      let request = fetch(config.oidc.baseUrl+'/protocol/openid-connect/userinfo', {
        signal: controller.signal,
        headers : {
          authorization : 'Bearer '+token
        }
      });


      let promise = new Promise((resolve, reject) => {
        requestResolve = resolve;
        requestReject = reject;
      });
      this.tokenRequestCache.set(token, promise);

      let resp = await request;
      let body = await resp.text();
      clearTimeout(timeoutId);

      result = {
        active : resp.status === 200,
        status : resp.status,
        user : body ? JSON.parse(body) : null
      }

      this.tokenCache.set(token, result);
      setTimeout(() => {
        this.tokenCache.delete(token);
      }, this.tokenCacheTTL);


      requestResolve(result);
      this.tokenRequestCache.delete(token);

      return clone(result);
    } catch(e) {
      if( requestReject ){
        requestReject(e);
      }
      this.tokenRequestCache.delete(token);

      if (e.name === 'AbortError' || e.name === 'FetchError') {
        logger.warn('Failed to verify jwt from keycloak, attempting pub key decryption', e)
        let user = await jwt.validate(token);
        if( user ) {
          return {
            active : true,
            status : 200,
            fallback : true,
            user : clone(user)
          }
        }
      }

      return {
        active : resp.status === 200,
        status : resp.status,
        user : null,
        error : true,
        message : e.message
      }
    }
  }

  /**
   * @method getJwtFromRequest
   * @description given a express request object, return a given jwt token.
   * Method will first check the request cookies of the jwt token cookie then
   * checks the Authorization header of the token.
   *
   * @param {Object} req express request object
   *
   * @returns {String|null} null if no token found.
   */
  getJwtFromRequest(req) {
    let token;

    if( req.cookies ) {
      token = req.cookies[config.jwt.cookieName];
      if( token ) return token;
    }

    token = req.get('Authorization');
    if( token && token.match(/^Bearer /i) ) {
      return token.replace(/^Bearer /i, '');
    }

    return null;
  }

  async setUser(req, res, next) {
    // TODO: ensure x- headers are stripped first
    // if( req.headers[config.jwt.header] ) {
    //   req.user = JSON.parse(req.headers[config.jwt.header]);
    //   if( !req.user.roles ) req.user.roles = [];

    //   return next();
    // }

    if( req.user ) {
      logger.debug('User already set on request', req?.context?.logSignal);      
      if( req.context ) {
        await req.context.update({requestor: req.user.username});
      }
      return next();
    }

    let token = this.getJwtFromRequest(req);
    if( !token ) return next();

    let resp = await this.verifyActiveToken(token, req.context);

    if( resp.active !== true ) return next();
    let user = resp.user;

    req.user = user;

    // override roles
    let roles = new Set();

    if( !user.username && user.preferred_username ) {
      user.username = user.preferred_username;
    }

    if( user.username ) roles.add(user.username);
    if( user.preferred_username ) roles.add(user.preferred_username);

    if( user.roles && Array.isArray(user.roles) ) {
      user.roles.forEach(role => roles.add(role));
    }

    if( user.realmRoles && Array.isArray(user.realmRoles) ) {
      user.realmRoles.forEach(role => roles.add(role));
      delete user.realmRoles;
    }

    user.roles = Array.from(roles)
      .filter(role => config.oidc.roleIgnoreList.includes(role) === false);

    req.headers[config.auth.header] = JSON.stringify(user);

    if( req.context ) {
      await req.context.update({requestor: user.username});
    }

    next();
  }

  protect(roles=[]) {
    if( !Array.isArray(roles) ) {
      roles = [roles];
    }

    let authorize = function (req, res, next)  {
      this.setUser(req, res, () => {

        let reqRoles = roles;

        if( roles.includes('instance-admin') ) {
          return this._protectInstance(req, res, next, ['ADMIN']);
        }

        if( roles.includes('instance-user') ) {
          return this._protectInstance(req, res, next, ['ADMIN', 'USER']);
        }

        if( roles.includes('organization-admin') ) {
          return this._protectOrganization(req, res, next, ['ADMIN']);
        } 

        if( roles.includes('admin') ) {
          return this._protectAdmin(req, res, next);
        }

        // no user
        if( roles.includes('logged-in') ) {
          if( !req.user ) return res.status(403).send('Unauthorized');
          return next();
        }

        return res.status(403).send('Unknown protection: '+roles.join(', '));
      })
    };

    authorize = authorize.bind(this);
    return authorize;
  }


}

const instance = new KeycloakUtils();
export default instance;
