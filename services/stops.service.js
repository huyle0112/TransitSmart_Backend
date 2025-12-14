const stopsRepo = require("../repositories/stops.repo");

module.exports = {
    async getAllStops(skip = 0, limit = 100, search = '') {
        const [stops, total] = await Promise.all([
            stopsRepo.getAll(skip, limit, search),
            stopsRepo.count(search)
        ]);
        return {
            stops,
            total,
            page: Math.floor(skip / limit) + 1,
            totalPages: Math.ceil(total / limit)
        };
    },

    getStopById(id) {
        return stopsRepo.getById(id);
    },

    createStop(data) {
        return stopsRepo.create(data);
    },

    updateStop(id, data) {
        return stopsRepo.update(id, data);
    },

    deleteStop(id) {
        return stopsRepo.delete(id);
    },

    getStopWithTimes(id) {
        return stopsRepo.getWithTimes(id);
    },

    /**
     * Get upcoming trips for a stop
     * @param {string} stopId - The stop ID
     * @param {Date} currentTime - Current time (default: now)
     * @param {number} limit - Maximum number of upcoming trips
     */
    getUpcomingTrips(stopId, currentTime, limit) {
        return stopsRepo.getUpcomingTrips(stopId, currentTime, limit);
    },

    /**
     * Get routes with next arrival times for a stop
     * @param {string} stopId - The stop ID
     * @param {Date} currentTime - Current time (default: now)
     */
    getRoutesWithArrivals(stopId, currentTime) {
        return stopsRepo.getRoutesWithArrivals(stopId, currentTime);
    }
};
