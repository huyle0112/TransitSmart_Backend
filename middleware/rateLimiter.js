/**
 * Lightweight in-memory rate limiter (per IP).
 * Use when you need a simple guard without extra deps.
 */
module.exports = function rateLimiter({ windowMs = 60_000, max = 30 } = {}) {
  const hits = new Map();

  function cleanup(now) {
    for (const [ip, timestamps] of hits.entries()) {
      const recent = timestamps.filter((ts) => now - ts < windowMs);
      if (recent.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, recent);
      }
    }
  }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const timestamps = hits.get(ip) || [];

    const recent = timestamps.filter((ts) => now - ts < windowMs);
    if (recent.length >= max) {
      return res
        .status(429)
        .json({ message: 'Too many requests, please try again later.' });
    }

    recent.push(now);
    hits.set(ip, recent);

    // Opportunistic cleanup
    if (hits.size > 1000 || recent.length === 1) {
      cleanup(now);
    }

    next();
  };
};
