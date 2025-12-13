const express = require('express');
const {
  getRouteDetails,
  getNearbyStops,
  getWalkingRoute,
} = require('../controllers/routeController');
const { findPaths } = require('../controllers/path.find.controller');

const router = express.Router();

router.post('/find', findPaths);
router.get('/details', getRouteDetails);
router.get('/nearby', getNearbyStops);
router.get('/walking-route/:stopId', getWalkingRoute);

module.exports = router;

