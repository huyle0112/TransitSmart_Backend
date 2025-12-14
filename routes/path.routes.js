const express = require('express');
const rateLimit = require('express-rate-limit');
const { findPaths, saveSearchToHistory } = require('../controllers/path.find.controller');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Rate limiter for path finding endpoint
 * Different limits for authenticated vs unauthenticated users
 */
const findPathsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: (req) => {
        // Authenticated users: 30 requests per minute
        // Unauthenticated users: 10 requests per minute
        return req.user ? 30 : 10;
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Rate limit by user ID if authenticated, otherwise by IP
        return req.user?.sub || req.ip;
    },
    handler: (req, res) => {
        return res.status(429).json({
            message: 'Quá nhiều yêu cầu tìm đường. Vui lòng thử lại sau một phút.',
            retryAfter: req.rateLimit?.resetTime
        });
    }
});

/**
 * Rate limiter for save history endpoint
 * Only applies to authenticated users
 * Prevents DoS attacks on Redis write operations
 */
const saveHistoryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 saves per minute per user
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip if not authenticated (authMiddleware will handle this)
        return !req.user || !req.user.sub;
    },
    keyGenerator: (req) => {
        // Rate limit by authenticated user ID
        return `save-history-${req.user?.sub || req.ip}`;
    },
    handler: (req, res) => {
        return res.status(429).json({
            message: 'Quá nhiều yêu cầu lưu lịch sử. Vui lòng thử lại sau một phút.',
            retryAfter: req.rateLimit?.resetTime
        });
    }
});

/**
 * POST /api/path/find
 * Body: { from: {lat, lng}, to: {lat, lng}, time: "HH:MM:SS" }
 * Optional authentication - if logged in, search will be saved to history
 * Rate limited: 30 req/min for authenticated users, 10 req/min for unauthenticated
 */
router.post('/find', optionalAuthMiddleware, findPathsLimiter, findPaths);

/**
 * POST /api/path/save-history
 * Body: { fromLabel, toLabel, fromCoords, toCoords }
 * Requires authentication
 * Rate limited: 20 req/min per user
 * Performs expensive Redis write operation
 */
router.post('/save-history', authMiddleware, saveHistoryLimiter, saveSearchToHistory);

module.exports = router;