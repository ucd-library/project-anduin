import config from './config.js';

const allowedHeaders = new Set(config.proxy.allowedXHeaders.map(h => h.toLowerCase()));

function cleanXHeadersMiddleware(req, res, next) {
  // Remove any existing X- headers to prevent header injection attacks
  for (const header in req.headers) {
    if (header.toLowerCase().startsWith('x-') && !allowedHeaders.has(header.toLowerCase())) {
      delete req.headers[header];
    }
  }
  next();
}

export default cleanXHeadersMiddleware;