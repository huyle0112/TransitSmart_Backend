const express = require('express');
const rateLimit = require('express-rate-limit');
const {
    register,
    login,
    me,
    refreshToken,
    logout,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// General auth rate limiter - 15 requests per minute
const authLimiter = rateLimit({
    windowMs: 60_000, // 1 minute
    max: 15,
    message: 'Too many requests, please try again later'
});

// Stricter rate limiter for refresh endpoint - 5 requests per minute
const refreshLimiter = rateLimit({
    windowMs: 60_000,
    max: 5,
    message: 'Too many refresh requests'
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshLimiter, refreshToken);
router.post('/logout', authLimiter, logout);
router.get('/me', authLimiter, authMiddleware, me);

module.exports = router;