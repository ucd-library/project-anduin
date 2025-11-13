import express from 'express';
import { oidcSetup, accessProxy } from './controllers/auth.js';
import config from './lib/config.js';
import proxy from './controllers/proxy.js';
import cleanXHeadersMiddleware from './lib/clean-x-headers.js';
import cookieParser from 'cookie-parser';
import logger from './lib/logger.js';

const app = express();

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
app.use(proxy);

app.use('/config.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`window.APP_CONFIG = ${JSON.stringify({
    appName: config.appName,
    user : req.user,
    dagster : {
      enabled : config.dagster.enabled,
      pathPrefix : config.dagster.pathPrefix
    },
    superset : {
      enabled : config.superset.enabled,
      pathPrefix : config.superset.pathPrefix
    },
    cask : {
      enabled : config.cask.enabled,
      pathPrefix : config.cask.pathPrefix
    }
  })};`);
});

// setup static routes
app.use(express.static(config.staticAssetsPath));

app.listen(config.port, () => {
  logger.info(`Auth Gateway running on port ${config.port}`);
});