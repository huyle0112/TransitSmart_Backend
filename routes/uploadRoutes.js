const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
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
    handler: (req, res) => res.status(429).json({
        message: 'Quá nhiều yêu cầu upload. Vui lòng thử lại sau 15 phút.',
        retryAfter: req.rateLimit?.resetTime
    })
});

/**
 * POST /api/upload/avatar
 * Upload user avatar (protected, rate-limited)
 */
// codeql:ignore MissingRateLimiting "Rate limiter applied via avatarUploadLimiter"
router.post(
    '/avatar',
    avatarUploadLimiter,
    authMiddleware,
    uploadAvatar
);

module.exports = router;
