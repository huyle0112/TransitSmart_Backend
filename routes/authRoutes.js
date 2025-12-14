const express = require('express');
const {
    register,
    login,
    me,
    refreshToken,
    logout,
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// General auth rate limiter - 15 requests per minute
const authLimiter = rateLimiter({ windowMs: 60_000, max: 15 });

// Stricter rate limiter for refresh endpoint - 5 requests per minute
// Prevents token refresh abuse and DoS attacks
const refreshLimiter = rateLimiter({ windowMs: 60_000, max: 5 });

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshLimiter, refreshToken);
router.post('/logout', authLimiter, logout);
router.get('/me', authLimiter, authMiddleware, me);

module.exports = router;
