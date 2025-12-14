const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../controllers/uploadController');

const router = express.Router();

/**
 * POST /api/upload/avatar
 * Upload user avatar (protected, rate-limited)
 */
router.post(
    '/avatar',
    authMiddleware, // Auth middleware first
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 requests per window
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `avatar-${req.user.sub}`, // req.user chắc chắn tồn tại
        handler: (req, res) => res.status(429).json({
            message: 'Quá nhiều yêu cầu upload. Vui lòng thử lại sau 15 phút.',
            retryAfter: req.rateLimit?.resetTime
        }),
    }),
    uploadAvatar
);

module.exports = router;
