const express = require('express');
const {
  findRoutes,
  getRouteDetails,
  getNearbyStops,
} = require('../controllers/routeController');

const router = express.Router();

router.post('/find', findRoutes);
router.get('/details', getRouteDetails);
router.get('/nearby', getNearbyStops);

module.exports = router;

