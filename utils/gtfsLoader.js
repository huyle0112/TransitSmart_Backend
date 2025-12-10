const prisma = require('../config/prisma');

// Cache for loaded data
let cachedStops = null;
let cachedRoutes = null;
let cachedTrips = null;
let cachedStopTimes = null;

/**
 * Load stops from database using Prisma
 * Converts to app format: { id, name, coords: {lat, lng}, type }
 */
async function loadStops() {
  if (cachedStops) return cachedStops;

  try {
    const dbStops = await prisma.stops.findMany();

    cachedStops = dbStops.map(stop => ({
      id: stop.id,
      name: stop.name,
      coords: {
        lat: parseFloat(stop.lat),
        lng: parseFloat(stop.lng)
      },
      type: stop.type || 'bus'
    }));

    console.log(`✅ Loaded ${cachedStops.length} stops from DATABASE`);
    return cachedStops;
  } catch (error) {
    console.error('❌ Error loading stops from database:', error.message);
    return [];
  }
}

/**
 * Load routes from database using Prisma
 * Converts to app format: { id, name, type, color, stops[], serviceHours, frequencyMinutes, fare }
 */
async function loadRoutes() {
  if (cachedRoutes) return cachedRoutes;

  try {
    const dbRoutes = await prisma.routes.findMany({
      include: {
        trips: {
          include: {
            stop_times: {
              orderBy: {
                stop_sequence: 'asc'
              }
            }
          }
        }
      }
    });

    // Build routes with stop sequences
    cachedRoutes = dbRoutes.map(route => {
      // Get unique stops from all trips of this route
      const stopIds = new Set();

      // Use the first trip to get the stop sequence
      if (route.trips.length > 0) {
        const firstTrip = route.trips[0];
        firstTrip.stop_times.forEach(st => {
          if (st.stop_id) {
            stopIds.add(st.stop_id);
          }
        });
      }

      return {
        id: route.id,
        name: route.long_name || route.short_name || route.id,
        shortName: route.short_name,
        type: route.type || 'bus',
        color: '#1f8eed', // Default color, can be extended in schema
        stops: Array.from(stopIds),
        stopIds: Array.from(stopIds), // For compatibility
        serviceHours: '05:00 - 23:00',
        frequencyMinutes: 15,
        fare: route.fare || 7000
      };
    });

    console.log(`✅ Loaded ${cachedRoutes.length} routes from DATABASE`);
    return cachedRoutes;
  } catch (error) {
    console.error('❌ Error loading routes from database:', error.message);
    return [];
  }
}

/**
 * Load trips from database using Prisma
 */
async function loadTrips() {
  if (cachedTrips) return cachedTrips;

  try {
    const dbTrips = await prisma.trips.findMany();
    cachedTrips = dbTrips;
    console.log(`✅ Loaded ${cachedTrips.length} trips from DATABASE`);
    return cachedTrips;
  } catch (error) {
    console.error('❌ Error loading trips from database:', error.message);
    return [];
  }
}

/**
 * Load stop times from database using Prisma
 */
async function loadStopTimes() {
  if (cachedStopTimes) return cachedStopTimes;

  try {
    const dbStopTimes = await prisma.stop_times.findMany({
      orderBy: [
        { trip_id: 'asc' },
        { stop_sequence: 'asc' }
      ]
    });
    cachedStopTimes = dbStopTimes;
    console.log(`✅ Loaded ${cachedStopTimes.length} stop_times from DATABASE`);
    return cachedStopTimes;
  } catch (error) {
    console.error('❌ Error loading stop_times from database:', error.message);
    return [];
  }
}

/**
 * Build graph edges from database data
 * Returns array of edges: { from, to, lineId, mode, duration, cost, distance }
 */
async function buildGraphFromGtfs() {
  const routes = await loadRoutes();
  const stops = await loadStops();
  const stopMap = new Map(stops.map(s => [s.id, s]));
  const { haversineDistance } = require('./geo');

  const edges = [];
  const WALK_THRESHOLD_KM = 0.1; // Max walking distance between stops (100m)

  // 1. Build edges along each route (BIDIRECTIONAL)
  routes.forEach(route => {
    const routeStops = route.stops;

    for (let i = 0; i < routeStops.length - 1; i++) {
      const fromId = routeStops[i];
      const toId = routeStops[i + 1];
      const fromStop = stopMap.get(fromId);
      const toStop = stopMap.get(toId);

      if (!fromStop || !toStop) continue;

      const distance = haversineDistance(fromStop.coords, toStop.coords);
      const speed = route.type === 'train' ? 40 : 20; // km/h
      const duration = Math.ceil((distance / speed) * 60); // minutes
      const cost = 0; // Cost is per route, not per segment

      // Forward direction
      edges.push({
        from: fromId,
        to: toId,
        lineId: route.id,
        lineName: route.name,
        mode: route.type,
        duration: duration,
        cost: cost,
        distance: distance
      });

      // Reverse direction
      edges.push({
        from: toId,
        to: fromId,
        lineId: route.id,
        lineName: route.name,
        mode: route.type,
        duration: duration,
        cost: cost,
        distance: distance
      });
    }
  });

  // 2. Build walking edges between nearby stops (BIDIRECTIONAL)
  const stopArray = Array.from(stopMap.values());
  for (let i = 0; i < stopArray.length; i++) {
    for (let j = i + 1; j < stopArray.length; j++) {
      const stop1 = stopArray[i];
      const stop2 = stopArray[j];
      const distance = haversineDistance(stop1.coords, stop2.coords);

      if (distance <= WALK_THRESHOLD_KM) {
        const duration = Math.ceil((distance / 5) * 60); // 5 km/h walking speed

        edges.push({
          from: stop1.id,
          to: stop2.id,
          lineId: null,
          lineName: null,
          mode: 'walk',
          duration: duration,
          cost: 0,
          distance: distance
        });

        edges.push({
          from: stop2.id,
          to: stop1.id,
          lineId: null,
          lineName: null,
          mode: 'walk',
          duration: duration,
          cost: 0,
          distance: distance
        });
      }
    }
  }

  console.log(`✅ Built ${edges.length} edges from DATABASE data`);
  return edges;
}

/**
 * Reload all data (clear cache)
 */
function reloadGtfs() {
  cachedStops = null;
  cachedRoutes = null;
  cachedTrips = null;
  cachedStopTimes = null;

  console.log('🔄 Clearing cache, will reload from DATABASE on next request');
}

/**
 * Initialize data on startup
 */
async function initializeData() {
  console.log('🚀 Initializing data from DATABASE...');
  await loadStops();
  await loadRoutes();
  console.log('✅ Data initialization complete');
}

module.exports = {
  loadStops,
  loadRoutes,
  loadTrips,
  loadStopTimes,
  buildGraphFromGtfs,
  reloadGtfs,
  initializeData
};

