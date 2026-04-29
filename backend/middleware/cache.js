const NodeCache = require('node-cache');

const ttl = parseInt(process.env.CACHE_TTL_SECONDS || '1800', 10);
const cache = new NodeCache({ stdTTL: ttl, checkperiod: 120 });

function cacheMiddleware(req, res, next) {
  const key = req.originalUrl;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return res.json({ ...cached, _cached: true });
  }
  res.sendCachedJSON = (data) => {
    cache.set(key, data);
    res.json(data);
  };
  next();
}

module.exports = { cacheMiddleware, cache };
