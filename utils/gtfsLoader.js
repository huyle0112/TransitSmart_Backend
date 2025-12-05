const fs = require('fs');
const path = require('path');
const parse = require('csv-parse/sync').parse;

// Path to GTFS files
const GTFS_DIR = path.join(__dirname, '../data/gtfs');

// Cache for loaded GTFS data
let cachedStops = null;
let cachedRoutes = null;
let cachedTrips = null;
let cachedStopTimes = null;

/**
 * Load and parse a GTFS CSV file
 */
function loadGtfsFile(filename) {
  const filePath = path.join(GTFS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`GTFS file not found: ${filename}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
}

/**
 * Load stops from GTFS stops.txt (or stops-enriched.txt if available)
 * Converts to app format: { id, name, coords: {lat, lng}, type }
 */
function loadStops() {
  if (cachedStops) return cachedStops;

  // Try to load enriched version first (with human-readable names)
  const enrichedPath = path.join(GTFS_DIR, 'stops-enriched.txt');
  const filename = fs.existsSync(enrichedPath) ? 'stops-enriched.txt' : 'stops.txt';

  if (filename === 'stops-enriched.txt') {
    console.log('📍 Using enriched stop names');
  }

  const gtfsStops = loadGtfsFile(filename);

  cachedStops = gtfsStops.map(stop => ({
    id: stop.stop_id,
    name: stop.stop_name,
    coords: {
      lat: parseFloat(stop.stop_lat),
      lng: parseFloat(stop.stop_lon)
    },
    type: 'bus', // GTFS doesn't have type, default to bus
    // Keep original GTFS fields for reference
    gtfs: {
      stop_code: stop.stop_code,
      stop_desc: stop.stop_desc,
      zone_id: stop.zone_id,
      stop_url: stop.stop_url
    }
  }));

  console.log(`✅ Loaded ${cachedStops.length} stops from GTFS`);
  return cachedStops;
}

/**
 * Load routes from GTFS routes.txt
 * Converts to app format: { id, name, type, color, stops[], serviceHours, frequencyMinutes, fare }
 */
function loadRoutes() {
  if (cachedRoutes) return cachedRoutes;

  const gtfsRoutes = loadGtfsFile('routes.txt');
  const gtfsTrips = loadTrips();
  const gtfsStopTimes = loadStopTimes();

  // Build stop sequences for each route
  const routeStopsMap = new Map();

  gtfsTrips.forEach(trip => {
    const routeId = trip.route_id;
    if (!routeStopsMap.has(routeId)) {
      routeStopsMap.set(routeId, new Set());
    }

    // Get all stops for this trip
    const tripStops = gtfsStopTimes
      .filter(st => st.trip_id === trip.trip_id)
      .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
      .map(st => st.stop_id);

    // Add to route's stop set (preserving order of first trip)
    if (routeStopsMap.get(routeId).size === 0) {
      tripStops.forEach(stopId => routeStopsMap.get(routeId).add(stopId));
    }
  });

  cachedRoutes = gtfsRoutes.map(route => {
    const stops = Array.from(routeStopsMap.get(route.route_id) || []);

    // Determine type from route_type (GTFS standard)
    // 0,1,2 = tram/metro/rail, 3 = bus, 4 = ferry
    let type = 'bus';
    const routeType = parseInt(route.route_type);
    if ([0, 1, 2, 400, 401, 402].includes(routeType)) {
      type = 'train';
    } else if (routeType === 4) {
      type = 'ferry';
    }

    return {
      id: route.route_id,
      name: route.route_long_name || route.route_short_name,
      type: type,
      color: route.route_color ? `#${route.route_color}` : '#1f8eed',
      stops: stops,
      serviceHours: '05:00 - 23:00', // Default, could be computed from stop_times
      frequencyMinutes: 15, // Default, could be computed from trips
      fare: 7000, // Default fare for Hanoi buses
      // Keep original GTFS fields
      gtfs: {
        route_short_name: route.route_short_name,
        route_long_name: route.route_long_name,
        route_desc: route.route_desc,
        route_type: route.route_type,
        route_url: route.route_url,
        route_text_color: route.route_text_color
      }
    };
  });

  console.log(`✅ Loaded ${cachedRoutes.length} routes from GTFS`);
  return cachedRoutes;
}

