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

// setup static routes
app.use(express.static('public'));

app.listen(config.port, () => {
  console.log(`Auth Gateway running on port ${config.port}`);
});