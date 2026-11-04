export function createRateLimiter(redis) {
  const max = Number(process.env.RATE_LIMIT_MAX || 100);
  const windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60);
  return async (req, res, next) => {
    try {
      const window = Math.floor(Date.now() / (windowSeconds * 1000));
      const key = `rate:${req.ip}:${window}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds + 1);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
      if (count > max) return res.status(429).json({ error: 'Too many requests' });
      next();
    } catch (error) {
      next(error);
    }
  };
}

