const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../controllers/uploadController');

const router = express.Router();

/**
 * Rate limiter middleware for avatar uploads
 * Enforces 5 uploads per 15 minutes per authenticated user
 */
const avatarUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Rate limit by authenticated user ID
        if (!req.user || !req.user.sub) {
            return req.ip;
        }
        return `avatar-${req.user.sub}`;
    },
    skip: (req) => {
        // Skip rate limiting only for admin users
        if (req.user && req.user.role === 'admin') {
            return true;
        }
        return false;
    },
    handler: (req, res) => {
        // Explicit error handler for rate limit exceeded
        return res.status(429).json({
            message: 'Quá nhiều yêu cầu upload. Vui lòng thử lại sau 15 phút.',
            retryAfter: req.rateLimit?.resetTime
        });
    }
});

/**
 * POST /api/upload/avatar
 * Upload user avatar (protected, rate-limited)
 */
router.post(
    '/avatar',
    avatarUploadLimiter,
    authMiddleware,
    (req, res, next) => {
        // Validate user is authenticated before rate limiting
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Không được phép truy cập.' });
        }
        next();
    },
    uploadAvatar
);

module.exports = router;