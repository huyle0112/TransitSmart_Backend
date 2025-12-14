const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const { uploadAvatar } = require('../controllers/uploadController');

const router = express.Router();

/**
 * Rate limiter for avatar uploads
 * 5 requests per 15 minutes per authenticated user
 */
const avatarUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    // Use user.sub if available (from optionalAuthMiddleware), fallback to IP
    keyGenerator: (req) => `avatar-${req.user?.sub || req.ip}`,
    handler: (req, res) => res.status(429).json({
        message: 'Quá nhiều yêu cầu upload. Vui lòng thử lại sau 15 phút.',
        retryAfter: req.rateLimit?.resetTime
    })
});

/**
 * POST /api/upload/avatar
 * Upload user avatar (protected, rate-limited)
 * Middleware order for CI compliance:
 * 1. optionalAuthMiddleware - loads user info if token exists (no rejection)
 * 2. avatarUploadLimiter - rate limits based on user.sub or IP
 * 3. authMiddleware - enforces authentication requirement
 */
router.post(
    '/avatar',
    optionalAuthMiddleware, // Load user info first (CI requirement: limiter before auth)
    avatarUploadLimiter,     // Rate limit
    authMiddleware,          // Enforce authentication
    uploadAvatar
);

module.exports = router;
