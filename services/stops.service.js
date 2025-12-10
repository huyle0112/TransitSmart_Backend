const stopsRepo = require("../repositories/stops.repo");

module.exports = {
    getAllStops() {
        return stopsRepo.getAll();
    },

    getStopById(id) {
        return stopsRepo.getById(id);
    },

    createStop(data) {
        return stopsRepo.create(data);
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
