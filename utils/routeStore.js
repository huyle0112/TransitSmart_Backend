const ROUTE_TTL_MS = 1000 * 60 * 30;
const routeCache = new Map();
const geometryCache = new Map(); // Cache for geometry results

function saveRoute(route) {
  routeCache.set(route.id, {
    ...route,
    cachedAt: Date.now(),
  });
}

function getRoute(id) {
  const data = routeCache.get(id);
  if (!data) return null;
  if (Date.now() - data.cachedAt > ROUTE_TTL_MS) {
    routeCache.delete(id);
    return null;
  }
  return data;
}

function getCachedGeometry(fromStopId, toStopId) {
  const key = `${fromStopId}-${toStopId}`;
  const cached = geometryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > ROUTE_TTL_MS) {
    geometryCache.delete(key);
    return null;
  }
  return cached.geometry;
}

function cacheGeometry(fromStopId, toStopId, geometry) {
  const key = `${fromStopId}-${toStopId}`;
  geometryCache.set(key, {
    geometry,
    cachedAt: Date.now()
  });
}

module.exports = {
  saveRoute,
  getRoute,
  getCachedGeometry,
  cacheGeometry,
};

