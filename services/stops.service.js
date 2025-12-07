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
    }
};
