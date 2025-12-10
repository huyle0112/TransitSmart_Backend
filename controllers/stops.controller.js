const stopsService = require("../services/stops.service");

module.exports = {
    // GET /stops
    async getAllStops(req, res) {
        try {
            const stops = await stopsService.getAllStops();
            res.json(stops);
        } catch (err) {
            console.error("Error fetching stops:", err.message);
            res.status(500).json({ error: "Failed to fetch stops" });
        }
    },

    // GET /stops/:id
    async getStopById(req, res) {
        const { id } = req.params;

        try {
            const stop = await stopsService.getStopById(id);
            if (!stop) {
                return res.status(404).json({ error: "Stop not found" });
            }
            res.json(stop);
        } catch (err) {
            console.error("Error fetching stop:", err.message);
            res.status(500).json({ error: "Failed to fetch stop" });
        }
    },

    // POST /stops
    async createStop(req, res) {
        const { id, name, lat, lng, type } = req.body;

        try {
            const newStop = await stopsService.createStop({
                id,
                name,
                lat,
                lng,
                type
            });

            res.status(201).json(newStop);
        } catch (err) {
            console.error("Error creating stop:", err.message);
            res.status(500).json({ error: "Failed to create stop" });
        }
    },

    // GET /stops/:id/times
    async getStopWithTimes(req, res) {
        const { id } = req.params;

        try {
            const stop = await stopsService.getStopWithTimes(id);
            if (!stop) {
                return res.status(404).json({ error: "Stop not found" });
            }

            res.json(stop);
        } catch (err) {
            console.error("Error fetching stop times:", err.message);
            res.status(500).json({ error: "Failed to fetch stop times" });
        }
    },

    // GET /stops/:id/arrivals
    async getStopArrivals(req, res) {
        const { id } = req.params;

        try {
            const routes = await stopsService.getRoutesWithArrivals(id);
            res.json({
                stopId: id,
                routes,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error("Error fetching stop arrivals:", err.message);
            res.status(500).json({ error: "Failed to fetch stop arrivals" });
        }
    }
};
