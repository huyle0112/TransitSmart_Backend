const express = require('express');
const rateLimit = require('express-rate-limit');
const { findPaths, saveSearchToHistory } = require('../controllers/path.find.controller');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * POST /api/path/find
 * Body: { from: {lat, lng}, to: {lat, lng}, time: "HH:MM:SS" }
 * Optional authentication - if logged in, search will be saved to history
 * Rate limited: 30 req/min for authenticated users, 10 req/min for unauthenticated
 */
router.post(
    '/find',
    optionalAuthMiddleware,
    rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: (req) => (req.user ? 30 : 10),
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => req.user?.sub || req.ip,
        handler: (req, res) => {
            return res.status(429).json({
                message: 'Quá nhiều yêu cầu tìm đường. Vui lòng thử lại sau một phút.',
                retryAfter: req.rateLimit?.resetTime
            });
        }
    }),
    findPaths
);
/**
 * POST /api/path/save-history
 * Body: { fromLabel, toLabel, fromCoords, toCoords }
 * Requires authentication
 * Rate limited: 20 req/min per user
 * Performs expensive Redis write operation
 */
router.post(
    '/save-history',
    authMiddleware,
    rateLimit({
        windowMs: 60 * 1000,
        max: 20,
        keyGenerator: (req) => `save-history-${req.user.sub}`,
        handler: (req, res) => res.status(429).json({ message: 'Too many requests.' }),
    }),
    saveSearchToHistory
);

module.exports = router;