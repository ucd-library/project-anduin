import httpProxy from 'http-proxy';
import config from '../lib/config.js';
import logger from '../lib/logger.js';

let ALL_SERVICES = ['dagster', 'cask', 'superset'];
let services = {};
for( let serviceName of ALL_SERVICES ) {
  if( config[serviceName].enabled ) {
    services[serviceName] = {
      url : config[serviceName].url,
      routeRegex : new RegExp('^'+config[serviceName].pathPrefix+'(\/|$)')
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

  for( let service of Object.values(services) ) {
    if( service.routeRegex.test(path) ) {
      return proxyRequest(req, res, service.url, path);
    }
  }

  next();
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