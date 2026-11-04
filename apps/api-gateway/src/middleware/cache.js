export function cacheResponse(redis) {
  const ttl = Number(process.env.CACHE_TTL_SECONDS || 30);
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    const cached = await redis.get(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(JSON.parse(cached));
    }
    res.setHeader('X-Cache', 'MISS');
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) redis.setEx(key, ttl, JSON.stringify(body)).catch(() => {});
      return json(body);
    };
    next();
  };
}

export async function clearProductCache(redis) {
  let cursor = '0';
  do {
    const result = await redis.scan(cursor, { MATCH: 'cache:/api/products*', COUNT: 100 });
    cursor = result.cursor;
    if (result.keys.length) await redis.del(result.keys);
  } while (cursor !== '0');
}

