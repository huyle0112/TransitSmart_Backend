const express = require('express');
const router = express.Router();
const busRoutesController = require('../controllers/busRoutes.controller');

router.get('/search', busRoutesController.searchBusRoutes);
router.get('/details', busRoutesController.getBusLineDetails);
router.get('/schedule', busRoutesController.getRouteSchedule);

module.exports = router;
