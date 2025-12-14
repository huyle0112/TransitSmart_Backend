const express = require('express');
const router = express.Router();
const orsController = require('../controllers/ors.controller');

// POST /api/ors/directions - Get route directions
router.post('/directions', orsController.getDirections);

module.exports = router;
