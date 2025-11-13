import httpProxy from 'http-proxy';
import zlib from 'zlib';
import config from '../lib/config.js';
import logger from '../lib/logger.js';
import { decompress } from '@mongodb-js/zstd';


let ALL_SERVICES = ['dagster', 'cask', 'superset'];
let services = {};
for( let serviceName of ALL_SERVICES ) {
  if( config[serviceName].enabled ) {
    services[serviceName] = {
      url : config[serviceName].url,
      pathPrefix : config[serviceName].pathPrefix,
      routeRegex : new RegExp('^'+config[serviceName].pathPrefix+'(\/|$)'),
      noPathPrefix : config[serviceName].noPathPrefix || false
    }
  }
}

let proxy = httpProxy.createProxyServer({
  ignorePath : true,
  selfHandleResponse : true
});
proxy.on('error', (err, req, res) => {
  logger.error('HTTP proxy error: ', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    headers: req.headers,
    remoteIp : req.socket.remoteAddress,
    ipAddress : req.ip,
    forwarded : req.ips
  });
  res.status(500).send('Internal server error');
});

const scriptToInject = '<script src="/js/anduin-menu-nav.js"></script>';
proxy.on('proxyRes', (proxyRes, req, res) => {
  res.status(proxyRes.statusCode);

  let isHTML = false, contentEncoding = null;
  if( config.proxy.enabledNavButtonInjection &&
      proxyRes.headers['content-type'] && 
      proxyRes.headers['content-type'].includes('text/html') ) {
    isHTML = true;

    // check for content encoding so we can handle it properly
    contentEncoding = proxyRes.headers['content-encoding'];
  }

  // this is to handle injecting a nav buttons into html responses
  if( isHTML ) {

    res.setHeader('content-length', parseInt(proxyRes.headers['content-length']) + scriptToInject.length);

    let body = [];
    proxyRes.on('data', (chunk) => {
      body.push(chunk);
    });
    
    proxyRes.on('end', async () => {
      body = Buffer.concat(body);
      if( contentEncoding ) {
        body = await decodeContent(body, contentEncoding);
      }
      body = body.toString('utf8');
      
      // Inject script before closing </body> tag
      if (body.includes('</body>')) {
        body = body.replace('</body>', `${scriptToInject}</body>`);
      } else if (body.includes('</html>')) {
        body = body.replace('</html>', `${scriptToInject}</html>`);
      } else {
        body += scriptToInject;
      }

      for( let header in proxyRes.headers ) {
        if( header.toLowerCase() === 'content-security-policy' ) {
          // TODO: extract the nounce from the existing csp and add it here
          // modify content-security-policy to allow injected script
          // let csp = proxyRes.headers[header];
          // csp = csp.replace("script-src ", "script-src 'unsafe-inline' ");
          // res.setHeader(header, csp);
          continue;
        }
        if( header.toLowerCase() === 'content-encoding' ) {
          // skip content-encoding header for html since we are modifying the body
          continue;
        }
        res.setHeader(header, proxyRes.headers[header]);
      }
      
      // set new content length
      res.setHeader('content-length', Buffer.byteLength(body));
      
      res.end(body);
    });
  } else {
    for( let header in proxyRes.headers ) {
      res.setHeader(header, proxyRes.headers[header]);
    }

    proxyRes.pipe(res);
  }
});

async function middleware(req, res, next) {
  let path = req.originalUrl;

  let service = getService(req);
  if( service ) {
    
    if( !path.startsWith(service.service.pathPrefix) ) {
      path = service.service.pathPrefix + path;
    }

    // check for logout path redirects
    if( service.service.logoutPath ) {
      if( path.startsWith(service.service.pathPrefix + service.service.logoutPath) ) {
        res.redirect(config.oidc.logoutPath);
        return;
      }
    }

    req.service = service;

    proxyRequest(req, res, service.service.url, path);
    return;
  }

  next();
}

function getService(req) {
  let path = req.originalUrl;
  let referer = req.get('Referer') || '';
  try {
    referer = new URL(referer).pathname;
  } catch (e) {}

  for( let service of Object.values(services) ) {
    if( service.routeRegex.test(path) ) {
    // if( service.routeRegex.test(path) || service.routeRegex.test(referer) ) {
      return {service, referer};
    }
  }

  return null;
}

function accessAllowed(req) {
  if( req.service?.authRequired !== true ) {
    return true;
  }

  if( !req.user ) {
    return false;
  }

  for( let role of req.userHeader.roles ) {
    if( req.service.allowedRoles.includes(role) ) {
      return true;
    }
  }

  return false;
}

function proxyRequest(req, res, host, path) {
  logger.debug('HTTP Proxy Request: ', {
    url: req.originalUrl, 
    // method: req.method, 
    // headers: req.headers,
    // remoteIp : req.connection.remoteAddress,
    // ipAddress : req.ip,
    // forwarded : req.ips,
    target : host+path
  });

  // create user object for downstream services
  if( req.user ) {
    req.headers[config.auth.header] = Buffer.from(JSON.stringify(req.user));
  }

  // some services require access control here. ex: dagster
  if( !accessAllowed(req) ) {
    res.status(401).send('Authentication required');
    return;
  }

  // check

  proxy.web(req, res, {
    target : host+path
  });
}

function decodeContent(body, encoding) {
  if( encoding === 'zstd' ) {
    return decompress(body);
  }
  if( encoding === 'gzip' ) {
    return zlib.gunzipSync(body);
  }
  if( encoding === 'deflate' ) {
    return zlib.inflateSync(body);
  }
  // add other encoding types as needed

  return body;
}

export default middleware;