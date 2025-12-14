const express = require('express');
const rateLimit = require('express-rate-limit');
const { findPaths, saveSearchToHistory } = require('../controllers/path.find.controller');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Rate limiter for path finding
 * 30 req/min for authenticated users, 10 req/min for unauthenticated
 */
const findPathsLimiter = rateLimit({
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
});

/**
 * Rate limiter for save history
 * 20 req/min per authenticated user
 */
const saveHistoryLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `save-history-${req.user.sub}`,
    handler: (req, res) => {
        return res.status(429).json({
            message: 'Quá nhiều yêu cầu lưu lịch sử. Vui lòng thử lại sau một phút.',
            retryAfter: req.rateLimit?.resetTime
        });
    }
});

/**
 * POST /api/path/find
 * Optional authentication
 */
router.post(
    '/find',
    findPathsLimiter,
    optionalAuthMiddleware,
    findPaths
);

/**
 * POST /api/path/save-history
 * Requires authentication
 */
router.post(
    '/save-history',
    saveHistoryLimiter,
    authMiddleware,
    saveSearchToHistory
);

module.exports = router;
