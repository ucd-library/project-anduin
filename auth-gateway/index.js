import express from 'express';
import { oidcSetup, accessProxy } from './controllers/auth.js';
import config from './lib/config.js';
import proxy from './controllers/proxy.js';

const app = express();

// ensure oidc routes 
oidcSetup(app);

// apply access control
app.use(accessProxy);

// setup proxy
app.use(proxy);

app.use('/config.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.send(`window.APP_CONFIG = ${JSON.stringify({
    appName: config.appName,
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
  console.log(`Auth Gateway running on port ${config.port}`);
});