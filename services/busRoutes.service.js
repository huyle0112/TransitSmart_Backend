const routesRepo = require('../repositories/routes.repo');
const tripsRepo = require('../repositories/trips.repo');
const stopTimesRepo = require('../repositories/stopTimes.repo');

module.exports = {
  async search(query) {
    const routes = await routesRepo.searchByName(query);
    // Group by long_name to avoid duplicates in search results (e.g. Tuyến 01 has 2 entries)
    // Actually, we want to return unique bus lines.
    const uniqueRoutes = {};
    routes.forEach(route => {
      if (!uniqueRoutes[route.long_name]) {
        uniqueRoutes[route.long_name] = {
          name: route.long_name,
          description: route.short_name, // e.g. "n/a-01_1" might not be good description.
          // Let's look at data again. short_name is like 'n/a-01_1'.
          // logical name is 'Tuyến 01'.
          // We can return just name.
          sampleId: route.id
        };
      }
    });
    return Object.values(uniqueRoutes);
  },

  async getLineDetails(name) {
    const routes = await routesRepo.findByName(name);
    if (!routes || routes.length === 0) return null;

    // routes should contain 2 entries typically: forward and backward
    const directions = await Promise.all(routes.map(async (route) => {
      // Find a representative trip for this route to get the stops
      const trips = await tripsRepo.getByRouteId(route.id);
      if (!trips || trips.length === 0) return null;

      // Pick the first trip
      const trip = trips[0];
      const stopTimes = await stopTimesRepo.getFullSchedule(trip.trip_id);

      return {
        route_id: route.id,
        direction: route.forward_direction ? 'forward' : 'backward', // Assuming boolean or checking value
        // In DB it is boolean? let's check schema.
        // schema says forward_direction Boolean?
        // csv shows 'TRUE'/'FALSE'. Prisma maps to boolean.
        headsign: route.short_name, // Just a placeholder
        stops: stopTimes.map(st => st.stops)
      };
    }));

    return {
      name: name,
      directions: directions.filter(d => d !== null)
    };
  },

  async getSchedule(routeId) {
    const trips = await tripsRepo.getByRouteId(routeId);
    // For each trip, we want start time and end time? 
    // Or just list of trips.
    // User asked for "Lịch trình của tuyến buýt đó".
    // Usually this means list of trips and their times.
    // We can sort by start time.
    // This might be heavy if we fetch stop times for ALL trips.
    // But let's assume we just want trip info.
    // detailed schedule might need all stops.
    // For now, let's return list of trips with their first stop time.

    // Optimization: tripsRepo.getAll() includes stop_times.
    // getByRouteId includes stop_times.

    const formattedTrips = trips.map(trip => {
      const sortedStopTimes = trip.stop_times.sort((a, b) => a.stop_sequence - b.stop_sequence);
      const first = sortedStopTimes[0];
      const last = sortedStopTimes[sortedStopTimes.length - 1];
      return {
        trip_id: trip.trip_id,
        start_time: first?.departure_time || first?.arrival_time,
        end_time: last?.arrival_time || last?.departure_time
      };
    });

    // Sort by start time
    return formattedTrips.sort((a, b) => {
      const t1 = new Date(a.start_time).getTime();
      const t2 = new Date(b.start_time).getTime();
      return t1 - t2;
    });
  },

  async createRoute(data) {
    return routesRepo.create(data);
  },

  async updateRoute(id, data) {
    return routesRepo.update(id, data);
  },

  async deleteRoute(id) {
    return routesRepo.delete(id);
  }
};
