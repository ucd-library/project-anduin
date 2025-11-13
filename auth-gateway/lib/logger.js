import {createLogger} from '@ucd-lib/logger';
import config from './config.js';

const logger = createLogger({
  name : 'auth-gateway',
  noInitMsg : true,
  labelsProperties : ['name'],
  level: config.logLevel
});

export default logger;