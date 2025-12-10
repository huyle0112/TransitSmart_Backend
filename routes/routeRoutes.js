const express = require('express');
const {
  findRoutes,
  getRouteDetails,
  getNearbyStops,
  getWalkingRoute,
} = require('../controllers/routeController');

const router = express.Router();

router.post('/find', findRoutes);
router.get('/details', getRouteDetails);
router.get('/nearby', getNearbyStops);
router.get('/walking-route/:stopId', getWalkingRoute);

module.exports = router;

