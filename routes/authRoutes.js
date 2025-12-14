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

const authLimiter = rateLimiter({ windowMs: 60_000, max: 15 });

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', authLimiter, logout);
router.get('/me', authMiddleware, me);

module.exports = router;
