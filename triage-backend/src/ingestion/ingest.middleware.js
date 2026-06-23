/**
 * Express middleware to capture and truncate raw request body streams.
 * Limits the payload to 100KB to fail fast and protect the parsing cost.
 * Truncates instead of rejecting outright, as the message content might still
 * be near the start.
 * 
 * @param {import('express').Request} req Express request.
 * @param {import('express').Response} res Express response.
 * @param {import('express').NextFunction} next Next middleware function.
 */
export function rawBodyTruncator(req, res, next) {
  const limit = 100 * 1024; // 100KB size limit ceiling
  let data = '';

  req.setEncoding('utf8');

  req.on('data', chunk => {
    if (data.length < limit) {
      data += chunk;
      if (data.length > limit) {
        data = data.slice(0, limit);
      }
    }
  });

  req.on('end', () => {
    req.rawBody = data;
    next();
  });

  req.on('error', (err) => {
    next(err);
  });
}