/**
 * Load trips from GTFS trips.txt
 */
function loadTrips() {
  if (cachedTrips) return cachedTrips;

  cachedTrips = loadGtfsFile('trips.txt');
  return cachedTrips;
}

/**
 * Load stop times from GTFS stop_times.txt
 */
function loadStopTimes() {
  if (cachedStopTimes) return cachedStopTimes;

  cachedStopTimes = loadGtfsFile('stop_times.txt');
  return cachedStopTimes;
}

/**
 * Build graph edges from GTFS data
 * Returns array of edges: { from, to, lineId, mode, duration, cost, distance }
 */
function buildGraphFromGtfs() {
  const routes = loadRoutes();
  const stops = loadStops();
  const stopMap = new Map(stops.map(s => [s.id, s]));
  const { haversineDistance } = require('./geo');

  const edges = [];
  const WALK_THRESHOLD_KM = 0.1; // Max walking distance between stops (100m - minimize transfers)

  // 1. Build edges along each route (BIDIRECTIONAL - for both directions)
  routes.forEach(route => {
    for (let i = 0; i < route.stops.length - 1; i++) {
      const fromId = route.stops[i];
      const toId = route.stops[i + 1];
      const fromStop = stopMap.get(fromId);
      const toStop = stopMap.get(toId);

      if (!fromStop || !toStop) continue;

      const distance = haversineDistance(fromStop.coords, toStop.coords);
      // Estimate duration: buses avg 20 km/h in city, trains 40 km/h
      const speed = route.type === 'train' ? 40 : 20;
      const duration = Math.ceil((distance / speed) * 60); // minutes
      // Cost is 0 for individual edges - fare is paid once per route, not per segment
      // The actual fare (7000 VND) is applied when building segments
      const cost = 0;

      // Add edge in forward direction
      edges.push({
        from: fromId,
        to: toId,
        lineId: route.id,
        mode: route.type,
        duration: duration,
        cost: cost,
        distance: distance
      });

      // Add edge in reverse direction (important for bi-directional routing!)
      edges.push({
        from: toId,
        to: fromId,
        lineId: route.id,
        mode: route.type,
        duration: duration,
        cost: cost,
        distance: distance
      });
    }
  });

  // 2. Build walking edges between nearby stops (for transfers) - BIDIRECTIONAL
  const stopArray = Array.from(stopMap.values());
  for (let i = 0; i < stopArray.length; i++) {
    for (let j = i + 1; j < stopArray.length; j++) {
      const stop1 = stopArray[i];
      const stop2 = stopArray[j];
      const distance = haversineDistance(stop1.coords, stop2.coords);

      if (distance <= WALK_THRESHOLD_KM) {
        // Walking speed: 5 km/h
        const duration = Math.ceil((distance / 5) * 60);

        // Add walking edge in both directions
        edges.push({
          from: stop1.id,
          to: stop2.id,
          lineId: null,
          mode: 'walk',
          duration: duration,
          cost: 0,
          distance: distance
        });

        edges.push({
          from: stop2.id,
          to: stop1.id,
          lineId: null,
          mode: 'walk',
          duration: duration,
          cost: 0,
          distance: distance
        });
      }
    }
  }

  console.log(`✅ Built ${edges.length} edges from GTFS data`);
  return edges;
}

/**
 * Reload all GTFS data (clear cache)
 */
function reloadGtfs() {
  cachedStops = null;
  cachedRoutes = null;
  cachedTrips = null;
  cachedStopTimes = null;

  console.log('🔄 Reloading GTFS data...');
  loadStops();
  loadRoutes();
}

module.exports = {
  loadStops,
  loadRoutes,
  loadTrips,
  loadStopTimes,
  buildGraphFromGtfs,
  reloadGtfs
};

