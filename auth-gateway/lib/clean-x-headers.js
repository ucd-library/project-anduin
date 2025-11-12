
function cleanXHeadersMiddleware(req, res, next) {
  // Remove any existing X- headers to prevent header injection attacks
  for (const header in req.headers) {
    if (header.toLowerCase().startsWith('x-')) {
      delete req.headers[header];
    }
  }
  next();
}

export default cleanXHeadersMiddleware;