const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../controllers/uploadController');

const router = express.Router();

// Rate limiter for avatar uploads
// Allow 5 uploads per 15 minutes per user
const avatarUploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    message: 'Quá nhiều yêu cầu upload. Vui lòng thử lại sau 15 phút.',
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skip: (req, res) => {
        // Optional: skip rate limiting for admin users
        return req.user?.role === 'admin';
    },
    keyGenerator: (req, res) => {
        // Rate limit by user ID instead of IP (since auth is required)
        return req.user?.sub || req.ip;
    }
});

// POST /api/upload/avatar - Upload user avatar (protected, rate-limited)
router.post('/avatar', authMiddleware, avatarUploadLimiter, uploadAvatar);

module.exports = router;