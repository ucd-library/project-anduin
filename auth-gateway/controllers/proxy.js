import httpProxy from 'http-proxy';
import config from '../lib/config.js';
import logger from '../lib/logger.js';

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
  ignorePath : true
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

async function middleware(req, res, next) {
  let path = req.originalUrl;

  let service = getService(req);
  if( service ) {
    
    if( !path.startsWith(service.service.pathPrefix) ) {
      path = service.service.pathPrefix + path;
    }
    console.log('Proxying request to service:', req.originalUrl, 'to', service.service.url + path);
    // req.service = service;
    proxyRequest(req, res, service.service.url, path);
    return;
  }

  console.log('No matching service for request:', req.originalUrl);

  next();
}

function getService(req) {
  let path = req.originalUrl;
  let referer = req.get('Referer') || '';
  try {
    referer = new URL(referer).pathname;
  } catch (e) {}

  for( let service of Object.values(services) ) {
    if( service.routeRegex.test(path) || service.routeRegex.test(referer) ) {
      return {service, referer};
    }
  }

  return null;
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

  proxy.web(req, res, {
    target : host+path
  });
}

export default middleware;