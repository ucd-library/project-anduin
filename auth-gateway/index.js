import express from 'express';
import http from 'http';
import { oidcSetup, accessProxy } from './controllers/auth.js';
import config from './lib/config.js';
import proxy from './controllers/proxy.js';
import cleanXHeadersMiddleware from './lib/clean-x-headers.js';
import cookieParser from 'cookie-parser';
import logger from './lib/logger.js';


const app = express();
const server = http.createServer(app);

// setup websocket proxying
server.on('upgrade', (req, socket, head) => {
  proxy.wsMiddleware(req, socket, head);
});

app.use(cookieParser());

// apply x- header cleaning middleware
app.use(cleanXHeadersMiddleware);

// ensure oidc routes 
oidcSetup(app);

// apply access control
app.use(accessProxy);

// setup manual redirects
app.use((req, res, next) => {
  let path = req.path.replace(/\/+$/, ''); // remove trailing slashes
  if( config.proxy.manualRedirects[path] ) {
    res.redirect(config.proxy.manualRedirects[path]);
    return;
  }
  next();
});

// setup proxy
app.use(proxy.httpMiddleware);

app.use('/config.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');

  let services = [];

  ['cask', 'superset', 'dagster'].forEach(svcName => {
    if( config[svcName].enabled ) {
      services.push({
        name : svcName,
        link : config[svcName].ui.link || config[svcName].pathPrefix,
        title : config[svcName].ui.title,
        subtitle : config[svcName].ui.subtitle,
        icon : config[svcName].ui.icon,
        color : config[svcName].ui.color
      });
    }
  });

  let additionalLinks = config.additionalServiceLinks
    .filter((link) => {
      if( link.public === true ) return true;
      if( !req.user ) return false;

      if( link.role && req.user.roles) {
        if( req.user.roles.includes(link.role) ) {
          return true;
        } else if ( req.user.roles.includes('admin') ) {
          return true;
        }
      }
      return false;
    })
    .map((link) => ({...link}));

  additionalLinks.forEach(s => {
    s.url = s.internal ? s.pathPrefix : s.url;
  });

  res.send(`window.APP_CONFIG = ${JSON.stringify({
    appName: config.appName,
    user : req.user,
    services : [...services, ...additionalLinks]
  })};`);
});

// setup static routes
app.use(express.static(config.staticAssetsPath));

server.listen(config.port, () => {
  logger.info(`Auth Gateway running on port ${config.port}`);
});