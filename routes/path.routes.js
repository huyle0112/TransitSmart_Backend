const express = require('express');
const { findPaths, saveSearchToHistory } = require('../controllers/path.find.controller');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/path/find
// Body: { from: {lat, lng}, to: {lat, lng}, time: "HH:MM:SS" }
// Optional authentication - if logged in, search will be saved to history
router.post('/find', optionalAuthMiddleware, findPaths);

// POST /api/path/save-history
// Body: { fromLabel, toLabel, fromCoords, toCoords }
// Requires authentication
router.post('/save-history', authMiddleware, saveSearchToHistory);

module.exports = router;
