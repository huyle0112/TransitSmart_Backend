const express = require("express");
const router = express.Router();
const stopsController = require("../controllers/stops.controller");

// GET /stops
router.get("/", stopsController.getAllStops);

// GET /stops/:id
router.get("/:id", stopsController.getStopById);

// POST /stops
router.post("/", stopsController.createStop);

// PUT /stops/:id
router.put("/:id", stopsController.updateStop);

// DELETE /stops/:id
router.delete("/:id", stopsController.deleteStop);

// GET /stops/:id/times
router.get("/:id/times", stopsController.getStopWithTimes);

// GET /stops/:id/arrivals - Get upcoming arrivals for a stop
router.get("/:id/arrivals", stopsController.getStopArrivals);

module.exports = router;
