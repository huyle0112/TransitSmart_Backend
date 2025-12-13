const express = require('express');
const { findPaths } = require('../controllers/path.find.controller');

const router = express.Router();

// POST /api/path/find
// Body: { from: {lat, lng}, to: {lat, lng}, time: "HH:MM:SS" }
router.post('/find', findPaths);

module.exports = router;
